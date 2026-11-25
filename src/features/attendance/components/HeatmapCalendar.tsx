import {
  addDaysIso,
  enumerateDates,
  formatMinutesAsHours,
  isoWeekday,
  parseIsoDate,
} from "../../../lib/shared/time/attendance";

interface HeatmapCalendarProps {
  year: number;
  minutesByDate: Map<string, number>;
  todayIso: string;
  leaveDates?: Set<string>;
}

function level(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 4 * 60) return 1;
  if (minutes < 7 * 60) return 2;
  if (minutes < 9 * 60) return 3;
  return 4;
}

const LEVEL_OPACITY = [0, 0.3, 0.55, 0.8, 1];

/** GitHub-style year heatmap: one column per ISO week, one row per weekday. */
export function HeatmapCalendar({ year, minutesByDate, todayIso, leaveDates }: HeatmapCalendarProps) {
  const first = `${year}-01-01`;
  const gridStart = addDaysIso(first, 1 - isoWeekday(first));
  const dates = enumerateDates(gridStart, `${year}-12-31`);
  const weeks: string[][] = [];
  dates.forEach((d, i) => {
    const col = Math.floor(i / 7);
    (weeks[col] ??= []).push(d);
  });

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-[3px]" role="grid" aria-label={`Attendance heatmap for ${year}`}>
        {weeks.map((week) => (
          <div key={week[0]} className="flex flex-col gap-[3px]" role="row">
            {week.map((d) => {
              const inYear = d.startsWith(String(year));
              const minutes = minutesByDate.get(d) ?? 0;
              const onLeave = leaveDates?.has(d) ?? false;
              const lvl = onLeave ? 0 : level(minutes);
              const label = `${parseIsoDate(d).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })}: ${
                onLeave ? "leave" : minutes ? formatMinutesAsHours(minutes) : "no session"
              }`;
              return (
                <div
                  key={d}
                  role="gridcell"
                  title={inYear ? label : undefined}
                  aria-label={inYear ? label : undefined}
                  className={
                    "size-[11px] rounded-[3px] " +
                    (!inYear ? "opacity-0" : onLeave ? "bg-primary" : lvl === 0 ? "bg-muted" : "") +
                    (d === todayIso ? " ring-1 ring-ring" : "")
                  }
                  style={
                    lvl > 0 && inYear
                      ? { backgroundColor: "var(--status-live)", opacity: LEVEL_OPACITY[lvl] }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Less
        {LEVEL_OPACITY.map((o, i) => (
          <span
            key={i}
            className={"size-[11px] rounded-[3px] " + (i === 0 ? "bg-muted" : "")}
            style={i > 0 ? { backgroundColor: "var(--status-live)", opacity: o } : undefined}
          />
        ))}
        More
        <span className="ml-3 size-[11px] rounded-[3px] bg-primary" />
        Leave
      </div>
    </div>
  );
}
