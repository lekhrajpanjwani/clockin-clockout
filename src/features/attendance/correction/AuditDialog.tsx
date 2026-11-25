import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Skeleton } from "../../../components/ui/skeleton";
import { useDayAudit } from "../hooks/useDay";
import type { AttendanceDayDetail, AuditEntry } from "../../../lib/shared/types/attendance";
import { formatMinutesAsHours, localTimeString, parseIsoDate } from "../../../lib/shared/time/attendance";

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  break_start: "Break started",
  break_end: "Break ended",
  auto_close: "Auto-closed",
  regularize: "Corrected",
  leave_mark: "Leave marked",
  leave_cancel: "Leave cancelled",
};

const ACTOR_LABEL: Record<AuditEntry["actor"], string> = {
  user: "You",
  system: "System",
  auto_close: "Auto-close",
};

function summarize(d: AttendanceDayDetail | null): string {
  if (!d) return "no record";
  if (d.day.status === "leave") return `leave${d.day.leaveReason ? ` (${d.day.leaveReason})` : ""}`;
  const tz = d.day.timezone;
  const spans = d.sessions
    .map(
      (s) =>
        `${localTimeString(new Date(s.clockIn), tz)}–${s.clockOut ? localTimeString(new Date(s.clockOut), tz) : "open"}`,
    )
    .join(", ");
  return `${spans || "no sessions"} · ${formatMinutesAsHours(d.day.workedMinutes ?? 0)} worked`;
}

/** Every recorded change to a day — who/what changed it, when, why, and before → after. */
export function AuditDialog({
  date,
  open,
  onOpenChange,
}: {
  date: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading, isError } = useDayAudit(date, open);
  const title = parseIsoDate(date).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change history</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Could not load the change history.</p>
        ) : !data?.items.length ? (
          <p className="text-sm text-muted-foreground">No changes recorded for this day.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
            {data.items.map((e) => (
              <li key={e.id} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary"
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{ACTION_LABEL[e.action]}</span>
                  <span className="text-xs text-muted-foreground">
                    {ACTOR_LABEL[e.actor]} ·{" "}
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {e.reason && <p className="mt-0.5 text-sm italic">“{e.reason}”</p>}
                {(e.action === "regularize" || e.action === "auto_close" || e.action.startsWith("leave")) && (
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                    <dt>Before</dt>
                    <dd className="tabular-nums">{summarize(e.before)}</dd>
                    <dt>After</dt>
                    <dd className="tabular-nums text-foreground">{summarize(e.after)}</dd>
                  </dl>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
