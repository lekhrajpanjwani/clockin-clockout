import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { correctDay, getDay, getDayAudit } from "../api/day";
import { QUERY_KEYS } from "../../../constants/queryKeys";
import type { RegularizeInput } from "../../../lib/shared/schemas/attendance";

export function useDay(date: string, enabled = true) {
  return useQuery({ queryKey: QUERY_KEYS.day(date), queryFn: () => getDay(date), enabled });
}

export function useDayAudit(date: string, enabled = true) {
  return useQuery({ queryKey: QUERY_KEYS.dayAudit(date), queryFn: () => getDayAudit(date), enabled });
}

/** Saves a correction. Errors are left to the caller (shown inside the dialog). */
export function useCorrectDay(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegularizeInput) => correctDay(date, input),
    onSuccess: (res) => {
      toast.success(res.day ? "Correction saved." : "Day removed.");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}
