import { useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import { ClockCard } from "../features/attendance/components/ClockCard";
import { StatCard } from "../features/attendance/components/StatCard";
import { ReviewBanner } from "../features/attendance/components/ReviewBanner";
import { useMonthly } from "../features/attendance/hooks/useMonthly";
import { formatMinutesAsHours, localDateString } from "../lib/shared/time/attendance";
import { useLocalTimezone } from "../hooks/useLocalTimezone";

export function DashboardPage() {
  const timezone = useLocalTimezone();
  const now = useMemo(() => new Date(), []);
  // Local calendar date — NOT `toISOString()`, which is UTC and picks the
  // wrong day (and week/month) between local midnight and the UTC offset,
  // e.g. 00:00–05:30 in IST.
  const todayIso = localDateString(now, timezone);
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));

  const { data: monthly, isLoading } = useMonthly(year, month);

  const currentWeek = monthly?.weeklyTotals.find((w) => w.weekStart <= todayIso && todayIso <= w.weekEnd);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Clock in, track today's session, and see your week and month at a glance."
      />

      <ReviewBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClockCard />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatCard
            label="This week"
            value={currentWeek ? formatMinutesAsHours(currentWeek.totalMinutes) : "0h 00m"}
            loading={isLoading}
          />
          <StatCard
            label="This month"
            value={monthly ? formatMinutesAsHours(monthly.monthlyTotalMinutes) : "0h 00m"}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
