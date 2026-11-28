import { ClockCard } from "../features/attendance/components/ClockCard";
import { ReviewBanner } from "../features/attendance/components/ReviewBanner";
import { WeekCard } from "../features/attendance/components/WeekCard";
import { MonthCard } from "../features/attendance/components/MonthCard";
import { RecentDays } from "../features/attendance/components/RecentDays";
import { localDateString, parseIsoDate } from "../lib/shared/time/attendance";
import { useLocalTimezone } from "../hooks/useLocalTimezone";
import { useNowTick } from "../hooks/useNowTick";

function greeting(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const timezone = useLocalTimezone();
  // Re-evaluated every minute so the date/greeting roll over at midnight.
  const now = useNowTick(60_000);
  // Local calendar date — NOT `toISOString()`, which is UTC and picks the
  // wrong day (and week/month) between local midnight and the UTC offset.
  const todayIso = localDateString(now, timezone);
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-muted-foreground">
          {parseIsoDate(todayIso).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </span>
        <h1 className="text-[26px] font-semibold">{greeting(now.getHours())}</h1>
      </header>

      <ReviewBanner />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ClockCard />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <WeekCard todayIso={todayIso} />
          <MonthCard year={year} month={month} />
        </div>
      </div>

      <RecentDays todayIso={todayIso} />
    </div>
  );
}
