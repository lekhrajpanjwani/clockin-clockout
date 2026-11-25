import { useEffect, useState } from "react";
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
import { useMarkLeave } from "../hooks/useLeave";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { addDaysIso, localDateString } from "../../../lib/shared/time/attendance";
import { ApiError } from "../../../services/httpClient";

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected date; when given the date can't be changed. Defaults to today. */
  date?: string;
}

/** Mark a full day of leave (today or up to a year ahead) with a reason. */
export function LeaveDialog({ open, onOpenChange, date: fixedDate }: LeaveDialogProps) {
  const timezone = useLocalTimezone();
  const today = localDateString(new Date(), timezone);
  const [date, setDate] = useState(fixedDate ?? today);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const mark = useMarkLeave();

  useEffect(() => {
    if (!open) return;
    setDate(fixedDate ?? today);
    setReason("");
    setTouched(false);
    mark.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when (re)opened
  }, [open, fixedDate]);

  const maxDate = addDaysIso(today, 365);
  const dateOk = date >= today && date <= maxDate;
  const reasonOk = reason.trim().length >= 3;

  const submit = () => {
    setTouched(true);
    if (!dateOk || !reasonOk) return;
    mark.mutate({ date, timezone, reason: reason.trim() }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark leave</DialogTitle>
          <DialogDescription>
            A full day off. You won't be able to clock in on that day unless you cancel it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="leave-date">Date</Label>
            <Input
              id="leave-date"
              type="date"
              value={date}
              min={today}
              max={maxDate}
              disabled={Boolean(fixedDate)}
              onChange={(e) => setDate(e.target.value)}
              className="w-48"
            />
            {touched && !dateOk && (
              <span className="text-xs text-status-warn">Pick today or a date within the next year.</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Family function, doctor's appointment, personal day"
              maxLength={500}
            />
            {touched && !reasonOk && (
              <span className="text-xs text-status-warn">Please give a reason (at least 3 characters).</span>
            )}
          </div>
          {mark.error && (
            <p className="text-sm text-status-warn" role="alert">
              {mark.error instanceof ApiError ? mark.error.message : "Could not mark leave."}
            </p>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mark.isPending}>
              {mark.isPending ? "Saving…" : "Mark leave"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
