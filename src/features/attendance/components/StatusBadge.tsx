import { cn } from "../../../utils/cn";

export type BadgeStatus =
  "working" | "on_break" | "completed" | "leave" | "missed" | "weekend" | "upcoming" | "review";

/** Quiet status label: a coloured dot + text, so the numbers stay the focus. */
const STYLES: Record<BadgeStatus, { label: string; dot: string; text: string }> = {
  working: { label: "Working", dot: "bg-status-live-fill", text: "text-status-live" },
  on_break: { label: "On break", dot: "bg-status-break-fill", text: "text-status-break" },
  completed: { label: "Completed", dot: "bg-status-good", text: "text-status-good" },
  leave: { label: "Leave", dot: "bg-primary", text: "text-primary-ink" },
  missed: { label: "Missed", dot: "bg-status-bad", text: "text-status-bad" },
  weekend: { label: "Weekend", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  upcoming: { label: "—", dot: "bg-transparent", text: "text-muted-foreground" },
  review: { label: "Needs review", dot: "bg-status-break-fill", text: "text-status-warn" },
};

export function StatusBadge({ status, className }: { status: BadgeStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold",
        s.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
