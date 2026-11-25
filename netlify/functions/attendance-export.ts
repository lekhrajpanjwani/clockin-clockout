import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { errorResponse, csvResponse, methodNotAllowed } from "./_shared/http";
import { parseQuery } from "./_shared/validate";
import { listRange } from "./_shared/attendanceRepo";
import { exportQuerySchema } from "../../src/lib/shared/schemas/attendance";
import { firstDayOfMonth, lastDayOfMonth } from "../../src/lib/shared/time/attendance";
import { toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";
import { buildAttendanceCsv } from "../../src/lib/shared/csv/attendanceCsv";

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = parseQuery(url, exportQuerySchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.issues);
  const { year, month } = parsed.data;

  const client = getAdminClient();
  const dateFrom = month ? firstDayOfMonth(year, month) : `${year}-01-01`;
  const dateTo = month ? lastDayOfMonth(year, month) : `${year}-12-31`;

  try {
    const rows = await listRange(client, userId, dateFrom, dateTo);
    const csv = buildAttendanceCsv(rows.map(toAttendanceRecord));
    const filename = month
      ? `attendance-${year}-${String(month).padStart(2, "0")}.csv`
      : `attendance-${year}.csv`;
    return csvResponse(csv, filename);
  } catch (err) {
    console.error("attendance-export failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not export attendance.", 500);
  }
};

export const config: Config = { path: "/api/attendance/export" };
