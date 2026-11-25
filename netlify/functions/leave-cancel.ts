import type { Config } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { checkRateLimit } from "./_shared/rateLimit";
import { dateFromPath, errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseJsonBody } from "./_shared/validate";
import { rpcCancelLeave } from "./_shared/attendanceRepo";
import { DbError, dbErrorResponse } from "./_shared/dbErrors";
import { cancelLeaveSchema } from "../../src/lib/shared/schemas/attendance";

/** DELETE /api/leave/:date — cancels a leave day (optional body { reason }).
 * Allowed for future days and up to 30 days back; recorded in the audit log. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "DELETE") return methodNotAllowed("DELETE");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const date = dateFromPath(req.url, "leave");
  if (!date) return errorResponse("VALIDATION_ERROR", "Expected /api/leave/YYYY-MM-DD.", 400);

  if (!(await checkRateLimit(`leave:${userId}`, 20, 60))) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  const parsed = await parseJsonBody(req, cancelLeaveSchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid request.", 400, parsed.issues);

  try {
    await rpcCancelLeave(getAdminClient(), userId, date, parsed.data.reason || null);
    return jsonResponse({ cancelled: date }, 200);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error("leave-cancel failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not cancel the leave.", 500);
  }
};

export const config: Config = { path: "/api/leave/:date" };
