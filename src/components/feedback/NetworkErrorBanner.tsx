import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

/** Persistent banner shown app-wide while the browser is offline. Clock In/Out
 * are disabled offline rather than queued: the server stamps the time with
 * its own clock (never trusting the client), so a replayed request would
 * record the wrong time. */
export function NetworkErrorBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" />
      You're offline. Clock In / Clock Out will be available again once you reconnect.
    </div>
  );
}
