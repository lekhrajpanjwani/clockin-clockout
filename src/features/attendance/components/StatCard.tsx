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
    <Card className={cn("flex flex-col justify-center gap-1 p-5", className)}>
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.02em]">{value}</span>
      )}
      {sub && <span className="text-xs tabular-nums text-muted-foreground">{sub}</span>}
    </Card>
  );
}
