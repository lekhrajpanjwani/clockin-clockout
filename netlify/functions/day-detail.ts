import type { Config } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { dateFromDayPath, errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { findByWorkDate, rpcDaySnapshot } from "./_shared/attendanceRepo";
import { fromDaySnapshot } from "../../src/lib/shared/mappers/attendance";

/** GET /api/day/:date — one day with its sessions and breaks.
 * `{ day: null, sessions: [] }` when there is no record for that date. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);

  const date = dateFromDayPath(req.url);
  if (!date) return errorResponse("VALIDATION_ERROR", "Expected /api/day/YYYY-MM-DD.", 400);

  try {
    const client = getAdminClient();
    const row = await findByWorkDate(client, auth.userId, date);
    if (!row) return jsonResponse({ day: null, sessions: [] }, 200);
    const snapshot = await rpcDaySnapshot(client, row.id);
    return jsonResponse(snapshot ? fromDaySnapshot(snapshot) : { day: null, sessions: [] }, 200);
  } catch (err) {
    console.error("day-detail failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not load this day.", 500);
  }
};

export const config: Config = { path: "/api/day/:date" };
