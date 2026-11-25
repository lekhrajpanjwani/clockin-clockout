import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRow, DaySnapshotRow } from "../../../src/lib/shared/types/attendance";
import { DbError } from "./dbErrors";
import type { AttendanceQuery } from "../../../src/lib/shared/schemas/attendance";
import { datePrefixToRange } from "../../../src/lib/shared/time/attendance";

const TABLE = "attendance";

/**
 * Thin data-access layer around the `attendance` table. Every Netlify
 * Function goes through here rather than building ad-hoc Supabase queries
 * inline, so the query shape for a given operation is defined once.
 *
 * Note: row results are cast to `AttendanceRow` rather than generated from
 * Supabase's `Database` types (`supabase gen types typescript`) — reaching
 * for that generator is a natural follow-up once the schema stabilizes, but
 * isn't required for the hand-written types here to be accurate today.
 */

/** The user's active day (working or on a break), if any — whichever date it belongs to. */
export async function findActiveDay(client: SupabaseClient, userId: string): Promise<AttendanceRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .in("status", ["working", "on_break"])
    .maybeSingle();

  if (error) throw error;
  return (data as AttendanceRow | null) ?? null;
}

export async function findByWorkDate(
  client: SupabaseClient,
  userId: string,
  workDate: string,
): Promise<AttendanceRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (error) throw error;
  return (data as AttendanceRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Writes — every one goes through an att_* database function (see
// supabase/migrations/0003_sessions_breaks_audit.sql), which updates the
// rows, recomputes the day totals and writes the audit entry atomically.
// Business-rule failures surface as DbError; map them with dbErrorResponse().
// ---------------------------------------------------------------------------
async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new DbError(error);
  return data as T;
}

export const rpcClockIn = (client: SupabaseClient, userId: string, timezone: string) =>
  rpc<DaySnapshotRow>(client, "att_clock_in", { p_user_id: userId, p_timezone: timezone });

export const rpcClockOut = (client: SupabaseClient, userId: string) =>
  rpc<DaySnapshotRow>(client, "att_clock_out", { p_user_id: userId });

export const rpcBreakStart = (client: SupabaseClient, userId: string) =>
  rpc<DaySnapshotRow>(client, "att_break_start", { p_user_id: userId });

export const rpcBreakEnd = (client: SupabaseClient, userId: string) =>
  rpc<DaySnapshotRow>(client, "att_break_end", { p_user_id: userId });

/** Full day (sessions + breaks). Callers must pass a day id they've already
 * confirmed belongs to the user (e.g. from findActiveDay/findByWorkDate). */
export const rpcDaySnapshot = (client: SupabaseClient, dayId: string) =>
  rpc<DaySnapshotRow | null>(client, "att_day_snapshot", { p_day: dayId });

/** Snake_case session list for att_regularize(). */
export interface RegularizeSessionArg {
  clock_in: string;
  clock_out: string;
  breaks: { break_start: string; break_end: string }[];
}

export const rpcRegularize = (
  client: SupabaseClient,
  userId: string,
  workDate: string,
  timezone: string,
  sessions: RegularizeSessionArg[],
  reason: string,
) =>
  rpc<DaySnapshotRow | null>(client, "att_regularize", {
    p_user_id: userId,
    p_work_date: workDate,
    p_timezone: timezone,
    p_sessions: sessions,
    p_reason: reason,
  });

export const rpcMarkLeave = (
  client: SupabaseClient,
  userId: string,
  workDate: string,
  timezone: string,
  reason: string,
) =>
  rpc<DaySnapshotRow>(client, "att_mark_leave", {
    p_user_id: userId,
    p_work_date: workDate,
    p_timezone: timezone,
    p_reason: reason,
  });

export const rpcCancelLeave = (
  client: SupabaseClient,
  userId: string,
  workDate: string,
  reason: string | null,
) => rpc<null>(client, "att_cancel_leave", { p_user_id: userId, p_work_date: workDate, p_reason: reason });

export interface AuditRow {
  id: number;
  work_date: string;
  action: string;
  actor: string;
  reason: string | null;
  before: DaySnapshotRow | null;
  after: DaySnapshotRow | null;
  created_at: string;
}

export async function listAudit(
  client: SupabaseClient,
  userId: string,
  workDate: string,
): Promise<AuditRow[]> {
  const { data, error } = await client
    .from("attendance_audit")
    .select("id, work_date, action, actor, reason, before, after, created_at")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

export const rpcAutoClose = (client: SupabaseClient) => rpc<number>(client, "att_auto_close", {});

export interface PaginatedRows {
  rows: AttendanceRow[];
  totalItems: number;
}

export async function listPaginated(
  client: SupabaseClient,
  userId: string,
  query: AttendanceQuery,
): Promise<PaginatedRows> {
  let builder = client.from(TABLE).select("*", { count: "exact" }).eq("user_id", userId);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.needsReview !== undefined) builder = builder.eq("needs_review", query.needsReview);
  if (query.dateFrom) builder = builder.gte("work_date", query.dateFrom);
  if (query.dateTo) builder = builder.lte("work_date", query.dateTo);
  // PostgREST can't apply `ilike` to a casted `date` column, so a date-prefix
  // search is translated into an inclusive range instead (ANDed with any
  // explicit dateFrom/dateTo above).
  const searchRange = query.search ? datePrefixToRange(query.search) : null;
  if (searchRange) {
    builder = builder.gte("work_date", searchRange.dateFrom).lte("work_date", searchRange.dateTo);
  }

  const sortColumn = query.sortBy === "workedMinutes" ? "worked_minutes" : "work_date";
  builder = builder.order(sortColumn, { ascending: query.sortDir === "asc" });

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  builder = builder.range(from, to);

  const { data, error, count } = await builder;
  if (error) throw error;

  return { rows: (data ?? []) as AttendanceRow[], totalItems: count ?? 0 };
}

export async function listRange(
  client: SupabaseClient,
  userId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AttendanceRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .gte("work_date", dateFrom)
    .lte("work_date", dateTo)
    .order("work_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}
