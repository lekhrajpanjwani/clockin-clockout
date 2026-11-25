import { useQuery } from "@tanstack/react-query";
import { getAttendance } from "../api/getAttendance";
import { QUERY_KEYS } from "../../../constants/queryKeys";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";

/** Every record in a year (max ~366), for the heatmap and the hours chart.
 * Uses the paginated list endpoint at its 100-row cap, fetching up to 4 pages. */
export function useYearlyRecords(year: number) {
  return useQuery({
    queryKey: QUERY_KEYS.list({ scope: "year", year }),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const base = {
        pageSize: 100,
        sortBy: "workDate",
        sortDir: "asc",
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
      } as const;
      const first = await getAttendance({ ...base, page: 1 });
      const rest = await Promise.all(
        Array.from({ length: Math.min(first.totalPages, 4) - 1 }, (_, i) =>
          getAttendance({ ...base, page: i + 2 }),
        ),
      );
      return [first, ...rest].flatMap((p) => p.items);
    },
  });
}
