import { apiFetch } from "../../../services/httpClient";
import type { AttendanceRecord, AttendanceSession } from "../../../lib/shared/types/attendance";

export interface TodayResponse {
  record: AttendanceRecord | null;
  sessions: AttendanceSession[];
}

export async function getToday(timezone: string): Promise<TodayResponse> {
  const res = await apiFetch<Partial<TodayResponse>>(
    `/attendance/today?timezone=${encodeURIComponent(timezone)}`,
  );
  return { record: res.record ?? null, sessions: res.sessions ?? [] };
}
