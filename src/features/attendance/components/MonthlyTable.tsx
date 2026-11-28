import { Fragment } from "react";
import type { CalendarDay } from "../../../lib/shared/aggregate/attendance";
import type { WeeklyTotal } from "../../../lib/shared/types/attendance";
import {
  formatMinutesAsHours,
  localTimeString,
  parseIsoDate,
  weekBoundsFor,
} from "../../../lib/shared/time/attendance";
import { StatusBadge } from "./StatusBadge";
import { ReviewBadge } from "./ReviewBadge";
import { DayActions } from "../correction/DayActions";
import { cn } from "../../../utils/cn";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthlyTableProps {
  days: CalendarDay[];
  weeklyTotals: WeeklyTotal[];
  monthlyTotalMinutes: number;
  todayIso: string;
}

function dayStatus(day: CalendarDay, todayIso: string) {
  if (day.record) return day.record.status;
  if (day.weekday >= 6) return "weekend" as const;
  if (day.date >= todayIso) return "upcoming" as const;
  return "missed" as const;
}

export function MonthlyTable({ days, weeklyTotals, monthlyTotalMinutes, todayIso }: MonthlyTableProps) {
  const maxMinutes = Math.max(60, ...days.map((d) => d.record?.workedMinutes ?? 0));
  const weekTotalFor = (weekEnd: string) =>
    weeklyTotals.find((w) => w.weekEnd === weekEnd)?.totalMinutes ?? 0;

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Clock in</th>
            <th className="px-4 py-3">Clock out</th>
            <th className="px-4 py-3 text-right">Worked</th>
            <th className="hidden w-[22%] px-4 py-3 md:table-cell">
              <span className="sr-only">Hours bar</span>
            </th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const r = day.record;
            const isLastOfWeek = day.weekday === 7 || i === days.length - 1;
            const status = dayStatus(day, todayIso);
            const dateLabel = parseIsoDate(day.date).toLocaleDateString(undefined, {
              day: "2-digit",
              month: "short",
              timeZone: "UTC",
            });
            return (
              <Fragment key={day.date}>
                <tr
                  className={cn(
                    "hover:bg-muted/50 group border-t border-border transition-colors",
                    day.date === todayIso && "bg-primary-soft hover:bg-primary-soft",
                    day.weekday >= 6 && !r && "text-muted-foreground",
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="font-semibold tabular-nums">{dateLabel}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{WEEKDAY[day.weekday - 1]}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {r?.clockIn ? localTimeString(new Date(r.clockIn), r.timezone) : "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {r?.clockOut ? localTimeString(new Date(r.clockOut), r.timezone) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r?.workedMinutes != null && r.status !== "leave"
                      ? formatMinutesAsHours(r.workedMinutes)
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-2.5 md:table-cell">
                    {r?.workedMinutes ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-track">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            r.needsReview ? "bg-status-break-fill" : "bg-status-live-fill",
                          )}
                          style={{ width: `${Math.max(3, (r.workedMinutes / maxMinutes) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={status} />
                      {r?.needsReview && <ReviewBadge />}
                      {r?.leaveReason && (
                        <span
                          className="max-w-[14rem] truncate text-xs text-muted-foreground"
                          title={r.leaveReason}
                        >
                          {r.leaveReason}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 transition-opacity md:opacity-60 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <DayActions date={day.date} record={r} todayIso={todayIso} />
                  </td>
                </tr>
                {isLastOfWeek && (
                  <tr className="border-t border-border">
                    <td colSpan={3} className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      Week total
                    </td>
                    <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatMinutesAsHours(weekTotalFor(weekBoundsFor(day.date).weekEnd))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td colSpan={3} className="px-4 py-3 font-semibold">
              Month total
            </td>
            <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">
              {formatMinutesAsHours(monthlyTotalMinutes)}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
