import { apiFetch } from "../../../services/httpClient";
import type { AttendanceDayDetail } from "../../../lib/shared/types/attendance";

export function breakStart(): Promise<AttendanceDayDetail> {
  return apiFetch("/break/start", { method: "POST" });
}

export function breakEnd(): Promise<AttendanceDayDetail> {
  return apiFetch("/break/end", { method: "POST" });
}
