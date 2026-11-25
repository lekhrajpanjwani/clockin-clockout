import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { YearMonthPicker } from "../features/attendance/components/YearMonthPicker";
import { ExportButton } from "../features/attendance/components/ExportButton";
import { ReportSummary } from "../features/attendance/components/ReportSummary";
import { HoursChart, type ChartBar } from "../features/attendance/components/HoursChart";
import { HeatmapCalendar } from "../features/attendance/components/HeatmapCalendar";
import { useReport } from "../features/attendance/hooks/useReport";
import { useYearlyRecords } from "../features/attendance/hooks/useYearlyRecords";
import { useLocalTimezone } from "../hooks/useLocalTimezone";
import { minutesByDate } from "../lib/shared/aggregate/attendance";
import {
  enumerateDates,
  firstDayOfMonth,
  lastDayOfMonth,
  localDateString,
  parseIsoDate,
} from "../lib/shared/time/attendance";

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function ReportsPage() {
  const timezone = useLocalTimezone();
  const todayIso = localDateString(new Date(), timezone);
  const [year, setYear] = useState(Number(todayIso.slice(0, 4)));
  const [month, setMonth] = useState<number | null>(Number(todayIso.slice(5, 7)));

  const report = useReport(year, month ?? undefined);
  const yearly = useYearlyRecords(year);
  const byDate = useMemo(() => minutesByDate(yearly.data ?? []), [yearly.data]);
  const leaveDates = useMemo(
    () => new Set((yearly.data ?? []).filter((r) => r.status === "leave").map((r) => r.workDate)),
    [yearly.data],
  );

  const bars: ChartBar[] = useMemo(() => {
    if (month !== null) {
      return enumerateDates(firstDayOfMonth(year, month), lastDayOfMonth(year, month)).map((d) => ({
        key: d,
        label: String(Number(d.slice(8))),
        minutes: byDate.get(d) ?? 0,
        title: parseIsoDate(d).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }),
      }));
    }
    return MONTH_LABELS.map((label, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, "0")}`;
      let minutes = 0;
      for (const [d, m] of byDate) if (d.startsWith(prefix)) minutes += m;
      return {
        key: prefix,
        label,
        minutes,
        title: parseIsoDate(`${prefix}-01`).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
      };
    });
  }, [year, month, byDate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Reports"
          description="Working days, total and average hours, longest/shortest days, and missed days."
        />
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <YearMonthPicker
            year={year}
            month={month}
            allowFullYear
            onChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />
          <ExportButton year={year} month={month ?? undefined} />
        </div>
      </div>

      {report.isError ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Could not load this report. Please try again.
        </Card>
      ) : (
        <ReportSummary report={report.data} loading={report.isLoading} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{month !== null ? "Hours per day" : "Hours per month"}</CardTitle>
          <CardDescription>
            {month !== null ? "Dashed line marks an 8-hour day." : `Total hours in each month of ${year}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {yearly.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <HoursChart bars={bars} {...(month !== null ? { targetMinutes: 480 } : {})} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{year} at a glance</CardTitle>
          <CardDescription>Each square is a day; stronger color means more hours worked.</CardDescription>
        </CardHeader>
        <CardContent>
          {yearly.isLoading ? (
            <Skeleton className="h-[110px] w-full" />
          ) : (
            <HeatmapCalendar year={year} minutesByDate={byDate} todayIso={todayIso} leaveDates={leaveDates} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
