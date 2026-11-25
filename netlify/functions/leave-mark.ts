import type { Config } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { checkRateLimit } from "./_shared/rateLimit";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseJsonBody } from "./_shared/validate";
import { rpcMarkLeave } from "./_shared/attendanceRepo";
import { DbError, dbErrorResponse } from "./_shared/dbErrors";
import { markLeaveSchema } from "../../src/lib/shared/schemas/attendance";
import { fromDaySnapshot } from "../../src/lib/shared/mappers/attendance";

/** POST /api/leave — { date, timezone, reason }. Today or a future date (≤ 1 year),
 * full day, not on a day that already has attendance. Returns the leave day. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return methodNotAllowed("POST");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  if (!(await checkRateLimit(`leave:${userId}`, 20, 60))) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  const parsed = await parseJsonBody(req, markLeaveSchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid leave request.", 400, parsed.issues);
  const { date, timezone, reason } = parsed.data;

  try {
    const snapshot = await rpcMarkLeave(getAdminClient(), userId, date, timezone, reason);
    return jsonResponse(fromDaySnapshot(snapshot), 201);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error("leave-mark failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not mark leave.", 500);
  }
};

export const config: Config = { path: "/api/leave" };
