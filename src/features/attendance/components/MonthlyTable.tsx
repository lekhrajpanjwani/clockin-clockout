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
  const weekTotalFor = (weekEnd: string) =>
    weeklyTotals.find((w) => w.weekEnd === weekEnd)?.totalMinutes ?? 0;

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Clock in</th>
            <th className="px-4 py-3">Clock out</th>
            <th className="px-4 py-3 text-right">Worked</th>
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
                  className={
                    "border-border/60 border-b " +
                    (day.date === todayIso ? "bg-accent" : "") +
                    (day.weekday >= 6 && !r ? "text-muted-foreground" : "")
                  }
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="font-semibold tabular-nums">{dateLabel}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{WEEKDAY[day.weekday - 1]}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {r?.clockIn ? localTimeString(new Date(r.clockIn), r.timezone) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {r?.clockOut ? localTimeString(new Date(r.clockOut), r.timezone) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {r?.workedMinutes != null ? formatMinutesAsHours(r.workedMinutes) : "—"}
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
                  <td className="px-2 py-1.5">
                    <DayActions date={day.date} record={r} todayIso={todayIso} />
                  </td>
                </tr>
                {isLastOfWeek && (
                  <tr className="border-b border-border bg-muted">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Week total
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">
                      {formatMinutesAsHours(weekTotalFor(weekBoundsFor(day.date).weekEnd))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-4 py-3 font-display font-bold">
              Month total
            </td>
            <td className="px-4 py-3 text-right font-mono text-base font-bold tabular-nums">
              {formatMinutesAsHours(monthlyTotalMinutes)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
