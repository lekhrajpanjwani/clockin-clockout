import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Coffee, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Skeleton } from "../../../components/ui/skeleton";
import { useCorrectDay, useDay } from "../hooks/useDay";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { computeDayTotals, validateCorrection } from "../../../lib/shared/aggregate/day";
import { formatMinutesAsHours, parseIsoDate } from "../../../lib/shared/time/attendance";
import { ApiError } from "../../../services/httpClient";
import { crossesMidnight, emptyBreak, emptySession, fromDraft, toDraft, type DraftSession } from "./draft";

interface CorrectionDialogProps {
  date: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NextDay({ show }: { show: boolean }) {
  return show ? (
    <span className="text-[10px] font-semibold uppercase text-muted-foreground">+1 day</span>
  ) : null;
}

/** Edit a day's sessions and breaks (wall-clock times in the day's timezone),
 * with live totals and the same validation the server applies. */
export function CorrectionDialog({ date, open, onOpenChange }: CorrectionDialogProps) {
  const browserTz = useLocalTimezone();
  const { data, isLoading } = useDay(date, open);
  const correct = useCorrectDay(date);
  const [draft, setDraft] = useState<DraftSession[]>([]);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const tz = data?.day?.timezone ?? browserTz;
  const status = data?.day?.status;
  const blocked =
    status === "working" || status === "on_break"
      ? "This day has an open session. Clock out first, then correct it."
      : status === "leave"
        ? "This day is marked as leave. Cancel the leave before adding times."
        : null;

  useEffect(() => {
    if (!open || !data) return;
    setDraft(data.sessions.length ? toDraft(data.sessions, tz) : [emptySession()]);
    setReason("");
    setTouched(false);
    correct.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed only when the loaded day changes
  }, [open, data]);

  const converted = useMemo(() => fromDraft(draft, date, tz), [draft, date, tz]);
  const issues = useMemo(
    () =>
      converted.ok
        ? validateCorrection(converted.sessions, { workDate: date, timezone: tz, now: new Date() })
        : [],
    [converted, date, tz],
  );
  const totals = converted.ok
    ? computeDayTotals(
        converted.sessions.map((s) => ({ ...s, breaks: s.breaks.map((b, i) => ({ id: String(i), ...b })) })),
      )
    : null;
  const reasonOk = reason.trim().length >= 3;
  const removing = draft.length === 0 && Boolean(data?.day);
  const canSave =
    !blocked && converted.ok && issues.length === 0 && reasonOk && (draft.length > 0 || removing);

  const updateSession = (key: string, patch: Partial<DraftSession>) =>
    setDraft((d) => d.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const save = () => {
    setTouched(true);
    if (!canSave || !converted.ok) return;
    correct.mutate(
      { timezone: tz, sessions: converted.sessions, reason: reason.trim() },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const title = parseIsoDate(date).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.day ? "Correct" : "Add"} attendance</DialogTitle>
          <DialogDescription>
            {title} · times in {tz}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : blocked ? (
          <p className="flex items-start gap-2 rounded-md bg-status-warn-bg p-3 text-sm text-status-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {blocked}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data?.day?.needsReview && (
              <p className="flex items-start gap-2 rounded-md bg-status-warn-bg p-3 text-sm text-status-warn">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                This day was left open and auto-closed at 23:59. Set the real clock-out time.
              </p>
            )}

            {draft.map((s, i) => {
              const sessionIssues = issues.filter((x) => x.session === i);
              return (
                <fieldset
                  key={s.key}
                  className="rounded-lg border border-border p-3"
                  aria-label={`Session ${i + 1}`}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <legend className="w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Session {i + 1}
                    </legend>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`${s.key}-in`} className="text-xs">
                        Clock in
                      </Label>
                      <Input
                        id={`${s.key}-in`}
                        type="time"
                        value={s.clockIn}
                        onChange={(e) => updateSession(s.key, { clockIn: e.target.value })}
                        className="w-32"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`${s.key}-out`} className="flex items-center gap-2 text-xs">
                        Clock out <NextDay show={crossesMidnight(s.clockIn, s.clockOut)} />
                      </Label>
                      <Input
                        id={`${s.key}-out`}
                        type="time"
                        value={s.clockOut}
                        onChange={(e) => updateSession(s.key, { clockOut: e.target.value })}
                        className="w-32"
                      />
                    </div>
                    <div className="ml-auto flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSession(s.key, { breaks: [...s.breaks, emptyBreak()] })}
                      >
                        <Coffee />
                        Add break
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove session ${i + 1}`}
                        onClick={() => setDraft((d) => d.filter((x) => x.key !== s.key))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  {s.breaks.map((b, j) => (
                    <div
                      key={b.key}
                      className="mt-3 flex flex-wrap items-end gap-3 border-l-2 border-primary pl-3"
                    >
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`${b.key}-s`} className="text-xs">
                          Break {j + 1} start <NextDay show={crossesMidnight(s.clockIn, b.start)} />
                        </Label>
                        <Input
                          id={`${b.key}-s`}
                          type="time"
                          value={b.start}
                          onChange={(e) =>
                            updateSession(s.key, {
                              breaks: s.breaks.map((x) =>
                                x.key === b.key ? { ...x, start: e.target.value } : x,
                              ),
                            })
                          }
                          className="w-32"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`${b.key}-e`} className="text-xs">
                          Break {j + 1} end <NextDay show={crossesMidnight(s.clockIn, b.end)} />
                        </Label>
                        <Input
                          id={`${b.key}-e`}
                          type="time"
                          value={b.end}
                          onChange={(e) =>
                            updateSession(s.key, {
                              breaks: s.breaks.map((x) =>
                                x.key === b.key ? { ...x, end: e.target.value } : x,
                              ),
                            })
                          }
                          className="w-32"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove break ${j + 1}`}
                        onClick={() =>
                          updateSession(s.key, { breaks: s.breaks.filter((x) => x.key !== b.key) })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}

                  {(sessionIssues.length > 0 || (!converted.ok && converted.session === i && touched)) && (
                    <ul className="mt-2 text-xs text-status-warn">
                      {!converted.ok && converted.session === i && <li>{converted.message}</li>}
                      {sessionIssues.map((x) => (
                        <li key={x.code + x.message}>{x.message}</li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              );
            })}

            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft((d) => [...d, emptySession()])}
              className="self-start"
            >
              <Plus />
              Add session
            </Button>

            {issues
              .filter((x) => x.session === undefined)
              .map((x) => (
                <p key={x.code + x.message} className="text-sm text-status-warn">
                  {x.message}
                </p>
              ))}

            <div className="flex flex-wrap gap-6 rounded-md bg-muted p-3 text-sm">
              {removing ? (
                <span className="font-semibold text-status-warn">
                  Saving with no sessions removes this day's attendance.
                </span>
              ) : (
                <>
                  <span>
                    Worked{" "}
                    <strong className="tabular-nums">
                      {totals ? formatMinutesAsHours(totals.workedMinutes) : "—"}
                    </strong>
                  </span>
                  <span>
                    Breaks{" "}
                    <strong className="tabular-nums">
                      {totals ? formatMinutesAsHours(totals.breakMinutes) : "—"}
                    </strong>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="correction-reason">Reason (required)</Label>
              <Textarea
                id="correction-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Forgot to clock out; left at 6:10 PM"
                maxLength={500}
              />
              {touched && !reasonOk && (
                <span className="text-xs text-status-warn">
                  Please give a reason (at least 3 characters).
                </span>
              )}
            </div>

            {correct.error && (
              <p className="text-sm text-status-warn" role="alert">
                {correct.error instanceof ApiError ? correct.error.message : "Could not save the correction."}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!blocked && (
            <Button
              onClick={save}
              disabled={isLoading || correct.isPending || (touched && !canSave)}
              variant={removing ? "destructive" : "default"}
            >
              {correct.isPending ? "Saving…" : removing ? "Remove day" : "Save correction"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
