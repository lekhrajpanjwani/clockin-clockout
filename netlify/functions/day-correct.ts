import type { Config } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { checkRateLimit } from "./_shared/rateLimit";
import { dateFromDayPath, errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseJsonBody } from "./_shared/validate";
import { rpcRegularize } from "./_shared/attendanceRepo";
import { DbError, dbErrorResponse } from "./_shared/dbErrors";
import { regularizeSchema } from "../../src/lib/shared/schemas/attendance";
import { fromDaySnapshot, toRegularizeArg } from "../../src/lib/shared/mappers/attendance";

/**
 * PUT /api/day/:date/sessions — correction ("regularization").
 * Body: { timezone, reason, sessions: [{ clockIn, clockOut, breaks: [{ breakStart, breakEnd }] }] }
 * Replaces the day's sessions with the given set; an empty list removes the
 * day. Validation (30-day window, no future times, no overlaps, breaks inside
 * sessions) is enforced by att_regularize(), which also writes the audit entry.
 */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "PUT") return methodNotAllowed("PUT");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const date = dateFromDayPath(req.url);
  if (!date) return errorResponse("VALIDATION_ERROR", "Expected /api/day/YYYY-MM-DD/sessions.", 400);

  if (!(await checkRateLimit(`day-correct:${userId}`, 20, 60))) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  const parsed = await parseJsonBody(req, regularizeSchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid correction.", 400, parsed.issues);
  const { timezone, sessions, reason } = parsed.data;

  try {
    const snapshot = await rpcRegularize(
      getAdminClient(),
      userId,
      date,
      timezone,
      toRegularizeArg(sessions),
      reason,
    );
    return jsonResponse(snapshot ? fromDaySnapshot(snapshot) : { day: null, sessions: [] }, 200);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error("day-correct failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not save the correction.", 500);
  }
};

export const config: Config = { path: "/api/day/:date/sessions" };
