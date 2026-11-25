import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, Search, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { HistoryTable, type SortBy, type SortDir } from "../features/attendance/components/HistoryTable";
import { useAttendanceList } from "../features/attendance/hooks/useAttendanceList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { datePrefixToRange, localDateString } from "../lib/shared/time/attendance";
import { useLocalTimezone } from "../hooks/useLocalTimezone";
import type { AttendanceStatus } from "../lib/shared/types/attendance";

const PAGE_SIZE = 20;

/** Filters live in the URL query string so a filtered view survives reloads
 * and can be bookmarked/shared, and the browser back button works. */
export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const timezone = useLocalTimezone();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = (params.get("status") ?? "") as "" | AttendanceStatus;
  const sortBy = (params.get("sortBy") === "workedMinutes" ? "workedMinutes" : "workDate") as SortBy;
  const sortDir = (params.get("sortDir") === "asc" ? "asc" : "desc") as SortDir;
  const needsReview = params.get("needsReview") === "true";
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim(), 350);
  const searchValid = search === "" || datePrefixToRange(search) !== null;

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    setParams(next, { replace: true });
  };

  const { data, isLoading, isError, isFetching, refetch } = useAttendanceList({
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir,
    ...(status ? { status } : {}),
    ...(needsReview ? { needsReview: true } : {}),
    ...(searchValid && search ? { search } : {}),
  });

  const handleSort = (column: SortBy) => {
    const dir: SortDir = sortBy === column && sortDir === "desc" ? "asc" : "desc";
    update({ sortBy: column, sortDir: dir });
  };

  const hasFilters = Boolean(status || search || needsReview);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        description="Search, filter, and page through your complete attendance record."
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="history-search" className="text-xs font-semibold text-muted-foreground">
            Date
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="history-search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                update({ search: e.target.value.trim() });
              }}
              placeholder="YYYY, YYYY-MM or YYYY-MM-DD"
              className="pl-9"
              aria-invalid={!searchValid}
              aria-describedby={!searchValid ? "history-search-error" : undefined}
            />
          </div>
          {!searchValid && (
            <span id="history-search-error" className="text-xs text-status-warn">
              Use a date prefix like 2026, 2026-07 or 2026-07-26.
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 sm:w-44">
          <label htmlFor="history-status" className="text-xs font-semibold text-muted-foreground">
            Status
          </label>
          <Select id="history-status" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="working">Working</option>
            <option value="on_break">On break</option>
            <option value="leave">Leave</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1 sm:w-44">
          <label htmlFor="history-review" className="text-xs font-semibold text-muted-foreground">
            Show
          </label>
          <Select
            id="history-review"
            value={needsReview ? "true" : ""}
            onChange={(e) => update({ needsReview: e.target.value || null })}
          >
            <option value="">All days</option>
            <option value="true">Needs review</option>
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchInput("");
              update({ search: null, status: null, needsReview: null });
            }}
          >
            <X />
            Clear
          </Button>
        )}
      </Card>

      <Card
        className={"overflow-hidden transition-opacity " + (isFetching && !isLoading ? "opacity-70" : "")}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">Could not load your history.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <History className="size-8 text-muted-foreground" />
            <p className="font-semibold">
              {hasFilters ? "No records match these filters." : "No attendance yet."}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different date or status."
                : "Clock in from the Dashboard to start your history."}
            </p>
          </div>
        ) : (
          <>
            <HistoryTable
              items={data.items}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              todayIso={localDateString(new Date(), timezone)}
            />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              totalItems={data.totalItems}
              pageSize={data.pageSize}
              onPageChange={(p) => update({ page: String(p) }, false)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
