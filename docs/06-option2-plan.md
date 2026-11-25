# Option 2 — Sessions, Breaks, Corrections, Auto-close, Leave

Status: **complete** — all six phases delivered (2026-11-26)

Scope agreed:

1. Multiple work sessions and breaks per day
2. Regularization (self-service corrections) with an audit trail
3. Auto-close of sessions left open (reminders deferred)
4. Leave: a "Mark leave" button that captures a reason

Out of scope for now: reminders/notifications, holidays, shifts/overtime rules, geofencing, manager approval (Option 3).

---

## 1. Decisions

| Topic                             | Decision                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-close cutoff                 | End of the local work day: a session still open after local midnight is closed at **23:59** of its `work_date` (in the day's timezone), and the day is flagged `auto_closed` + `needs_review`. |
| Correction window                 | Today and the **previous 30 days**. No times in the future. A **reason is required**. Applied immediately (no approval until Option 3).                                                        |
| Breaks                            | **Unpaid** — subtracted from worked time. No minimum/maximum. Must sit inside their session.                                                                                                   |
| Leave                             | **Today or a future date**, full day only, reason required. Not allowed on a day that already has sessions. Cancelling is allowed and audited.                                                 |
| Leave on a past day               | Not via the button (only today/future). Past days are fixed with a correction.                                                                                                                 |
| Sessions crossing midnight        | Belong to the `work_date` they started on.                                                                                                                                                     |
| Clock in again after clocking out | Allowed — starts a new session on the same day.                                                                                                                                                |

## 2. Data model

`attendance` stays the **one-row-per-user-per-day summary** (the `UNIQUE (user_id, work_date)` rule now means "one day record", not "one punch"). Punches move to child tables.

```
attendance                          (day summary — one per user per day)
  work_date, timezone
  status          working | on_break | completed | leave
  clock_in        first clock-in of the day   (null on leave days)
  clock_out       last clock-out of the day   (null while active / on leave)
  worked_minutes  Σ sessions − Σ breaks       (recomputed on every change)
  break_minutes
  leave_reason
  auto_closed, needs_review

attendance_sessions                 (many per day)
  attendance_id → attendance, user_id
  clock_in, clock_out (null = open)
  closed_by       user | auto | correction
  • at most ONE open session per user          (partial unique index)
  • sessions of a user can never overlap        (exclusion constraint, btree_gist)

attendance_breaks                   (many per session)
  session_id → attendance_sessions, user_id
  break_start, break_end (null = open)
  • at most ONE open break per user; breaks never overlap

attendance_audit                    (append-only)
  user_id, attendance_id, work_date
  action          clock_in | clock_out | break_start | break_end | auto_close | regularize | leave_mark | leave_cancel
  actor           user | system | auto_close
  reason, before (jsonb day snapshot), after (jsonb day snapshot), created_at
```

Refinements vs. the first sketch:

- `status` gains `on_break` and `leave` and becomes `text` + `CHECK` (instead of extending the Postgres enum) — enum values can't be added and used in the same migration transaction, and text is easier to evolve.
- A separate `day_type` column was dropped: `status = 'leave'` carries the same information with one less field to keep consistent.
- `clock_in` / `clock_out` keep their names (now "first in / last out") so existing reads, CSV export and the current UI keep working unchanged.
- Audit entries are written by the database functions (one entry per user action, with a full before/after **day snapshot**) rather than a per-row trigger — that gives one meaningful entry per action, carrying the action name and the user's reason.

### Write path

Every write goes through a Postgres function (RPC) called by a Netlify Function with the service-role key. Each one runs in a single transaction: change the rows → recompute the day totals → write the audit entry. Direct `INSERT/UPDATE/DELETE` on these tables is revoked from browser roles (`anon`, `authenticated`) and the functions are executable only by `service_role`, so the audit log can't be bypassed and a user can't call them with someone else's id.

| Function                                                                                | Purpose                                                                                                        |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `att_clock_in(user, timezone)`                                                          | New session (creates the day if needed). Rejects if a session is open or the day is leave.                     |
| `att_clock_out(user)`                                                                   | Closes the open session (and an open break).                                                                   |
| `att_break_start(user)` / `att_break_end(user)`                                         | Break inside the open session.                                                                                 |
| `att_regularize(user, date, timezone, sessions, reason)`                                | Replaces the day's sessions/breaks with the corrected set. Validates window, ordering, overlaps, future times. |
| `att_mark_leave(user, date, timezone, reason)` / `att_cancel_leave(user, date, reason)` | Leave.                                                                                                         |
| `att_auto_close(now)`                                                                   | Closes sessions whose local day has ended. Called by a scheduled function.                                     |
| `att_recalc_day(day)` / `att_day_snapshot(day)`                                         | Internal helpers.                                                                                              |

Errors are raised with a machine-readable code (e.g. `ALREADY_CLOCKED_IN`, `ON_LEAVE`, `OUTSIDE_CORRECTION_WINDOW`) that the API maps to 400/409.

### Existing data

Migration `0003` turns every existing `attendance` row into one session (closed ones marked `closed_by = 'user'`). Totals are unchanged.

## 3. API

| Endpoint                               | Change                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /clock-in`                       | Starts a new session; 409 on leave day / already open.                          |
| `POST /clock-out`                      | Closes open session (+ open break).                                             |
| `POST /break/start`, `POST /break/end` | New                                                                             |
| `GET /attendance/today`                | + sessions, breaks, break minutes, live state                                   |
| `GET /attendance/:date`                | New — one day in full                                                           |
| `PUT /attendance/:date/sessions`       | New — correction (`{ sessions: [...], reason }`)                                |
| `GET /attendance/:date/audit`          | New                                                                             |
| `POST /leave`, `DELETE /leave/:date`   | New                                                                             |
| scheduled `auto-close`                 | New — every 30 min                                                              |
| month / report / export                | + break minutes, leave days, auto-closed counts; CSV adds Breaks + Leave reason |

## 4. UI

- **Dashboard** — Idle → Working ⇄ On break → Clocked out (→ Clock in again). Buttons: Clock In · Start/End Break · Clock Out · Mark leave. A timeline bar of today's sessions and breaks; worked and break cards.
- **Monthly Logs / History** — expandable rows with sessions; Leave and "Auto-closed — review" badges; **Correct** action.
- **Dialogs** — correction editor, audit-history drawer, leave dialog.
- **Reports** — break totals, leave days (no longer counted as missed), auto-closed count.

## 5. Phases

| #   | Phase             | Deliverables                                                                                                                                                                                      | Est.  |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Foundation        | Migration `0003`, backfill, DB functions, revoked direct writes, shared TS types + pure calc, DB tests (PGlite) + unit tests; clock-in/out switched to the new functions with unchanged responses | 2–3 d |
| 2   | Sessions & breaks | Break endpoints, richer today endpoint, Dashboard state machine + timeline                                                                                                                        | 2–3 d |
| 3   | Auto-close        | Netlify scheduled function, review flag + badges                                                                                                                                                  | 1 d   |
| 4   | Corrections       | Day detail, correction editor, validation, audit drawer                                                                                                                                           | 3 d   |
| 5   | Leave             | Leave endpoints + dialog, absence-aware reports/monthly                                                                                                                                           | 1–2 d |
| 6   | Hardening         | Reports/CSV, e2e for every flow, docs                                                                                                                                                             | 1–2 d |

Each phase ends green (typecheck, lint, unit + DB tests, build) and leaves the app consistent, so work can pause after any phase.

## 6. Testing

- **Unit (Vitest)** — pure TypeScript day calculation and correction validation, run under several host timezones.
- **Database (Vitest + PGlite)** — migrations `0001`–`0003` applied to an in-process Postgres (no Docker / no Supabase project needed) with a small stub of Supabase's `auth` schema and roles; tests call the DB functions directly and assert totals, constraints, audit entries and error codes.
- **E2E (Playwright)** — extended per phase against the mocked API.

## 7. Delivered — notes

- Correction/day routes are `/api/day/:date…` (not `/attendance/:date`) to avoid colliding with `/attendance/today|month|report|export`.
- CSV export: Date, Status, First Clock In, Last Clock Out, Worked Hours, Break Hours, Timezone, Leave Reason, Auto-closed, Needs Review. Free-text cells are protected against spreadsheet formula injection.
- Reports: leave days, break total and auto-closed count; leave is never counted as missed.
- Deferred (unchanged): reminders/notifications, holidays, shifts/overtime, geofencing, manager approvals (Option 3).
