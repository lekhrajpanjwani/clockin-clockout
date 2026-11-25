import { errorResponse } from "./http";

/**
 * Business-rule errors raised by the att_* database functions
 * (`att_raise(code, message)` → Postgres error with message = code,
 * detail = human text) and how the API reports them.
 */
const STATUS_BY_CODE: Record<string, number> = {
  ALREADY_CLOCKED_IN: 409,
  NOT_CLOCKED_IN: 409,
  ALREADY_ON_BREAK: 409,
  NOT_ON_BREAK: 409,
  ON_LEAVE: 409,
  ALREADY_ON_LEAVE: 409,
  NOT_ON_LEAVE: 409,
  DAY_HAS_ATTENDANCE: 409,
  DAY_IS_LEAVE: 409,
  SESSION_OPEN: 409,
  OVERLAPPING_TIMES: 409,
  NO_SESSIONS: 400,
  INVALID_TIME: 400,
  REASON_REQUIRED: 400,
  INVALID_SESSIONS: 400,
  INVALID_SESSION: 400,
  INVALID_BREAK: 400,
  BREAK_OUTSIDE_SESSION: 400,
  FUTURE_TIME: 400,
  SESSION_TOO_LONG: 400,
  SESSION_DATE_MISMATCH: 400,
  OUTSIDE_CORRECTION_WINDOW: 400,
  LEAVE_DATE_IN_PAST: 400,
  LEAVE_DATE_TOO_FAR: 400,
};

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Maps a database error to an API response, or returns null if it isn't a
 * known business-rule / constraint error (caller should then 500). */
export function dbErrorResponse(err: unknown): Response | null {
  const e = err as PostgrestLikeError;
  if (!e || typeof e !== "object") return null;

  if (e.code === "P0001" && e.message && e.message in STATUS_BY_CODE) {
    return errorResponse(e.message, e.details || e.message, STATUS_BY_CODE[e.message]!);
  }
  // Concurrency backstops: unique index (double clock-in race) and
  // exclusion constraint (overlapping sessions/breaks).
  if (e.code === "23505")
    return errorResponse("CONFLICT", "That action conflicts with your current attendance.", 409);
  if (e.code === "23P01")
    return errorResponse("OVERLAPPING_TIMES", "Times overlap an existing session or break.", 409);
  return null;
}

/** Error thrown by repo RPC wrappers so callers can map it. */
export class DbError extends Error {
  constructor(public readonly pg: PostgrestLikeError) {
    super(pg.message ?? "Database error");
    this.name = "DbError";
  }
}
