import { clockOut } from "../api/clockOut";
import { useLocalTimezone } from "../../../hooks/useLocalTimezone";
import { useAttendanceAction } from "./useAttendanceAction";

export function useClockOut() {
  const timezone = useLocalTimezone();
  return useAttendanceAction(() => clockOut(timezone), {
    success: "Clocked out. Nice work.",
    error: "Could not clock out. Please try again.",
  });
}
