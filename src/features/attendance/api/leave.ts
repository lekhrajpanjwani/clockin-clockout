import { apiFetch } from "../../../services/httpClient";
import type { MarkLeaveInput } from "../../../lib/shared/schemas/attendance";
import type { AttendanceDayDetail } from "../../../lib/shared/types/attendance";

export function markLeave(input: MarkLeaveInput): Promise<AttendanceDayDetail> {
  return apiFetch("/leave", { method: "POST", body: JSON.stringify(input) });
}

export function cancelLeave(date: string): Promise<{ cancelled: string }> {
  return apiFetch(`/leave/${date}`, { method: "DELETE", body: "{}" });
}
