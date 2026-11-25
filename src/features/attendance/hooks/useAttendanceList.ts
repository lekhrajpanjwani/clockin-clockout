import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAttendance, type AttendanceListParams } from "../api/getAttendance";
import { QUERY_KEYS } from "../../../constants/queryKeys";

export function useAttendanceList(params: AttendanceListParams) {
  return useQuery({
    queryKey: QUERY_KEYS.list({ ...params }),
    queryFn: () => getAttendance(params),
    // Keep the current page on screen while the next one loads — avoids the
    // table collapsing to a skeleton on every page/filter change.
    placeholderData: keepPreviousData,
  });
}
