export type AttendanceStatus = "working" | "on_break" | "completed" | "leave";

/**
 * Wire shape returned by the API and consumed by the frontend (camelCase).
 * Mirrors the `attendance` table but is intentionally decoupled from its
 * column names — see mappers/attendance.ts for the DB <-> API translation.
 */
export interface AttendanceRecord {
  id: string;
  workDate: string; // YYYY-MM-DD, local calendar date at (first) clock-in
  clockIn: string | null; // ISO-8601 UTC — first clock-in of the day; null on leave days
  clockOut: string | null; // ISO-8601 UTC — last clock-out; null while active / on leave
  timezone: string; // IANA zone, e.g. "Asia/Kolkata"
  workedMinutes: number | null; // Σ closed sessions − breaks
  breakMinutes: number;
  status: AttendanceStatus;
  leaveReason: string | null;
  autoClosed: boolean;
  needsReview: boolean;
}

export type SessionClosedBy = "user" | "auto" | "correction";

export interface AttendanceBreak {
  id: string;
  breakStart: string; // ISO-8601 UTC
  breakEnd: string | null;
}

export interface AttendanceSession {
  id: string;
  clockIn: string; // ISO-8601 UTC
  clockOut: string | null;
  closedBy: SessionClosedBy | null;
  breaks: AttendanceBreak[];
}

/** A day with its sessions and breaks — what every write endpoint returns. */
export interface AttendanceDayDetail {
  day: AttendanceRecord;
  sessions: AttendanceSession[];
}

export type AuditAction =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "auto_close"
  | "regularize"
  | "leave_mark"
  | "leave_cancel";

export interface AuditEntry {
  id: number;
  workDate: string;
  action: AuditAction;
  actor: "user" | "system" | "auto_close";
  reason: string | null;
  before: AttendanceDayDetail | null;
  after: AttendanceDayDetail | null;
  createdAt: string;
}

/** Raw row shape as stored in Postgres (snake_case). */
export interface AttendanceRow {
  id: string;
  user_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  timezone: string;
  worked_minutes: number | null;
  break_minutes: number;
  status: AttendanceStatus;
  leave_reason: string | null;
  auto_closed: boolean;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

/** Raw JSON returned by the att_* database functions (att_day_snapshot). */
export interface DaySnapshotRow {
  day: Omit<AttendanceRow, "user_id">;
  sessions: {
    id: string;
    clock_in: string;
    clock_out: string | null;
    closed_by: SessionClosedBy | null;
    breaks: { id: string; break_start: string; break_end: string | null }[];
  }[];
}

export interface WeeklyTotal {
  weekStart: string; // YYYY-MM-DD, Monday
  weekEnd: string; // YYYY-MM-DD, Sunday
  totalMinutes: number;
}

export interface MonthlyLogsResponse {
  year: number;
  month: number;
  days: AttendanceRecord[];
  weeklyTotals: WeeklyTotal[];
  monthlyTotalMinutes: number;
}

export interface AttendanceReport {
  year: number;
  month: number | null;
  workingDays: number;
  totalMinutes: number;
  averageMinutesPerDay: number;
  longestDay: { workDate: string; workedMinutes: number } | null;
  shortestDay: { workDate: string; workedMinutes: number } | null;
  missedDays: number;
  /** Leave days in the period (including planned future ones). */
  leaveDays: number;
  /** Break time across completed days. */
  breakMinutes: number;
  /** Days that were left open and closed by the auto-close job. */
  autoClosedDays: number;
}

export interface PaginatedAttendance {
  items: AttendanceRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
