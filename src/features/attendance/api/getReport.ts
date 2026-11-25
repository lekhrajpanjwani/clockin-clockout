import { apiFetch } from "../../../services/httpClient";
import type { AttendanceReport } from "../../../lib/shared/types/attendance";

export function getReport(
  year: number,
  month: number | undefined,
  timezone: string,
): Promise<AttendanceReport> {
  const params = new URLSearchParams({ year: String(year), timezone });
  if (month) params.set("month", String(month));
  return apiFetch(`/attendance/report?${params.toString()}`);
}
