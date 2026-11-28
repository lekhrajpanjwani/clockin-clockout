import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useAttendanceList } from "../hooks/useAttendanceList";
import { StatusBadge, type BadgeStatus } from "./StatusBadge";
import { formatMinutesAsHours, localTimeString, parseIsoDate } from "../../../lib/shared/time/attendance";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";
import { ROUTES } from "../../../constants/routes";
import { cn } from "../../../utils/cn";

const PARAMS = { page: 1, pageSize: 6, sortBy: "workDate", sortDir: "desc" } as const;

function badgeFor(r: AttendanceRecord): BadgeStatus {
  if (r.needsReview) return "review";
  return r.status;
}

/** The last few days before today, bars compared with each other. */
export function RecentDays({ todayIso }: { todayIso: string }) {
  const { data, isLoading } = useAttendanceList(PARAMS);
  const rows = (data?.items ?? []).filter((r) => r.workDate < todayIso).slice(0, 5);
  const max = Math.max(60, ...rows.map((r) => r.workedMinutes ?? 0));

  return (
    <Card className="px-2 py-2" aria-label="Recent days">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold">Recent days</h2>
        <Link to={ROUTES.monthlyLogs} className="text-[13px] font-semibold text-primary-ink hover:underline">
          View month
        </Link>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Your previous days will show up here.</p>
      ) : (
        <ul>
          {rows.map((r) => {
            const pct = r.workedMinutes ? Math.max(3, (r.workedMinutes / max) * 100) : 0;
            return (
              <li
                key={r.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 sm:grid-cols-[minmax(110px,1.1fr)_minmax(150px,1.4fr)_minmax(0,3fr)_minmax(70px,0.7fr)_minmax(110px,1fr)]"
              >
                <span className="whitespace-nowrap font-medium">
                  {parseIsoDate(r.workDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="hidden tabular-nums text-muted-foreground sm:inline">
                  {r.clockIn ? localTimeString(new Date(r.clockIn), r.timezone) : "—"} –{" "}
                  {r.clockOut ? localTimeString(new Date(r.clockOut), r.timezone) : "—"}
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-track">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      r.needsReview ? "bg-status-break-fill" : "bg-status-live-fill",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums">
                  {r.status === "leave" ? "—" : formatMinutesAsHours(r.workedMinutes ?? 0)}
                </span>
                <StatusBadge status={badgeFor(r)} className="hidden justify-self-end sm:inline-flex" />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
