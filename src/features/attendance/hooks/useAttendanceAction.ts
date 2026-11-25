import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "../../../services/httpClient";

/** Shared mutation wrapper for Clock In / Clock Out / Break actions: shows a
 * toast and refreshes every attendance query (today, month, lists, reports). */
export function useAttendanceAction<T>(fn: () => Promise<T>, messages: { success: string; error: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(messages.success);
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : messages.error);
    },
  });
}
