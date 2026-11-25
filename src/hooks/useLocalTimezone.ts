/** The browser's IANA timezone, e.g. "Asia/Kolkata". Sent with every
 * clock-in/clock-out request so the server can resolve "today" and store the
 * session's origin timezone (see docs/01-architecture.md §6). */
export function useLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
