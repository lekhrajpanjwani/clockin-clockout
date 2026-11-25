import { useQuery } from "@tanstack/react-query";
import { getReport } from "../api/getReport";
import { QUERY_KEYS } from "../../../constants/queryKeys";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";

export function useReport(year: number, month?: number) {
  const timezone = useLocalTimezone();
  return useQuery({
    queryKey: QUERY_KEYS.report(year, month),
    queryFn: () => getReport(year, month, timezone),
  });
}
