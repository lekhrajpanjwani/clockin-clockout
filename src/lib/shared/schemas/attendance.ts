import { z } from "zod";
import { datePrefixToRange, isValidTimeZone } from "../time/attendance";

/** Single source of truth for validation — used by both the frontend forms
 * (React Hook Form resolver) and the Netlify Functions (request parsing). */

export const timezoneSchema = z
  .string()
  .min(1, "Timezone is required")
  .refine(isValidTimeZone, { message: "Not a recognized IANA timezone" });

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const clockInSchema = z.object({
  timezone: timezoneSchema,
});
export type ClockInInput = z.infer<typeof clockInSchema>;

export const clockOutSchema = z.object({
  timezone: timezoneSchema,
});
export type ClockOutInput = z.infer<typeof clockOutSchema>;

export const attendanceStatusSchema = z.enum(["working", "on_break", "completed", "leave"]);

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["workDate", "workedMinutes"]).default("workDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: attendanceStatusSchema.optional(),
  /** Date prefix: "2026", "2026-07" or "2026-07-26". */
  search: z
    .string()
    .max(10)
    .refine((v) => v === "" || datePrefixToRange(v) !== null, { message: "Use YYYY, YYYY-MM or YYYY-MM-DD" })
    .optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  /** Only days flagged for review (auto-closed, not yet corrected). */
  needsReview: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const yearSchema = z.coerce.number().int().min(2000).max(2100);
export const monthSchema = z.coerce.number().int().min(1).max(12);

export const monthQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema,
});
export type MonthQuery = z.infer<typeof monthQuerySchema>;

export const reportQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
  /** Caller's IANA zone. Used to work out "today" so future weekdays in the
   * current period aren't reported as missed. Optional for backwards
   * compatibility — when absent, the full period is counted. */
  timezone: timezoneSchema.optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const exportQuerySchema = reportQuerySchema.omit({ timezone: true });
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export const todayQuerySchema = z.object({
  timezone: timezoneSchema.default("UTC"),
});
export type TodayQuery = z.infer<typeof todayQuerySchema>;

// ---------------------------------------------------------------------------
// Option 2 — corrections & leave (validated again by the database functions)
// ---------------------------------------------------------------------------
export const isoInstantSchema = z
  .string()
  .datetime({ offset: true, message: "Expected an ISO-8601 timestamp" });

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Please give a reason (at least 3 characters)")
  .max(500, "Keep the reason under 500 characters");

export const correctionBreakSchema = z.object({
  breakStart: isoInstantSchema,
  breakEnd: isoInstantSchema,
});

export const correctionSessionSchema = z.object({
  clockIn: isoInstantSchema,
  clockOut: isoInstantSchema,
  breaks: z.array(correctionBreakSchema).max(10, "At most 10 breaks per session").default([]),
});
export type CorrectionSession = z.infer<typeof correctionSessionSchema>;

export const regularizeSchema = z.object({
  timezone: timezoneSchema,
  sessions: z.array(correctionSessionSchema).max(12, "At most 12 sessions per day"),
  reason: reasonSchema,
});
export type RegularizeInput = z.infer<typeof regularizeSchema>;

export const markLeaveSchema = z.object({
  date: dateStringSchema,
  timezone: timezoneSchema,
  reason: reasonSchema,
});
export type MarkLeaveInput = z.infer<typeof markLeaveSchema>;

export const cancelLeaveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
