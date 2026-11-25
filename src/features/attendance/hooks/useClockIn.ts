import { clockIn } from "../api/clockIn";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { useAttendanceAction } from "./useAttendanceAction";

export function useClockIn() {
  const timezone = useLocalTimezone();
  return useAttendanceAction(() => clockIn(timezone), {
    success: "Clocked in. Have a great session.",
    error: "Could not clock in. Please try again.",
  });
}
