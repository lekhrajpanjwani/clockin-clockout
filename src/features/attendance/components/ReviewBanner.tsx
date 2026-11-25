import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { useAttendanceList } from "../hooks/useAttendanceList";
import { parseIsoDate } from "../../../lib/shared/time/attendance";
import { ROUTES } from "../../../constants/routes";

const PARAMS = { page: 1, pageSize: 5, sortBy: "workDate", sortDir: "desc", needsReview: true } as const;

/** Dashboard nudge listing days that were auto-closed and still need a check. */
export function ReviewBanner() {
  const { data } = useAttendanceList(PARAMS);
  if (!data || data.totalItems === 0) return null;

  const n = data.totalItems;
  const dates = data.items
    .map((r) =>
      parseIsoDate(r.workDate).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    )
    .join(", ");

  return (
    <Card
      className="flex flex-col gap-3 border-transparent bg-status-warn-bg p-4 sm:flex-row sm:items-center"
      role="status"
    >
      <AlertTriangle className="size-5 shrink-0 text-status-warn" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">
          {n === 1 ? "1 day was" : `${n} days were`} left open and auto-closed at 23:59.
        </p>
        <p className="text-muted-foreground">
          {dates}
          {n > data.items.length ? ` and ${n - data.items.length} more` : ""} — check the clock-out time
          {n === 1 ? "" : "s"}.
        </p>
      </div>
      <Link
        to={`${ROUTES.history}?needsReview=true`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-status-warn hover:underline"
      >
        Review
        <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
