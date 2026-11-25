/** Central registry of TanStack Query keys for the attendance feature, so
 * invalidation after a clock-in/clock-out mutation can't drift out of sync
 * with what each hook actually queries. */
export const QUERY_KEYS = {
  today: (timezone: string) => ["attendance", "today", timezone] as const,
  month: (year: number, month: number) => ["attendance", "month", year, month] as const,
  list: (params: Record<string, unknown>) => ["attendance", "list", params] as const,
  report: (year: number, month?: number) => ["attendance", "report", year, month ?? "all"] as const,
  day: (date: string) => ["attendance", "day", date] as const,
  dayAudit: (date: string) => ["attendance", "day", date, "audit"] as const,
};
