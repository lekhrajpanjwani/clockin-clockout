import { apiFetch } from "../../../services/httpClient";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";

export function clockIn(timezone: string): Promise<AttendanceRecord> {
  return apiFetch("/clock-in", { method: "POST", body: JSON.stringify({ timezone }) });
}
