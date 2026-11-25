# API Design

Base URL (production): `https://<your-site>.netlify.app/api/*`
Implemented as Netlify Functions v2, where each function declares its own route via `export const config = { path: "/api/..." }` — no separate `netlify.toml` redirect rule is needed for routing (see [deployment guide](deployment-guide.md), Phase 8).

## Conventions

- **Auth**: every endpoint requires `Authorization: Bearer <supabase_jwt>`. The function verifies the JWT's signature and expiry **locally** with `jose` — this avoids a network round-trip to Supabase Auth on every single request, which matters for staying comfortably inside the free tier's function-runtime budget. `sub` from the verified payload is the trusted `user_id`; it is never taken from the request body.
  Current Supabase projects sign access tokens **asymmetrically (ES256 by default)** and publish a JWKS endpoint (`/auth/v1/.well-known/jwks.json`) for it — no shared secret involved; `jose`'s `createRemoteJWKSet` fetches and caches that automatically. Older projects still on the legacy shared HS256 secret are also supported (selected by the token's own `alg` header) via `JWT_SECRET`. This was discovered and fixed against a real project during Phase 5/6 live testing — the `JWT_SECRET` value shown in some Supabase dashboards for newer projects is actually that signing key's _id_ (`kid`), not a usable HMAC secret, so treating it as one would silently 401 every request.
- **CORS**: not needed. The SPA and the Functions are served from the same Netlify site/origin in both `netlify dev` and production, so no cross-origin requests occur and no `Access-Control-Allow-Origin` header is set.
- **Content type**: `application/json` for all request/response bodies.
- **Errors**: a single shape everywhere —
  ```json
  { "error": { "code": "CONFLICT", "message": "Already clocked in for today." } }
  ```
- **Validation**: every request body/query is parsed with the same Zod schema used on the client (`src/lib/shared/schemas`). A failed parse returns `400` with `code: "VALIDATION_ERROR"` and a `details` array of field issues.
- **Rate limiting**: mutating endpoints (`/clock-in`, `/clock-out`) are limited to **10 requests/minute per user** (a personal attendance tool needs at most 2/day; 10/min only exists to blunt accidental double-submits and abuse). Exceeding it returns `429` with a `Retry-After` header.
- **Time format**: all timestamps in requests/responses are ISO-8601 UTC strings (e.g. `2026-07-26T09:03:12.000Z"`). The client is responsible for local display.

## Standard HTTP status codes used

| Code  | Meaning here                                                                         |
| ----- | ------------------------------------------------------------------------------------ |
| `200` | Successful read, or successful update (clock-out)                                    |
| `201` | Resource created (clock-in)                                                          |
| `400` | Validation error (bad query/body)                                                    |
| `401` | Missing/invalid/expired JWT                                                          |
| `404` | No matching resource (e.g. `/attendance/today` with no session yet — see note below) |
| `409` | Business-rule conflict (double clock-in, clock-out with no open session)             |
| `429` | Rate limit exceeded                                                                  |
| `500` | Unhandled server error (logged, generic message returned)                            |

---

> **Option 2 update (migration 0003):** a day can now have several sessions. `POST /clock-in` starts a new session (allowed again after clocking out the same day) and `POST /clock-out` closes the open one. Both return the **day record**, which gained `breakMinutes`, `leaveReason`, `autoClosed`, `needsReview`; `status` can also be `on_break` or `leave`, and `clockIn`/`clockOut` are the first in / last out (null on leave days). Business-rule errors use codes such as `ALREADY_CLOCKED_IN`, `NOT_CLOCKED_IN`, `ON_LEAVE` (409) — see `netlify/functions/_shared/dbErrors.ts`. New endpoints arrive in Phases 2–5 ([plan](06-option2-plan.md)).

### Phase 5 additions — leave

- `POST /leave` — `{ "date": "2026-12-01", "timezone": "Asia/Kolkata", "reason": "Family function" }` → `201 { day, sessions: [] }` with `day.status = "leave"`. Today or up to a year ahead, full day, reason ≥ 3 chars. Errors: `400 LEAVE_DATE_IN_PAST | LEAVE_DATE_TOO_FAR | REASON_REQUIRED`, `409 ALREADY_ON_LEAVE | DAY_HAS_ATTENDANCE`.
- `DELETE /leave/:date` — cancels it (optional body `{ "reason": "…" }`) → `{ "cancelled": "2026-12-01" }`. Future days and up to 30 days back. `409 NOT_ON_LEAVE`.
- Clocking in on a leave day → `409 ON_LEAVE`; correcting it → `409 DAY_IS_LEAVE` (cancel first).
- `GET /attendance/report` gained `leaveDays` (in the period, including planned) and `breakMinutes`; leave days are never counted as missed.

### Phase 4 additions — corrections & change history

Routes live under `/api/day/:date` (not `/attendance/:date` as first sketched, so they can't collide with `/attendance/today|month|report|export`).

- `GET /day/:date` — `{ day, sessions }` for that date, or `{ day: null, sessions: [] }`.
- `PUT /day/:date/sessions` — correction. Body:
  ```json
  {
    "timezone": "Asia/Kolkata",
    "reason": "Forgot to clock out",
    "sessions": [
      {
        "clockIn": "2026-11-25T03:30:00Z",
        "clockOut": "2026-11-25T12:40:00Z",
        "breaks": [{ "breakStart": "2026-11-25T07:30:00Z", "breakEnd": "2026-11-25T08:00:00Z" }]
      }
    ]
  }
  ```
  Replaces the day's sessions (an empty list removes the day) and clears `needsReview`. Rules: today and the previous 30 days only, reason ≥ 3 chars, no future times, clock-out after clock-in, sessions ≤ 24 h and starting on that date, breaks inside their session, no overlaps (also with other days). Errors: `400 OUTSIDE_CORRECTION_WINDOW | FUTURE_TIME | INVALID_SESSION | BREAK_OUTSIDE_SESSION | SESSION_DATE_MISMATCH | SESSION_TOO_LONG | REASON_REQUIRED`, `409 OVERLAPPING_TIMES | SESSION_OPEN | DAY_IS_LEAVE`. Rate limited 20/min.
- `GET /day/:date/audit` — `{ items: AuditEntry[] }`, newest first (max 50): action, actor, reason, before/after day snapshots, timestamp.

### Phase 3 additions

- Scheduled function `auto-close` (every 30 min, not an HTTP route) calls `att_auto_close()`: sessions still open after their local day has ended are closed at 23:59 local and the day gets `autoClosed: true, needsReview: true`. Trigger locally with `npx netlify functions:invoke auto-close`.
- `GET /attendance?needsReview=true` lists only days still flagged for review.

### Phase 2 additions

- `POST /break/start` — starts a break in the open session. `409 NOT_CLOCKED_IN` / `ALREADY_ON_BREAK`.
- `POST /break/end` — ends the open break. `409 NOT_ON_BREAK`.
- Both return the **day detail**: `{ "day": AttendanceRecord, "sessions": [{ id, clockIn, clockOut, closedBy, breaks: [{ id, breakStart, breakEnd }] }] }`. Rate limited like clock-in/out.
- `GET /attendance/today` now returns `{ "record": AttendanceRecord | null, "sessions": [...] }` (same `sessions` shape).

## `POST /clock-in`

Starts today's attendance session.

**Request body**

```json
{ "timezone": "Asia/Kolkata" }
```

`timezone` — IANA zone string, validated with a Zod `refine` against `Intl.supportedValuesOf('timeZone')`.

**Behavior**

1. Verify JWT → `user_id`. Check rate limit (`clock-in:{user_id}`, 10/min) → `429` if exceeded.
2. Reject if the user already has any row with `status = 'working'` (from today _or_ an earlier day left open) → `409`. This is what actually implements "do not allow Clock In twice without Clock Out" — see [database schema §6](03-database-schema.md#6-refinement-found-during-phase-2-implementation-one-open-session-per-user-not-per-day) for why a per-day check alone isn't sufficient.
3. Compute `work_date` = current date in the given `timezone`.
4. `INSERT INTO attendance (user_id, work_date, clock_in, timezone, status) VALUES (..., now(), ..., 'working')`.
5. If the unique `(user_id, work_date)` or the partial "one open session" index is violated (e.g. a concurrent double-click race) → `409`.

**Response `201`**

```json
{
  "id": "b3f1...",
  "workDate": "2026-07-26",
  "clockIn": "2026-07-26T03:30:12.000Z",
  "clockOut": null,
  "timezone": "Asia/Kolkata",
  "workedMinutes": null,
  "status": "working"
}
```

**Response `409`** — already clocked in today:

```json
{ "error": { "code": "CONFLICT", "message": "Already clocked in for today. Clock out first." } }
```

---

## `POST /clock-out`

Completes the user's currently open session — whichever day it belongs to. In the overwhelming majority of cases that's today's row, but the lookup is deliberately by `status = 'working'` rather than by today's date, so a session left open across midnight (e.g. a late clock-in the previous evening) can still be closed correctly; the request body's `timezone` is not used to locate the row.

**Request body**

```json
{ "timezone": "Asia/Kolkata" }
```

**Behavior**

1. Verify JWT → `user_id`.
2. Find the row where `status = 'working'` for this user (at most one can exist, by the partial unique index). None found → `409` (`"No open session to clock out of."`).
3. `worked_minutes = round(extract(epoch from (now() - clock_in)) / 60)`.
4. `UPDATE ... SET clock_out = now(), worked_minutes = ..., status = 'completed'`.

**Response `200`**

```json
{
  "id": "b3f1...",
  "workDate": "2026-07-26",
  "clockIn": "2026-07-26T03:30:12.000Z",
  "clockOut": "2026-07-26T12:01:47.000Z",
  "timezone": "Asia/Kolkata",
  "workedMinutes": 511,
  "status": "completed"
}
```

---

## `GET /attendance/today`

**Query params**: `timezone` (IANA string, optional, defaults to `UTC`) — used only as a fallback to resolve "today"'s calendar date when there is no currently open session; if an open (`working`) session exists it is always returned regardless of which calendar day it started on.

**Response `200`** (session exists, working or completed today):

```json
{
  "id": "b3f1...",
  "workDate": "2026-07-26",
  "clockIn": "2026-07-26T03:30:12.000Z",
  "clockOut": null,
  "timezone": "Asia/Kolkata",
  "workedMinutes": null,
  "status": "working"
}
```

**Response `200`** with `"record": null` when nothing logged yet today (not `404` — "no record yet" is an expected, normal dashboard state, not an error):

```json
{ "record": null }
```

---

## `GET /attendance`

Paginated, sortable, filterable history.

**Query params**

| Param                 | Type                                       | Default    | Notes                                                                                                |
| --------------------- | ------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| `page`                | int ≥ 1                                    | `1`        |                                                                                                      |
| `pageSize`            | int, 1–100                                 | `20`       |                                                                                                      |
| `sortBy`              | `workDate` \| `workedMinutes`              | `workDate` |                                                                                                      |
| `sortDir`             | `asc` \| `desc`                            | `desc`     |                                                                                                      |
| `status`              | `working` \| `completed`                   | (all)      |                                                                                                      |
| `search`              | string (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`) | —          | date prefix → inclusive `work_date` range (ANDed with `dateFrom`/`dateTo`); anything else is a `400` |
| `dateFrom` / `dateTo` | `YYYY-MM-DD`                               | —          | inclusive range filter                                                                               |

**Response `200`**

```json
{
  "items": [
    {
      "id": "...",
      "workDate": "2026-07-25",
      "clockIn": "...",
      "clockOut": "...",
      "timezone": "Asia/Kolkata",
      "workedMinutes": 480,
      "status": "completed"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 187,
  "totalPages": 10
}
```

---

## `GET /attendance/month`

**Query params**: `year` (int, required), `month` (1–12, required).

**Response `200`**

```json
{
  "year": 2026,
  "month": 7,
  "days": [
    {
      "workDate": "2026-07-01",
      "clockIn": "...",
      "clockOut": "...",
      "workedMinutes": 465,
      "status": "completed"
    }
  ],
  "weeklyTotals": [{ "weekStart": "2026-06-29", "weekEnd": "2026-07-05", "totalMinutes": 2100 }],
  "monthlyTotalMinutes": 9840
}
```

Week boundaries follow ISO-8601 (Monday start), computed with `date-fns`' `startOfWeek`/`endOfWeek` on the server for consistency with the frontend's own week math.

---

## `GET /attendance/report`

**Query params**: `year` (required), `month` (optional — omit for a full-year report), `timezone` (optional IANA zone — used to work out "today" so weekdays that haven't happened yet are not counted as missed).

**Response `200`**

```json
{
  "year": 2026,
  "month": 7,
  "workingDays": 21,
  "totalMinutes": 9840,
  "averageMinutesPerDay": 469,
  "longestDay": { "workDate": "2026-07-14", "workedMinutes": 612 },
  "shortestDay": { "workDate": "2026-07-03", "workedMinutes": 180 },
  "missedDays": 2
}
```

`missedDays` = weekdays (Mon–Fri) in the period, up to but not including today when `timezone` is given, with no `completed` record — a deliberate, simple definition called out explicitly since "missed" is otherwise ambiguous; configurable later if the user wants weekends included.

---

## `GET /attendance/export`

**Query params**: `year` (required), `month` (optional — full year if omitted).

**Response `200`**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="attendance-2026-07.csv"`

```csv
Date,Clock In,Clock Out,Timezone,Worked Hours,Status
2026-07-01,09:02 AM,05:07 PM,Asia/Kolkata,8.08,Completed
2026-07-02,09:15 AM,,Asia/Kolkata,,Working
```

Clock In/Out are rendered in the record's own `timezone`, matching the "display in local timezone" rule.

---

## Endpoint summary

| Method | Path                 | Purpose                               |
| ------ | -------------------- | ------------------------------------- |
| `POST` | `/clock-in`          | Start today's session                 |
| `POST` | `/clock-out`         | Complete today's session              |
| `GET`  | `/attendance/today`  | Dashboard "today" card                |
| `GET`  | `/attendance`        | Paginated/filterable history          |
| `GET`  | `/attendance/month`  | Monthly table + weekly/monthly totals |
| `GET`  | `/attendance/report` | Monthly/yearly summary stats          |
| `GET`  | `/attendance/export` | CSV download                          |
