import type { AttendanceRecord } from "../types/attendance";
import { localTimeString, minutesToDecimalHours } from "../time/attendance";

const STATUS_LABEL: Record<AttendanceRecord["status"], string> = {
  working: "Working",
  on_break: "On break",
  completed: "Completed",
  leave: "Leave",
};

export const CSV_HEADER = [
  "Date",
  "Status",
  "First Clock In",
  "Last Clock Out",
  "Worked Hours",
  "Break Hours",
  "Timezone",
  "Leave Reason",
  "Auto-closed",
  "Needs Review",
] as const;

/** Quotes fields containing separators/quotes/newlines, and neutralizes
 * spreadsheet formula injection: free text (e.g. a leave reason) starting with
 * = + - @ or a tab/CR is prefixed with ' so Excel/Sheets treat it as text. */
export function csvEscape(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Builds the CSV body for GET /attendance/export. Pure function — no I/O —
 * so it's trivially unit-testable and reusable if the frontend ever needs a
 * client-side/offline export fallback. One row per day; times are the first
 * clock-in and last clock-out in the day's own timezone. */
export function buildAttendanceCsv(records: AttendanceRecord[]): string {
  const rows = records.map((r) => [
    r.workDate,
    STATUS_LABEL[r.status],
    r.clockIn ? localTimeString(new Date(r.clockIn), r.timezone) : "",
    r.clockOut ? localTimeString(new Date(r.clockOut), r.timezone) : "",
    r.workedMinutes != null && r.status !== "leave" ? String(minutesToDecimalHours(r.workedMinutes)) : "",
    r.status === "leave" ? "" : String(minutesToDecimalHours(r.breakMinutes ?? 0)),
    r.timezone,
    r.leaveReason ?? "",
    r.autoClosed ? "Yes" : "No",
    r.needsReview ? "Yes" : "No",
  ]);

  return [[...CSV_HEADER], ...rows].map((fields) => fields.map(csvEscape).join(",")).join("\r\n");
}
