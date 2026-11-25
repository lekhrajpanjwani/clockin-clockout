import { useQuery } from "@tanstack/react-query";
import { getAttendance } from "../api/getAttendance";
import { QUERY_KEYS } from "../../../constants/queryKeys";

const PARAMS = { page: 1, pageSize: 1, sortBy: "workDate", sortDir: "desc" } as const;

/** Most recent attendance record regardless of date — drives the "Last
 * Clock In" / "Last Clock Out" dashboard fields, which should still show
 * yesterday's times before today's first clock-in. */
export function useLastSession() {
  return useQuery({
    queryKey: QUERY_KEYS.list(PARAMS),
    queryFn: () => getAttendance(PARAMS),
    select: (data) => data.items[0] ?? null,
  });
}
