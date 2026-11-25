import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseQuery } from "./_shared/validate";
import { listRange } from "./_shared/attendanceRepo";
import { monthQuerySchema } from "../../src/lib/shared/schemas/attendance";
import { firstDayOfMonth, lastDayOfMonth } from "../../src/lib/shared/time/attendance";
import { toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";
import { groupByWeek, sumWorkedMinutes } from "../../src/lib/shared/aggregate/attendance";
import type { MonthlyLogsResponse } from "../../src/lib/shared/types/attendance";

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = parseQuery(url, monthQuerySchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.issues);
  const { year, month } = parsed.data;

  const client = getAdminClient();
  const dateFrom = firstDayOfMonth(year, month);
  const dateTo = lastDayOfMonth(year, month);

  try {
    const rows = await listRange(client, userId, dateFrom, dateTo);
    const days = rows.map(toAttendanceRecord);

    const response: MonthlyLogsResponse = {
      year,
      month,
      days,
      weeklyTotals: groupByWeek(days),
      monthlyTotalMinutes: sumWorkedMinutes(days),
    };
    return jsonResponse(response, 200);
  } catch (err) {
    console.error("attendance-month failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not load monthly logs.", 500);
  }
};

export const config: Config = { path: "/api/attendance/month" };
