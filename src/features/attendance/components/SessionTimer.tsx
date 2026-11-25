import { cn } from "../../../utils/cn";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function SessionTimer({ seconds, className }: { seconds: number; className?: string }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return (
    <div
      className={cn("font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl", className)}
    >
      {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}
