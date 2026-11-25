import { cn } from "../../../utils/cn";

type BadgeStatus = "working" | "on_break" | "completed" | "leave" | "missed" | "weekend" | "upcoming";

const STYLES: Record<BadgeStatus, { label: string; className: string }> = {
  working: { label: "Working", className: "bg-status-live-bg text-status-live" },
  on_break: { label: "On break", className: "bg-secondary text-secondary-foreground" },
  completed: { label: "Completed", className: "bg-status-good-bg text-status-good" },
  leave: { label: "Leave", className: "bg-accent text-accent-foreground" },
  missed: { label: "Missed", className: "bg-status-warn-bg text-status-warn" },
  weekend: { label: "Weekend", className: "bg-muted text-muted-foreground" },
  upcoming: { label: "—", className: "text-muted-foreground" },
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.className)}
    >
      {s.label}
    </span>
  );
}
