import { useState } from "react";
import { ArrowRight, Coffee, Play, Square, Umbrella } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { ConfirmDialog } from "../../../components/feedback/ConfirmDialog";
import { DayDial } from "./DayDial";
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
import { formatClock, formatMinutesAsHours, localTimeString } from "../../../lib/shared/time/attendance";
import { cn } from "../../../utils/cn";

/** What the card shows. `clocked_out` = at least one session today, none open —
 * the user can start another session. */
export type ClockState = "idle" | "working" | "on_break" | "clocked_out" | "leave";

const PILL: Record<ClockState, { label: string; dot: string; pill: string }> = {
  idle: { label: "Not clocked in", dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground" },
  working: {
    label: "Working",
    dot: "bg-status-live-fill animate-pulse-dot",
    pill: "bg-status-live-bg text-status-live",
  },
  on_break: {
    label: "On break",
    dot: "bg-status-break-fill animate-pulse-dot",
    pill: "bg-status-break-bg text-status-break",
  },
  clocked_out: { label: "Clocked out", dot: "bg-status-good", pill: "bg-status-good-bg text-status-good" },
  leave: { label: "On leave", dot: "bg-primary", pill: "bg-primary-soft text-primary-ink" },
};

function StatusPill({ state }: { state: ClockState }) {
  const c = PILL[state];
  return (
    <span
      className={cn("inline-flex h-7 items-center gap-2 rounded-full px-3 text-[13px] font-semibold", c.pill)}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
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
  const fmt = (iso: string | null | undefined, zone = tz) =>
    iso ? localTimeString(new Date(iso), zone) : "—";

  const openSession = sessions.find((s) => s.clockOut === null);
  const openBreak = openSession?.breaks.find((b) => b.breakEnd === null);

  const dial = {
    idle: { label: "Ready", timer: formatClock(0), caption: "Clock in to start the day" },
    working: {
      label: sessions.length > 1 ? `Session ${sessions.length} · live` : "Current session",
      timer: formatClock(live.currentSessionSeconds),
      caption: `since ${fmt(openSession?.clockIn)}`,
    },
    on_break: {
      label: "Break",
      timer: formatClock(live.currentBreakSeconds),
      caption: `since ${fmt(openBreak?.breakStart)}`,
    },
    clocked_out: {
      label: "Worked today",
      timer: formatClock(live.workedSeconds),
      caption: `${fmt(record?.clockIn)} – ${fmt(record?.clockOut)}`,
    },
    leave: { label: "Leave", timer: "—", caption: "No attendance today" },
  }[state];

  const note = {
    idle: "Nothing logged yet today",
    working: "",
    on_break: "",
    clocked_out: `at ${fmt(record?.clockOut)} · you can start another session`,
    leave: "",
  }[state];

  // Before today's first clock-in, show the previous day's last times.
  const firstIn = record?.clockIn ?? (state === "idle" ? lastSession?.clockIn : null) ?? null;
  const lastOut = record ? record.clockOut : (lastSession?.clockOut ?? null);
  const fallbackTz = record ? tz : (lastSession?.timezone ?? tz);
  const dialLabel = sessions.length
    ? `Today on a 24-hour dial: ${sessions
        .map((s) => `${fmt(s.clockIn)} to ${s.clockOut ? fmt(s.clockOut) : "now"}`)
        .join(", ")}`
    : "Today on a 24-hour dial: no sessions yet";

  if (isLoading) {
    return (
      <Card className="flex flex-wrap items-center gap-9 p-7">
        <Skeleton className="h-[236px] w-[236px] rounded-full" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-12 w-64" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-7 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-6 sm:justify-start">
        <DayDial sessions={sessions} timezone={tz} now={now} label={dialLabel}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {dial.label}
          </span>
          <span className="text-[36px] font-light tabular-nums leading-none tracking-[-0.04em]">
            {dial.timer}
          </span>
          <span className="text-[13px] tabular-nums text-muted-foreground">{dial.caption}</span>
        </DayDial>

        <div className="flex min-w-[260px] flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill state={state} />
            {note && <span className="text-[13px] text-muted-foreground">{note}</span>}
          </div>

          {state === "leave" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Umbrella className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">You're on leave today.</p>
                  {record?.leaveReason && (
                    <p className="text-sm text-muted-foreground">{record.leaveReason}</p>
                  )}
                </div>
              </div>
              {record && (
                <CancelLeaveButton
                  date={record.workDate}
                  variant="outline"
                  className="self-start"
                  disabled={!online}
                />
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-muted-foreground">Worked today</span>
                <span className="text-[32px] font-semibold tabular-nums leading-tight tracking-[-0.03em]">
                  {formatMinutesAsHours(Math.floor(live.workedSeconds / 60))}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {(state === "idle" || state === "clocked_out") && (
                  <Button size="lg" onClick={() => clockIn.mutate()} disabled={disabled}>
                    <ArrowRight />
                    {clockIn.isPending
                      ? "Clocking in…"
                      : state === "clocked_out"
                        ? "Clock in again"
                        : "Clock in"}
                  </Button>
                )}
                {state === "idle" && (
                  <Button size="lg" variant="outline" onClick={() => setLeaveOpen(true)} disabled={disabled}>
                    <Umbrella />
                    Mark leave
                  </Button>
                )}
                {state === "working" && (
                  <Button size="lg" onClick={() => breakStart.mutate()} disabled={disabled}>
                    <Coffee />
                    {breakStart.isPending ? "Starting…" : "Start break"}
                  </Button>
                )}
                {state === "on_break" && (
                  <Button size="lg" onClick={() => breakEnd.mutate()} disabled={disabled}>
                    <Play />
                    {breakEnd.isPending ? "Ending…" : "End break"}
                  </Button>
                )}
                {(state === "working" || state === "on_break") && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setConfirmOpen(true)}
                    disabled={disabled}
                  >
                    <Square className="fill-current" />
                    Clock out
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {sessions.length > 0 && <DayTimeline sessions={sessions} timezone={tz} now={now} />}

      <div className="flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-4">
        <Stat label={record ? "First clock in" : "Last clock in"} value={fmt(firstIn, fallbackTz)} />
        <Stat label="Last clock out" value={fmt(lastOut, fallbackTz)} />
        <Stat label="Breaks today" value={formatMinutesAsHours(Math.round(live.breakSeconds / 60))} />
      </div>

      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clock out now?"
        description={`This ends your current session${state === "on_break" ? " and your break" : ""} at ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${tz}). You can clock in again later today.`}
        confirmLabel="Clock out"
        variant="destructive"
        confirming={clockOut.isPending}
        onConfirm={() => clockOut.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}
      />
    </Card>
  );
}
