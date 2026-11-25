import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button, type ButtonProps } from "../../../components/ui/button";
import { ConfirmDialog } from "../../../components/feedback/ConfirmDialog";
import { useCancelLeave } from "../hooks/useLeave";
import { parseIsoDate } from "../../../lib/shared/time/attendance";

/** "Cancel leave" with a confirmation step. */
export function CancelLeaveButton({
  date,
  compact,
  ...props
}: { date: string; compact?: boolean } & ButtonProps) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelLeave();
  const label = parseIsoDate(date).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <>
      <Button {...props} onClick={() => setOpen(true)} aria-label={`Cancel leave on ${date}`}>
        <Undo2 />
        <span className={compact ? "hidden sm:inline" : undefined}>Cancel leave</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this leave?"
        description={`${label} will be a normal day again. The change is kept in the day's history.`}
        confirmLabel="Cancel leave"
        cancelLabel="Keep leave"
        confirming={cancel.isPending}
        onConfirm={() => cancel.mutate(date, { onSuccess: () => setOpen(false) })}
      />
    </>
  );
}
