import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";
import { formatMinutesAsHours, localTimeString, parseIsoDate } from "../../../lib/shared/time/attendance";
import { StatusBadge } from "./StatusBadge";
import { ReviewBadge } from "./ReviewBadge";
import { DayActions } from "../correction/DayActions";

export type SortBy = "workDate" | "workedMinutes";
export type SortDir = "asc" | "desc";

interface HistoryTableProps {
  items: AttendanceRecord[];
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (column: SortBy) => void;
  todayIso: string;
}

function SortHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortBy;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (c: SortBy) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={"px-4 py-3 " + (align === "right" ? "text-right" : "")}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={
          "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground " +
          (active ? "text-foreground" : "")
        }
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </th>
  );
}

export function HistoryTable({ items, sortBy, sortDir, onSort, todayIso }: HistoryTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SortHeader label="Date" column="workDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3">Clock in</th>
            <th className="px-4 py-3">Clock out</th>
            <SortHeader
              label="Worked"
              column="workedMinutes"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            />
            <th className="hidden px-4 py-3 md:table-cell">Timezone</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-border/60 border-b last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">
                {parseIsoDate(r.workDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </td>
              <td className="px-4 py-2.5 font-mono tabular-nums">
                {r.clockIn ? localTimeString(new Date(r.clockIn), r.timezone) : "—"}
              </td>
              <td className="px-4 py-2.5 font-mono tabular-nums">
                {r.clockOut ? localTimeString(new Date(r.clockOut), r.timezone) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                {r.workedMinutes != null ? formatMinutesAsHours(r.workedMinutes) : "—"}
              </td>
              <td className="hidden px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{r.timezone}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={r.status} />
                  {r.needsReview && <ReviewBadge />}
                  {r.leaveReason && (
                    <span
                      className="max-w-[14rem] truncate text-xs text-muted-foreground"
                      title={r.leaveReason}
                    >
                      {r.leaveReason}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <DayActions date={r.workDate} record={r} todayIso={todayIso} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
