import { getTimezoneOffset } from "date-fns-tz";
import { Coffee } from "lucide-react";
import type { AttendanceSession } from "../../../lib/shared/types/attendance";
import { formatMinutesAsHours, localTimeString } from "../../../lib/shared/time/attendance";
import { cn } from "../../../utils/cn";

const HOUR = 3_600_000;

/** Start of the local hour containing `ms` in `timeZone` (works for :30/:45 offsets too). */
function floorLocalHour(ms: number, timeZone: string): number {
  const offset = getTimezoneOffset(timeZone, new Date(ms));
  return ms - ((((ms + offset) % HOUR) + HOUR) % HOUR);
}

function hourLabel(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", timeZone });
}

interface DayTimelineProps {
  sessions: AttendanceSession[];
  timezone: string;
  now: Date;
}

/** Horizontal bar of the day's sessions (teal) with breaks cut out (brass),
 * plus a compact list underneath. An open session/break runs up to "now". */
export function DayTimeline({ sessions, timezone, now }: DayTimelineProps) {
  if (sessions.length === 0) return null;

  const nowMs = now.getTime();
  const endOf = (iso: string | null) => (iso ? Date.parse(iso) : nowMs);
  const firstIn = Math.min(...sessions.map((s) => Date.parse(s.clockIn)));
  const lastOut = Math.max(...sessions.map((s) => endOf(s.clockOut)));

  const start = floorLocalHour(firstIn, timezone);
  const end = Math.max(floorLocalHour(lastOut, timezone) + HOUR, start + 4 * HOUR);
  const span = end - start;
  const pct = (ms: number) => `${((ms - start) / span) * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(b - a, 0) / span) * 100}%`;
  const ticks = Array.from({ length: Math.round(span / HOUR) + 1 }, (_, i) => start + i * HOUR);
  const labelEvery = ticks.length > 9 ? 2 : 1;
  const isOpen = sessions.some((s) => s.clockOut === null);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          className="relative h-7 overflow-hidden rounded-md bg-muted"
          role="img"
          aria-label={`Timeline: ${sessions.length} session${sessions.length > 1 ? "s" : ""} today`}
        >
          {sessions.map((s) => {
            const a = Date.parse(s.clockIn);
            const b = endOf(s.clockOut);
            return (
              <div
                key={s.id}
                className={cn("absolute inset-y-0 bg-status-live", s.clockOut === null && "opacity-80")}
                style={{ left: pct(a), width: width(a, b) }}
              >
                {s.breaks.map((br) => {
                  const bs = Date.parse(br.breakStart);
                  const be = endOf(br.breakEnd);
                  return (
                    <div
                      key={br.id}
                      className="absolute inset-y-0 bg-primary"
                      style={{
                        left: `${((bs - a) / Math.max(b - a, 1)) * 100}%`,
                        width: `${((be - bs) / Math.max(b - a, 1)) * 100}%`,
                        backgroundImage:
                          "repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,0.25) 4px 8px)",
                      }}
                      title={`Break ${localTimeString(new Date(bs), timezone)} – ${
                        br.breakEnd ? localTimeString(new Date(be), timezone) : "now"
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
          {isOpen && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground"
              style={{ left: pct(nowMs) }}
              aria-hidden
            />
          )}
        </div>
        <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
          {ticks.map((t, i) =>
            i % labelEvery === 0 ? (
              <span
                key={t}
                className={cn(
                  "absolute whitespace-nowrap tabular-nums",
                  i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: pct(t) }}
              >
                {hourLabel(t, timezone)}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <ol className="flex flex-col gap-1.5 text-sm">
        {sessions.map((s, i) => {
          const minutes = Math.round((endOf(s.clockOut) - Date.parse(s.clockIn)) / 60000);
          const breakMin = s.breaks.reduce(
            (sum, b) => sum + Math.round((endOf(b.breakEnd) - Date.parse(b.breakStart)) / 60000),
            0,
          );
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="w-20 text-xs font-semibold text-muted-foreground">Session {i + 1}</span>
              <span className="font-mono tabular-nums">
                {localTimeString(new Date(s.clockIn), timezone)} –{" "}
                {s.clockOut ? localTimeString(new Date(s.clockOut), timezone) : "now"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatMinutesAsHours(Math.max(0, minutes - breakMin))}
              </span>
              {s.breaks.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Coffee className="size-3.5" />
                  {s.breaks.length} break{s.breaks.length > 1 ? "s" : ""} · {formatMinutesAsHours(breakMin)}
                </span>
              )}
              {s.closedBy === "auto" && (
                <span className="rounded-full bg-status-warn-bg px-2 py-0.5 text-xs font-semibold text-status-warn">
                  Auto-closed
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
