import { useMemo, useState } from "react";
import { CalendarX2, Umbrella } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { YearMonthPicker } from "../features/attendance/components/YearMonthPicker";
import { MonthlyTable } from "../features/attendance/components/MonthlyTable";
import { ExportButton } from "../features/attendance/components/ExportButton";
import { StatCard } from "../features/attendance/components/StatCard";
import { useMonthly } from "../features/attendance/hooks/useMonthly";
import { LeaveDialog } from "../features/attendance/leave/LeaveDialog";
import { useLocalTimezone } from "../hooks/useLocalTimezone";
import { buildMonthCalendar } from "../lib/shared/aggregate/attendance";
import {
  enumerateDates,
  firstDayOfMonth,
  formatMinutesAsHours,
  lastDayOfMonth,
  localDateString,
} from "../lib/shared/time/attendance";

export function MonthlyLogsPage() {
  const timezone = useLocalTimezone();
  const todayIso = localDateString(new Date(), timezone);
  const [year, setYear] = useState(Number(todayIso.slice(0, 4)));
  const [month, setMonth] = useState(Number(todayIso.slice(5, 7)));

  const { data, isLoading, isError, refetch } = useMonthly(year, month);

  const calendar = useMemo(
    () =>
      buildMonthCalendar(
        enumerateDates(firstDayOfMonth(year, month), lastDayOfMonth(year, month)),
        data?.days ?? [],
      ),
    [year, month, data],
  );

  const completedDays = data?.days.filter((d) => d.status === "completed").length ?? 0;
  const leaveDays = data?.days.filter((d) => d.status === "leave").length ?? 0;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const avg = completedDays ? Math.round((data?.monthlyTotalMinutes ?? 0) / completedDays) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Monthly Logs"
          description="Every day of the month with weekly and monthly totals."
        />
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <YearMonthPicker
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y);
              setMonth(m ?? 1);
            }}
          />
          <Button variant="outline" onClick={() => setLeaveOpen(true)}>
            <Umbrella />
            Mark leave
          </Button>
          <ExportButton year={year} month={month} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total worked"
          value={formatMinutesAsHours(data?.monthlyTotalMinutes ?? 0)}
          loading={isLoading}
        />
        <StatCard label="Days worked" value={String(completedDays)} loading={isLoading} />
        <StatCard label="Average / day" value={formatMinutesAsHours(avg)} loading={isLoading} />
        <StatCard label="Leave days" value={String(leaveDays)} loading={isLoading} />
      </div>

      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarX2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Could not load this month.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <MonthlyTable
            days={calendar}
            weeklyTotals={data?.weeklyTotals ?? []}
            monthlyTotalMinutes={data?.monthlyTotalMinutes ?? 0}
            todayIso={todayIso}
          />
        )}
      </Card>
    </div>
  );
}
