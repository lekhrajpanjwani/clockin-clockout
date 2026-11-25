import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { checkRateLimit } from "./_shared/rateLimit";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseJsonBody } from "./_shared/validate";
import { rpcClockOut } from "./_shared/attendanceRepo";
import { DbError, dbErrorResponse } from "./_shared/dbErrors";
import { clockOutSchema } from "../../src/lib/shared/schemas/attendance";
import { fromDaySnapshot } from "../../src/lib/shared/mappers/attendance";

/** Closes the open session (ending an open break first). The server's clock
 * is used for the time; the body's timezone is validated but not needed. */
export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return methodNotAllowed("POST");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const allowed = await checkRateLimit(`clock-out:${userId}`, 10, 60);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  const parsed = await parseJsonBody(req, clockOutSchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, parsed.issues);

  try {
    const snapshot = await rpcClockOut(getAdminClient(), userId);
    return jsonResponse(fromDaySnapshot(snapshot).day, 200);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error("clock-out failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not clock out. Please try again.", 500);
  }
};

export const config: Config = { path: "/api/clock-out" };
