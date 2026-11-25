import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseQuery } from "./_shared/validate";
import { findActiveDay, findByWorkDate, rpcDaySnapshot } from "./_shared/attendanceRepo";
import { todayQuerySchema } from "../../src/lib/shared/schemas/attendance";
import { localDateString } from "../../src/lib/shared/time/attendance";
import { fromDaySnapshot, toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = parseQuery(url, todayQuerySchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.issues);
  const { timezone } = parsed.data;

  const client = getAdminClient();

  try {
    // The active day wins even if it started on an earlier date (a session
    // left open past midnight); otherwise today's local date.
    const row =
      (await findActiveDay(client, userId)) ??
      (await findByWorkDate(client, userId, localDateString(new Date(), timezone)));
    if (!row) return jsonResponse({ record: null, sessions: [] }, 200);

    const snapshot = await rpcDaySnapshot(client, row.id);
    const detail = snapshot ? fromDaySnapshot(snapshot) : { day: toAttendanceRecord(row), sessions: [] };
    return jsonResponse({ record: detail.day, sessions: detail.sessions }, 200);
  } catch (err) {
    console.error("attendance-today failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not load today's attendance.", 500);
  }
};

export const config: Config = { path: "/api/attendance/today" };
