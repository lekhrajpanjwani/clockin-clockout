import type { CorrectionSession } from "../schemas/attendance";
import type {
  AttendanceDayDetail,
  AuditEntry,
  AttendanceRecord,
  AttendanceRow,
  DaySnapshotRow,
} from "../types/attendance";

/** Postgres renders timestamptz in JSON with the session's offset
 * ("2026-11-20T09:00:00+05:30"); the API always speaks UTC ISO strings. */
function iso(value: string): string;
function iso(value: string | null): string | null;
function iso(value: string | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

/** DB row (snake_case) -> API/wire record (camelCase). The one place this
 * translation happens, so every function and every frontend consumer agrees
 * on the shape. */
export function toAttendanceRecord(
  row: Omit<AttendanceRow, "user_id" | "created_at" | "updated_at">,
): AttendanceRecord {
  return {
    id: row.id,
    workDate: row.work_date,
    clockIn: iso(row.clock_in),
    clockOut: iso(row.clock_out),
    timezone: row.timezone,
    workedMinutes: row.worked_minutes,
    breakMinutes: row.break_minutes ?? 0,
    status: row.status,
    leaveReason: row.leave_reason ?? null,
    autoClosed: row.auto_closed ?? false,
    needsReview: row.needs_review ?? false,
  };
}

/** att_day_snapshot() JSON -> API day detail. */
export function fromDaySnapshot(snapshot: DaySnapshotRow): AttendanceDayDetail {
  return {
    day: toAttendanceRecord(snapshot.day),
    sessions: snapshot.sessions.map((s) => ({
      id: s.id,
      clockIn: iso(s.clock_in),
      clockOut: iso(s.clock_out),
      closedBy: s.closed_by,
      breaks: s.breaks.map((b) => ({ id: b.id, breakStart: iso(b.break_start), breakEnd: iso(b.break_end) })),
    })),
  };
}

/** Raw attendance_audit row -> API audit entry. */
export function toAuditEntry(row: {
  id: number;
  work_date: string;
  action: string;
  actor: string;
  reason: string | null;
  before: DaySnapshotRow | null;
  after: DaySnapshotRow | null;
  created_at: string;
}): AuditEntry {
  return {
    id: row.id,
    workDate: row.work_date,
    action: row.action as AuditEntry["action"],
    actor: row.actor as AuditEntry["actor"],
    reason: row.reason,
    before: row.before ? fromDaySnapshot(row.before) : null,
    after: row.after ? fromDaySnapshot(row.after) : null,
    createdAt: iso(row.created_at),
  };
}

/** API correction input (camelCase) -> att_regularize() argument (snake_case). */
export function toRegularizeArg(sessions: CorrectionSession[]) {
  return sessions.map((s) => ({
    clock_in: new Date(s.clockIn).toISOString(),
    clock_out: new Date(s.clockOut).toISOString(),
    breaks: s.breaks.map((b) => ({
      break_start: new Date(b.breakStart).toISOString(),
      break_end: new Date(b.breakEnd).toISOString(),
    })),
  }));
}
