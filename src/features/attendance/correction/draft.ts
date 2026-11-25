import type { AttendanceSession } from "../../../lib/shared/types/attendance";
import type { CorrectionSession } from "../../../lib/shared/schemas/attendance";
import { addDaysIso, isoToLocalHHmm, localDateTimeToIso } from "../../../lib/shared/time/attendance";

/** Editor state: wall-clock "HH:mm" strings, converted to instants on save. */
export interface DraftBreak {
  key: string;
  start: string;
  end: string;
}
export interface DraftSession {
  key: string;
  clockIn: string;
  clockOut: string;
  breaks: DraftBreak[];
}

let counter = 0;
export const newKey = () => `k${++counter}`;

export function emptySession(): DraftSession {
  return { key: newKey(), clockIn: "", clockOut: "", breaks: [] };
}

export function emptyBreak(): DraftBreak {
  return { key: newKey(), start: "", end: "" };
}

export function toDraft(sessions: AttendanceSession[], timezone: string): DraftSession[] {
  return sessions.map((s) => ({
    key: newKey(),
    clockIn: isoToLocalHHmm(s.clockIn, timezone),
    clockOut: s.clockOut ? isoToLocalHHmm(s.clockOut, timezone) : "",
    breaks: s.breaks.map((b) => ({
      key: newKey(),
      start: isoToLocalHHmm(b.breakStart, timezone),
      end: b.breakEnd ? isoToLocalHHmm(b.breakEnd, timezone) : "",
    })),
  }));
}

/** A time earlier than the session's clock-in is read as the next calendar
 * day, so a 22:00 → 02:00 night session needs no extra input. */
export function crossesMidnight(clockIn: string, time: string): boolean {
  return Boolean(clockIn && time && time < clockIn);
}

export type DraftResult =
  { ok: true; sessions: CorrectionSession[] } | { ok: false; message: string; session: number };

/** Converts the editor state to API input; reports the first blank time. */
export function fromDraft(draft: DraftSession[], workDate: string, timezone: string): DraftResult {
  const sessions: CorrectionSession[] = [];
  for (const [i, s] of draft.entries()) {
    if (!s.clockIn || !s.clockOut)
      return { ok: false, message: "Fill in both clock-in and clock-out.", session: i };
    const at = (time: string) =>
      localDateTimeToIso(
        crossesMidnight(s.clockIn, time) ? addDaysIso(workDate, 1) : workDate,
        time,
        timezone,
      );
    const breaks = [];
    for (const b of s.breaks) {
      if (!b.start || !b.end) return { ok: false, message: "Fill in both break times.", session: i };
      breaks.push({ breakStart: at(b.start), breakEnd: at(b.end) });
    }
    sessions.push({
      clockIn: localDateTimeToIso(workDate, s.clockIn, timezone),
      clockOut: at(s.clockOut),
      breaks,
    });
  }
  return { ok: true, sessions };
}
