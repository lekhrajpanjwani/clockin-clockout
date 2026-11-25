import { useEffect, useState } from "react";

/** Re-renders the calling component every `intervalMs`, returning the
 * current time. Used to drive the live session timer and the dashboard's
 * current date/time display without a global store — nothing else in the
 * app needs to react to "the clock ticked". */
export function useNowTick(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
