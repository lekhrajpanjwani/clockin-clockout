import { useQuery } from "@tanstack/react-query";
import { getMonth } from "../api/getMonth";
import { QUERY_KEYS } from "../../../constants/queryKeys";

export function useMonthly(year: number, month: number) {
  return useQuery({
    queryKey: QUERY_KEYS.month(year, month),
    queryFn: () => getMonth(year, month),
  });
}
