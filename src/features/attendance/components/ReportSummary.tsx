import type { AttendanceReport } from "../../../lib/shared/types/attendance";
import { formatMinutesAsHours, parseIsoDate } from "../../../lib/shared/time/attendance";
import { StatCard } from "./StatCard";

function shortDate(iso: string) {
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function ReportSummary({
  report,
  loading,
}: {
  report: AttendanceReport | undefined;
  loading: boolean;
}) {
  const r = report;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        label="Working days"
        value={String(r?.workingDays ?? 0)}
        {...(r?.autoClosedDays ? { sub: `${r.autoClosedDays} auto-closed` } : {})}
        loading={loading}
      />
      <StatCard label="Total hours" value={formatMinutesAsHours(r?.totalMinutes ?? 0)} loading={loading} />
      <StatCard
        label="Average / day"
        value={formatMinutesAsHours(r?.averageMinutesPerDay ?? 0)}
        loading={loading}
      />
      <StatCard
        label="Longest day"
        value={r?.longestDay ? formatMinutesAsHours(r.longestDay.workedMinutes) : "—"}
        {...(r?.longestDay ? { sub: shortDate(r.longestDay.workDate) } : {})}
        loading={loading}
      />
      <StatCard
        label="Shortest day"
        value={r?.shortestDay ? formatMinutesAsHours(r.shortestDay.workedMinutes) : "—"}
        {...(r?.shortestDay ? { sub: shortDate(r.shortestDay.workDate) } : {})}
        loading={loading}
      />
      <StatCard
        label="Missed weekdays"
        value={String(r?.missedDays ?? 0)}
        sub="So far this period"
        loading={loading}
      />
      <StatCard
        label="Leave days"
        value={String(r?.leaveDays ?? 0)}
        sub="Including planned"
        loading={loading}
      />
      <StatCard label="Breaks" value={formatMinutesAsHours(r?.breakMinutes ?? 0)} loading={loading} />
    </div>
  );
}
