import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseQuery } from "./_shared/validate";
import { listRange } from "./_shared/attendanceRepo";
import { reportQuerySchema } from "../../src/lib/shared/schemas/attendance";
import { firstDayOfMonth, lastDayOfMonth, localDateString } from "../../src/lib/shared/time/attendance";
import { toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";
import { computeReport } from "../../src/lib/shared/aggregate/attendance";

function periodRange(year: number, month: number | undefined): { dateFrom: string; dateTo: string } {
  if (month) {
    return { dateFrom: firstDayOfMonth(year, month), dateTo: lastDayOfMonth(year, month) };
  }
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = parseQuery(url, reportQuerySchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.issues);
  const { year, month, timezone } = parsed.data;

  const client = getAdminClient();
  const { dateFrom, dateTo } = periodRange(year, month);

  try {
    const rows = await listRange(client, userId, dateFrom, dateTo);
    const records = rows.map(toAttendanceRecord);
    const todayIso = timezone ? localDateString(new Date(), timezone) : undefined;
    const report = computeReport(records, dateFrom, dateTo, year, month ?? null, todayIso);
    return jsonResponse(report, 200);
  } catch (err) {
    console.error("attendance-report failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not build the report.", 500);
  }
};

export const config: Config = { path: "/api/attendance/report" };
