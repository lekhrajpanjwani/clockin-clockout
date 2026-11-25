import { apiFetch } from "../../../services/httpClient";
import type { RegularizeInput } from "../../../lib/shared/schemas/attendance";
import type { AttendanceRecord, AttendanceSession, AuditEntry } from "../../../lib/shared/types/attendance";

export interface DayResponse {
  day: AttendanceRecord | null;
  sessions: AttendanceSession[];
}

export function getDay(date: string): Promise<DayResponse> {
  return apiFetch(`/day/${date}`);
}

export function correctDay(date: string, input: RegularizeInput): Promise<DayResponse> {
  return apiFetch(`/day/${date}/sessions`, { method: "PUT", body: JSON.stringify(input) });
}

export function getDayAudit(date: string): Promise<{ items: AuditEntry[] }> {
  return apiFetch(`/day/${date}/audit`);
}
