import { apiFetch } from "../../../services/httpClient";
import type { AttendanceStatus, PaginatedAttendance } from "../../../lib/shared/types/attendance";

export interface AttendanceListParams {
  page?: number;
  pageSize?: number;
  sortBy?: "workDate" | "workedMinutes";
  sortDir?: "asc" | "desc";
  status?: AttendanceStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  needsReview?: boolean;
}

export function getAttendance(params: AttendanceListParams = {}): Promise<PaginatedAttendance> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  return apiFetch(`/attendance?${query.toString()}`);
}
