import { StatusBadge } from "./StatusBadge";

/** Marks a day that auto-close ended at 23:59 because it was left open. */
export function ReviewBadge() {
  return (
    <span title="This day was left open and auto-closed at 23:59. Check the clock-out time.">
      <StatusBadge status="review" />
    </span>
  );
}
