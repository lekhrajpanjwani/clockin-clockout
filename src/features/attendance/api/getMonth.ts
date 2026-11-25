import { apiFetch } from "../../../services/httpClient";
import type { MonthlyLogsResponse } from "../../../lib/shared/types/attendance";

export function getMonth(year: number, month: number): Promise<MonthlyLogsResponse> {
  return apiFetch(`/attendance/month?year=${year}&month=${month}`);
}
