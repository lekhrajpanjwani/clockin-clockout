import { breakEnd, breakStart } from "../api/breaks";
import { useAttendanceAction } from "./useAttendanceAction";

export const useBreakStart = () =>
  useAttendanceAction(breakStart, {
    success: "Break started. Enjoy it.",
    error: "Could not start the break.",
  });

export const useBreakEnd = () =>
  useAttendanceAction(breakEnd, {
    success: "Welcome back — break ended.",
    error: "Could not end the break.",
  });
