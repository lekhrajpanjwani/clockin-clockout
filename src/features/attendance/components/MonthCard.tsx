import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useMonthly } from "../hooks/useMonthly";
import { formatMinutesAsHours } from "../../../lib/shared/time/attendance";

function Cell({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{value}</span>
      )}
    </div>
  );
}

export function MonthCard({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useMonthly(year, month);
  const days = data?.days ?? [];
  const completed = days.filter((d) => d.status === "completed");
  const avg = completed.length ? Math.round((data?.monthlyTotalMinutes ?? 0) / completed.length) : 0;
  const leave = days.filter((d) => d.status === "leave").length;
  const breaks = days.reduce((s, d) => s + (d.breakMinutes ?? 0), 0);

  return (
    <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-6" aria-label="This month">
      <Cell
        label="This month"
        value={formatMinutesAsHours(data?.monthlyTotalMinutes ?? 0)}
        loading={isLoading}
      />
      <Cell label="Avg / day" value={formatMinutesAsHours(avg)} loading={isLoading} />
      <Cell label="Breaks" value={formatMinutesAsHours(breaks)} loading={isLoading} />
      <Cell label="Leave" value={`${leave} day${leave === 1 ? "" : "s"}`} loading={isLoading} />
    </Card>
  );
}
