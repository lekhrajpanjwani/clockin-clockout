import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useAttendanceList } from "../hooks/useAttendanceList";
import { addDaysIso, formatMinutesAsHours, weekBoundsFor } from "../../../lib/shared/time/attendance";
import { cn } from "../../../utils/cn";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** This ISO week (Mon–Sun) as seven bars, scaled to the longest day — no fixed target. */
export function WeekCard({ todayIso }: { todayIso: string }) {
  const { weekStart, weekEnd } = weekBoundsFor(todayIso);
  const { data, isLoading } = useAttendanceList({
    page: 1,
    pageSize: 7,
    sortBy: "workDate",
    sortDir: "asc",
    dateFrom: weekStart,
    dateTo: weekEnd,
  });

  const byDate = new Map((data?.items ?? []).map((r) => [r.workDate, r]));
  const days = DAYS.map((label, i) => {
    const date = addDaysIso(weekStart, i);
    const r = byDate.get(date);
    return {
      label,
      date,
      minutes: r?.workedMinutes ?? 0,
      leave: r?.status === "leave",
      today: date === todayIso,
    };
  });
  const total = days.reduce((s, d) => s + d.minutes, 0);
  const worked = days.filter((d) => d.minutes > 0).length;
  const max = Math.max(60, ...days.map((d) => d.minutes));

  return (
    <Card className="flex flex-col gap-4 p-6" aria-label="This week">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">This week</span>
        {worked > 0 && (
          <span className="text-xs text-muted-foreground">
            avg {formatMinutesAsHours(Math.round(total / worked))} / day
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-9 w-32" />
      ) : (
        <span className="text-[30px] font-semibold tabular-nums leading-none tracking-[-0.03em]">
          {formatMinutesAsHours(total)}
        </span>
      )}
      <div className="grid h-[86px] grid-cols-7 items-end gap-2">
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1.5">
            <div
              title={`${d.label}: ${d.leave ? "leave" : formatMinutesAsHours(d.minutes)}`}
              className={cn(
                "w-full max-w-[22px] rounded-[6px]",
                // Same meaning as everywhere else: teal = worked, brass = leave.
                d.leave ? "bg-primary" : d.minutes ? "bg-status-live-fill" : "bg-track",
              )}
              style={{ height: `${Math.max(4, (d.minutes / max) * 64)}px` }}
            />
            <span
              className={cn(
                "text-[11px] font-medium",
                d.today
                  ? "font-semibold text-foreground underline decoration-2 underline-offset-4"
                  : "text-muted-foreground",
              )}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
