import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelLeave, markLeave } from "../api/leave";
import type { MarkLeaveInput } from "../../../lib/shared/schemas/attendance";
import { ApiError } from "../../../services/httpClient";

/** Errors are left to the caller (shown inside the leave dialog). */
export function useMarkLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkLeaveInput) => markLeave(input),
    onSuccess: () => {
      toast.success("Leave marked.");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => cancelLeave(date),
    onSuccess: () => {
      toast.success("Leave cancelled.");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not cancel the leave."),
  });
}
