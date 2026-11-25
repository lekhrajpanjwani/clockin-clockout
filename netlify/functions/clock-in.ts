import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { checkRateLimit } from "./_shared/rateLimit";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseJsonBody } from "./_shared/validate";
import { rpcClockIn } from "./_shared/attendanceRepo";
import { DbError, dbErrorResponse } from "./_shared/dbErrors";
import { clockInSchema } from "../../src/lib/shared/schemas/attendance";
import { fromDaySnapshot } from "../../src/lib/shared/mappers/attendance";

/** Starts a new work session (a day can now have several). The response body
 * is still the day record, as before, so existing clients keep working. */
export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return methodNotAllowed("POST");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const allowed = await checkRateLimit(`clock-in:${userId}`, 10, 60);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  const parsed = await parseJsonBody(req, clockInSchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, parsed.issues);

  try {
    const snapshot = await rpcClockIn(getAdminClient(), userId, parsed.data.timezone);
    return jsonResponse(fromDaySnapshot(snapshot).day, 201);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error("clock-in failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not clock in. Please try again.", 500);
  }
};

export const config: Config = { path: "/api/clock-in" };
