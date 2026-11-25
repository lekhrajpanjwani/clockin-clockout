import { useState } from "react";
import { ArrowRight, Coffee, Play, Square, Umbrella } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { ConfirmDialog } from "../../../components/feedback/ConfirmDialog";
import { SessionTimer } from "./SessionTimer";
import { DayTimeline } from "./DayTimeline";
import { useToday } from "../hooks/useToday";
import { useLastSession } from "../hooks/useLastSession";
import { useClockIn } from "../hooks/useClockIn";
import { useClockOut } from "../hooks/useClockOut";
import { useBreakEnd, useBreakStart } from "../hooks/useBreaks";
import { useNowTick } from "../../../hooks/useNowTick";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { useOnlineStatus } from "../../../hooks/useOnlineStatus";
import { liveDayTotals } from "../../../lib/shared/aggregate/day";
import { LeaveDialog } from "../leave/LeaveDialog";
import { CancelLeaveButton } from "../leave/CancelLeaveButton";
import { formatMinutesAsHours, localTimeString } from "../../../lib/shared/time/attendance";

/** What the card shows. `clocked_out` = at least one session today, none open —
 * the user can start another session. */
export type ClockState = "idle" | "working" | "on_break" | "clocked_out" | "leave";

const PILL: Record<ClockState, { label: string; dot: string; pill: string }> = {
  idle: { label: "Not clocked in", dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground" },
  working: {
    label: "Working",
    dot: "bg-status-live animate-pulse-dot",
    pill: "bg-status-live-bg text-status-live",
  },
  on_break: { label: "On break", dot: "bg-primary animate-pulse-dot", pill: "bg-secondary text-foreground" },
  clocked_out: { label: "Clocked out", dot: "bg-status-good", pill: "bg-status-good-bg text-status-good" },
  leave: { label: "On leave", dot: "bg-status-live", pill: "bg-accent text-accent-foreground" },
};

function StatusPill({ state }: { state: ClockState }) {
  const c = PILL[state];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${c.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ClockCard() {
  const timezone = useLocalTimezone();
  const { data, isLoading } = useToday();
  const { data: lastSession } = useLastSession();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const breakStart = useBreakStart();
  const breakEnd = useBreakEnd();
  const now = useNowTick(1000);
  const online = useOnlineStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const record = data?.record ?? null;
  const sessions = data?.sessions ?? [];
  const state: ClockState = !record ? "idle" : record.status === "completed" ? "clocked_out" : record.status;

  const live = liveDayTotals(sessions, now);
  const busy = clockIn.isPending || clockOut.isPending || breakStart.isPending || breakEnd.isPending;
  const disabled = !online || busy;
  const tz = record?.timezone ?? timezone;

  const timerSeconds =
    state === "working"
      ? live.currentSessionSeconds
      : state === "on_break"
        ? live.currentBreakSeconds
        : live.workedSeconds;
  const timerCaption = {
    idle: "Timer starts when you clock in",
    working: `Current session — live${sessions.length > 1 ? ` (session ${sessions.length})` : ""}`,
    on_break: "Break — live",
    clocked_out: "Worked today",
    leave: "No attendance on leave days",
  }[state];

  // First in / last out of today; before today's first clock-in, fall back to the previous day.
  const firstIn = record?.clockIn ?? (state === "idle" ? lastSession?.clockIn : null) ?? null;
  const lastOut = record ? record.clockOut : (lastSession?.clockOut ?? null);
  const fmt = (iso: string | null, zone: string) => (iso ? localTimeString(new Date(iso), zone) : "—");
  const fallbackTz = record ? tz : (lastSession?.timezone ?? tz);

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-10 w-40" />
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(420px 220px at 100% 0%, rgba(192, 138, 62, 0.12), transparent 70%)",
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
          <h2 className="mt-1 font-display text-xl font-bold">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </h2>
        </div>
        <StatusPill state={state} />
      </div>

      {state === "leave" ? (
        <div className="relative mt-5 flex items-start gap-3 rounded-lg bg-accent p-4">
          <Umbrella className="mt-0.5 size-5 shrink-0 text-status-live" />
          <div>
            <p className="font-semibold">You're on leave today.</p>
            {record?.leaveReason && <p className="text-sm text-muted-foreground">{record.leaveReason}</p>}
          </div>
          {record && (
            <CancelLeaveButton
              date={record.workDate}
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!online}
            />
          )}
        </div>
      ) : (
        <>
          <SessionTimer seconds={timerSeconds} className="relative mt-5" />
          <p className="relative mt-1 text-sm text-muted-foreground">{timerCaption}</p>

          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            {(state === "idle" || state === "clocked_out") && (
              <Button size="lg" onClick={() => clockIn.mutate()} disabled={disabled}>
                <ArrowRight />
                {clockIn.isPending ? "Clocking in…" : state === "clocked_out" ? "Clock In again" : "Clock In"}
              </Button>
            )}
            {state === "idle" && (
              <Button size="lg" variant="ghost" onClick={() => setLeaveOpen(true)} disabled={disabled}>
                <Umbrella />
                Mark leave
              </Button>
            )}
            {state === "working" && (
              <Button size="lg" variant="secondary" onClick={() => breakStart.mutate()} disabled={disabled}>
                <Coffee />
                {breakStart.isPending ? "Starting…" : "Start Break"}
              </Button>
            )}
            {state === "on_break" && (
              <Button size="lg" onClick={() => breakEnd.mutate()} disabled={disabled}>
                <Play />
                {breakEnd.isPending ? "Ending…" : "End Break"}
              </Button>
            )}
            {(state === "working" || state === "on_break") && (
              <Button
                size="lg"
                variant={state === "on_break" ? "outline" : "destructive"}
                onClick={() => setConfirmOpen(true)}
                disabled={disabled}
              >
                <Square />
                Clock Out
              </Button>
            )}
          </div>
          {state === "clocked_out" && record?.clockOut && (
            <p className="relative mt-2 text-xs text-muted-foreground">
              Clocked out at {fmt(record.clockOut, tz)}. You can start another session any time today.
            </p>
          )}
        </>
      )}

      {sessions.length > 0 && (
        <div className="relative mt-6">
          <DayTimeline sessions={sessions} timezone={tz} now={now} />
        </div>
      )}

      <div className="relative mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <Stat label={record ? "First clock in" : "Last clock in"} value={fmt(firstIn, fallbackTz)} />
        <Stat label="Last clock out" value={fmt(lastOut, fallbackTz)} />
        <Stat label="Worked today" value={formatMinutesAsHours(Math.floor(live.workedSeconds / 60))} />
        <Stat label="Breaks today" value={formatMinutesAsHours(Math.floor(live.breakSeconds / 60))} />
      </div>

      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clock out now?"
        description={`This ends your current session${state === "on_break" ? " and your break" : ""} at ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${tz}). You can clock in again later today.`}
        confirmLabel="Clock Out"
        variant="destructive"
        confirming={clockOut.isPending}
        onConfirm={() => clockOut.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}
      />
    </Card>
  );
}
