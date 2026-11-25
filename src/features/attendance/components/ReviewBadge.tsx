import { AlertTriangle } from "lucide-react";

/** Marks a day that auto-close ended at 23:59 because it was left open. */
export function ReviewBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-status-warn-bg px-2.5 py-0.5 text-xs font-semibold text-status-warn"
      title="This day was left open and auto-closed at 23:59. Check the clock-out time."
    >
      <AlertTriangle className="size-3" />
      Needs review
    </span>
  );
}
