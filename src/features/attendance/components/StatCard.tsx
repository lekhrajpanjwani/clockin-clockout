import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, loading, className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col justify-center gap-1.5 p-5", className)}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <span className="font-display text-2xl font-bold tabular-nums tracking-tight">{value}</span>
      )}
      {sub && <span className="text-xs tabular-nums text-muted-foreground">{sub}</span>}
    </Card>
  );
}
