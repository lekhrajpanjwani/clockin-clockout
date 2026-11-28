import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Pure, framework-free time/date math shared by the frontend and the
 * Netlify Functions. No React, no Supabase — safe to unit test in isolation.
 */

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/** The local calendar date (YYYY-MM-DD) for `instant` in `timeZone`. */
export function localDateString(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}

/** 12-hour local clock time for display, e.g. "09:02 AM". */
export function localTimeString(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, "hh:mm a");
}

/** Whole minutes between two instants, rounded to the nearest minute, never negative. */
export function computeWorkedMinutes(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

const DAY_MS = 86_400_000;

/** Parses a `YYYY-MM-DD` calendar date as UTC midnight. Calendar dates have
 * no timezone, so all date-only math below is done in UTC to stay identical
 * no matter which timezone the browser or the server runs in. (The previous
 * implementation used date-fns' local-time helpers, which shifted week
 * boundaries by a day for any browser east of UTC, e.g. IST.) */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formats a UTC-midnight `Date` back to `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds `days` (may be negative) to a `YYYY-MM-DD` date. */
export function addDaysIso(iso: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(iso).getTime() + days * DAY_MS));
}

/** ISO weekday for a `YYYY-MM-DD` date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const day = parseIsoDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/** ISO week (Monday start) bounds, as YYYY-MM-DD, for the week containing `dateIso`. */
export function weekBoundsFor(dateIso: string): { weekStart: string; weekEnd: string } {
  const weekStart = addDaysIso(dateIso, 1 - isoWeekday(dateIso));
  return { weekStart, weekEnd: addDaysIso(weekStart, 6) };
}

export function isWeekdayIso(iso: string): boolean {
  return isoWeekday(iso) <= 5;
}

/** Inclusive list of every `YYYY-MM-DD` date between `startIso` and `endIso`. */
export function enumerateDates(startIso: string, endIso: string): string[] {
  const start = parseIsoDate(startIso).getTime();
  const days = Math.round((parseIsoDate(endIso).getTime() - start) / DAY_MS);
  if (days < 0) return [];
  return Array.from({ length: days + 1 }, (_, i) => toIsoDate(new Date(start + i * DAY_MS)));
}

/** The earlier of two `YYYY-MM-DD` dates. */
export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function lastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Number of days in a month (1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Turns a date-prefix search ("2026", "2026-07", "2026-07-26") into an
 * inclusive `YYYY-MM-DD` range. Returns null for anything else. */
export function datePrefixToRange(search: string): { dateFrom: string; dateTo: string } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(search.trim());
  if (!m) return null;
  const year = Number(m[1]);
  if (m[3]) return { dateFrom: `${m[1]}-${m[2]}-${m[3]}`, dateTo: `${m[1]}-${m[2]}-${m[3]}` };
  if (m[2]) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { dateFrom: firstDayOfMonth(year, month), dateTo: lastDayOfMonth(year, month) };
  }
  return { dateFrom: `${m[1]}-01-01`, dateTo: `${m[1]}-12-31` };
}

/** "HH:mm" wall-clock time of `iso` in `timeZone` (for <input type="time">). */
export function isoToLocalHHmm(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "HH:mm");
}

/** The instant for wall-clock `hhmm` on `dateIso` in `timeZone`, as UTC ISO. */
export function localDateTimeToIso(dateIso: string, hhmm: string, timeZone: string): string {
  return fromZonedTime(`${dateIso}T${hhmm}:00`, timeZone).toISOString();
}

/** Minutes since local midnight (0–1439) of `instant` in `timeZone`. */
export function minutesOfDay(instant: Date, timeZone: string): number {
  const [h, m] = formatInTimeZone(instant, timeZone, "H:m").split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** "H:MM:SS" for a live timer (hours not zero-padded). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
