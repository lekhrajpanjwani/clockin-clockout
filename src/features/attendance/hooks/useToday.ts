import { useQuery } from "@tanstack/react-query";
import { getToday } from "../api/getToday";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { QUERY_KEYS } from "../../../constants/queryKeys";

export function useToday() {
  const timezone = useLocalTimezone();

  return useQuery({
    queryKey: QUERY_KEYS.today(timezone),
    queryFn: () => getToday(timezone),
  });
}
