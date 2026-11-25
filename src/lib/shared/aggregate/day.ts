import type { AttendanceSession, AttendanceStatus } from "../types/attendance";
import { localDateString } from "../time/attendance";
import type { CorrectionSession } from "../schemas/attendance";

/**
 * Pure TypeScript mirror of the database's att_recalc_day() and
 * att_regularize() rules (supabase/migrations/0003_sessions_breaks_audit.sql).
 * The database stays the source of truth; this lets the UI show live totals
 * and validation messages before a correction is submitted. Keep the two in
 * step — tests/unit/day.test.ts pins the same cases as tests/db.
 */

export const CORRECTION_WINDOW_DAYS = 30;
export const MAX_SESSION_HOURS = 24;

export interface DayTotals {
  status: Exclude<AttendanceStatus, "leave">;
  clockIn: string | null;
  clockOut: string | null;
  workedMinutes: number;
  breakMinutes: number;
}

const secs = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 1000;

export function computeDayTotals(
  sessions: Pick<AttendanceSession, "clockIn" | "clockOut" | "breaks">[],
): DayTotals {
  let sessionSec = 0;
  let closedBreakSec = 0;
  let allBreakSec = 0;
  let hasOpen = false;
  let onBreak = false;
  let first: string | null = null;
  let last: string | null = null;

  for (const s of sessions) {
    if (first === null || Date.parse(s.clockIn) < Date.parse(first)) first = s.clockIn;
    if (s.clockOut === null) hasOpen = true;
    else {
      sessionSec += secs(s.clockIn, s.clockOut);
      if (last === null || Date.parse(s.clockOut) > Date.parse(last)) last = s.clockOut;
    }
    for (const b of s.breaks) {
      if (b.breakEnd === null) {
        onBreak = true;
        continue;
      }
      const d = secs(b.breakStart, b.breakEnd);
      allBreakSec += d;
      if (s.clockOut !== null) closedBreakSec += d;
    }
  }

  return {
    status: onBreak ? "on_break" : hasOpen ? "working" : "completed",
    clockIn: first,
    clockOut: hasOpen ? null : last,
    workedMinutes: Math.max(0, Math.round((sessionSec - closedBreakSec) / 60)),
    breakMinutes: Math.round(allBreakSec / 60),
  };
}

export type CorrectionErrorCode =
  | "OUTSIDE_CORRECTION_WINDOW"
  | "INVALID_SESSION"
  | "FUTURE_TIME"
  | "SESSION_TOO_LONG"
  | "SESSION_DATE_MISMATCH"
  | "INVALID_BREAK"
  | "BREAK_OUTSIDE_SESSION"
  | "OVERLAPPING_TIMES";

export interface CorrectionIssue {
  code: CorrectionErrorCode;
  message: string;
  /** Index of the offending session, when there is one. */
  session?: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Validates a correction the same way att_regularize() does. Returns every issue found (empty = valid). */
export function validateCorrection(
  sessions: CorrectionSession[],
  ctx: { workDate: string; timezone: string; now: Date },
): CorrectionIssue[] {
  const issues: CorrectionIssue[] = [];
  const today = localDateString(ctx.now, ctx.timezone);
  const age = daysBetween(ctx.workDate, today);
  if (age < 0 || age > CORRECTION_WINDOW_DAYS) {
    issues.push({
      code: "OUTSIDE_CORRECTION_WINDOW",
      message: `Only today and the previous ${CORRECTION_WINDOW_DAYS} days can be corrected.`,
    });
  }

  sessions.forEach((s, i) => {
    const push = (code: CorrectionErrorCode, message: string) => issues.push({ code, message, session: i });
    if (Date.parse(s.clockOut) <= Date.parse(s.clockIn))
      push("INVALID_SESSION", "Clock-out must be after clock-in.");
    if (Date.parse(s.clockOut) > ctx.now.getTime()) push("FUTURE_TIME", "Times cannot be in the future.");
    if (secs(s.clockIn, s.clockOut) > MAX_SESSION_HOURS * 3600)
      push("SESSION_TOO_LONG", `A session cannot be longer than ${MAX_SESSION_HOURS} hours.`);
    if (localDateString(new Date(s.clockIn), ctx.timezone) !== ctx.workDate)
      push("SESSION_DATE_MISMATCH", "Each session must start on the day being corrected.");
    for (const b of s.breaks) {
      if (Date.parse(b.breakEnd) <= Date.parse(b.breakStart))
        push("INVALID_BREAK", "A break must end after it starts.");
      else if (
        Date.parse(b.breakStart) < Date.parse(s.clockIn) ||
        Date.parse(b.breakEnd) > Date.parse(s.clockOut)
      )
        push("BREAK_OUTSIDE_SESSION", "Breaks must fall inside their session.");
    }
  });

  const overlaps = (ranges: [number, number][]) => {
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    return sorted.some((r, i) => i > 0 && r[0] < sorted[i - 1]![1]);
  };
  if (overlaps(sessions.map((s) => [Date.parse(s.clockIn), Date.parse(s.clockOut)])))
    issues.push({ code: "OVERLAPPING_TIMES", message: "Sessions overlap each other." });
  if (
    overlaps(
      sessions.flatMap((s) =>
        s.breaks.map((b) => [Date.parse(b.breakStart), Date.parse(b.breakEnd)] as [number, number]),
      ),
    )
  )
    issues.push({ code: "OVERLAPPING_TIMES", message: "Breaks overlap each other." });

  return issues;
}

export interface LiveTotals {
  /** Worked time today including the running session, minus all breaks. */
  workedSeconds: number;
  /** Break time today including a running break. */
  breakSeconds: number;
  /** Elapsed time of the open session (breaks included), 0 if none. */
  currentSessionSeconds: number;
  /** Elapsed time of the open break, 0 if none. */
  currentBreakSeconds: number;
}

/** Ticking totals for the Dashboard: like computeDayTotals, but open sessions
 * and breaks count up to `now`. */
export function liveDayTotals(
  sessions: Pick<AttendanceSession, "clockIn" | "clockOut" | "breaks">[],
  now: Date,
): LiveTotals {
  const nowMs = now.getTime();
  const span = (a: string, b: string | null) =>
    Math.max(0, ((b ? Date.parse(b) : nowMs) - Date.parse(a)) / 1000);
  let session = 0;
  let brk = 0;
  let currentSession = 0;
  let currentBreak = 0;
  for (const s of sessions) {
    const d = span(s.clockIn, s.clockOut);
    session += d;
    if (s.clockOut === null) currentSession = d;
    for (const b of s.breaks) {
      const bd = span(b.breakStart, b.breakEnd);
      brk += bd;
      if (b.breakEnd === null) currentBreak = bd;
    }
  }
  return {
    workedSeconds: Math.max(0, Math.floor(session - brk)),
    breakSeconds: Math.floor(brk),
    currentSessionSeconds: Math.floor(currentSession),
    currentBreakSeconds: Math.floor(currentBreak),
  };
}
