import type { Config } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { dateFromDayPath, errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { listAudit } from "./_shared/attendanceRepo";
import { toAuditEntry } from "../../src/lib/shared/mappers/attendance";

/** GET /api/day/:date/audit — every recorded change to that day, newest first (max 50). */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);

  const date = dateFromDayPath(req.url);
  if (!date) return errorResponse("VALIDATION_ERROR", "Expected /api/day/YYYY-MM-DD/audit.", 400);

  try {
    const rows = await listAudit(getAdminClient(), auth.userId, date);
    return jsonResponse({ items: rows.map(toAuditEntry) }, 200);
  } catch (err) {
    console.error("day-audit failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not load the change history.", 500);
  }
};

export const config: Config = { path: "/api/day/:date/audit" };
