import { apiFetch } from "../../../services/httpClient";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";

export function clockOut(timezone: string): Promise<AttendanceRecord> {
  return apiFetch("/clock-out", { method: "POST", body: JSON.stringify({ timezone }) });
}
