import type { AttendanceRecord, AttendanceReport, WeeklyTotal } from "../types/attendance";
import { enumerateDates, isoWeekday, isWeekdayIso, minIsoDate, weekBoundsFor } from "../time/attendance";

/** Groups records by ISO (Monday-start) week and sums worked minutes per week.
 * Weeks are returned in chronological order. Pure function — no I/O — shared
 * by /attendance/month and unit-tested directly in Phase 7. */
export function groupByWeek(records: AttendanceRecord[]): WeeklyTotal[] {
  const totals = new Map<string, WeeklyTotal>();

  for (const record of records) {
    const { weekStart, weekEnd } = weekBoundsFor(record.workDate);
    const existing = totals.get(weekStart);
    const minutes = record.workedMinutes ?? 0;
    if (existing) {
      existing.totalMinutes += minutes;
    } else {
      totals.set(weekStart, { weekStart, weekEnd, totalMinutes: minutes });
    }
  }

  return [...totals.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function sumWorkedMinutes(records: AttendanceRecord[]): number {
  return records.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0);
}

/** Computes the report stats for /attendance/report over an inclusive
 * `YYYY-MM-DD` date range. `year`/`month` are passed straight through so the
 * caller controls whether this is a monthly or full-year report.
 *
 * `todayIso`, when given, caps the range used for "missed days" so weekdays
 * that haven't happened yet (the rest of the current month/year) are not
 * counted as missed. */
export function computeReport(
  records: AttendanceRecord[],
  periodStart: string,
  periodEnd: string,
  year: number,
  month: number | null,
  todayIso?: string,
): AttendanceReport {
  const completed = records.filter((r) => r.status === "completed" && r.workedMinutes != null);
  const totalMinutes = sumWorkedMinutes(completed);
  const workingDays = completed.length;
  const averageMinutesPerDay = workingDays > 0 ? Math.round(totalMinutes / workingDays) : 0;

  let longestDay: AttendanceReport["longestDay"] = null;
  let shortestDay: AttendanceReport["shortestDay"] = null;
  for (const r of completed) {
    const minutes = r.workedMinutes as number;
    if (!longestDay || minutes > longestDay.workedMinutes) {
      longestDay = { workDate: r.workDate, workedMinutes: minutes };
    }
    if (!shortestDay || minutes < shortestDay.workedMinutes) {
      shortestDay = { workDate: r.workDate, workedMinutes: minutes };
    }
  }

  // Leave days are neither worked nor missed.
  const completedDates = new Set([
    ...completed.map((r) => r.workDate),
    ...records.filter((r) => r.status === "leave").map((r) => r.workDate),
  ]);
  const missedRangeEnd = todayIso ? minIsoDate(periodEnd, todayIso) : periodEnd;
  const missedDays = enumerateDates(periodStart, missedRangeEnd)
    .filter(isWeekdayIso)
    // Today only counts as missed once it's over — not while it's in progress.
    .filter((iso) => iso !== todayIso)
    .filter((iso) => !completedDates.has(iso)).length;

  return {
    year,
    month,
    workingDays,
    totalMinutes,
    averageMinutesPerDay,
    longestDay,
    shortestDay,
    missedDays,
    leaveDays: records.filter((r) => r.status === "leave").length,
    breakMinutes: completed.reduce((sum, r) => sum + (r.breakMinutes ?? 0), 0),
    autoClosedDays: records.filter((r) => r.autoClosed).length,
  };
}

/** One row per calendar day of a month, merging in the recorded session (if
 * any). Drives the Monthly Logs table so empty weekdays are visible rather
 * than silently skipped. */
export interface CalendarDay {
  date: string;
  weekday: number; // 1 = Mon … 7 = Sun
  record: AttendanceRecord | null;
}

export function buildMonthCalendar(dates: string[], records: AttendanceRecord[]): CalendarDay[] {
  const byDate = new Map(records.map((r) => [r.workDate, r]));
  return dates.map((date) => ({ date, weekday: isoWeekday(date), record: byDate.get(date) ?? null }));
}

/** Total worked minutes keyed by `YYYY-MM-DD`, for heatmaps and charts. */
export function minutesByDate(records: AttendanceRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) map.set(r.workDate, (map.get(r.workDate) ?? 0) + (r.workedMinutes ?? 0));
  return map;
}
