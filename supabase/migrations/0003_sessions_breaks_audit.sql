-- 0003_sessions_breaks_audit.sql
-- Option 2 / Phase 1 — see docs/06-option2-plan.md
--
--   * attendance becomes the per-day SUMMARY; punches move to
--     attendance_sessions (many per day) and attendance_breaks (many per session)
--   * status: working | on_break | completed | leave  (text + CHECK)
--   * attendance_audit: append-only before/after day snapshots
--   * all writes go through att_* functions (service_role only); direct
--     writes from browser roles are revoked so the audit log can't be bypassed
--   * existing rows are backfilled as one session each — totals unchanged

create extension if not exists btree_gist; -- exclusion constraints on (uuid, tstzrange)

-- ===========================================================================
-- 1. attendance: enum -> text, new columns, new consistency rules
-- ===========================================================================
drop index if exists public.attendance_user_status_idx;
drop index if exists public.attendance_one_open_session_per_user;
alter table public.attendance drop constraint if exists attendance_status_consistency;

alter table public.attendance alter column status drop default;
alter table public.attendance alter column status type text using status::text;
alter table public.attendance alter column status set default 'working';
drop type if exists attendance_status;

alter table public.attendance alter column clock_in drop not null;

alter table public.attendance
  add column if not exists break_minutes integer not null default 0,
  add column if not exists leave_reason  text,
  add column if not exists auto_closed   boolean not null default false,
  add column if not exists needs_review  boolean not null default false;

alter table public.attendance
  add constraint attendance_status_valid
    check (status in ('working', 'on_break', 'completed', 'leave')),
  add constraint attendance_break_minutes_non_negative
    check (break_minutes >= 0),
  add constraint attendance_status_consistency
    check (
      (status in ('working', 'on_break')
        and clock_in is not null and clock_out is null and leave_reason is null)
      or
      (status = 'completed'
        and clock_in is not null and clock_out is not null and worked_minutes is not null
        and leave_reason is null)
      or
      (status = 'leave'
        and clock_in is null and clock_out is null
        and coalesce(worked_minutes, 0) = 0 and break_minutes = 0
        and leave_reason is not null and length(btrim(leave_reason)) > 0)
    ),
  -- target for the composite FKs below (child rows must belong to the same user)
  add constraint attendance_id_user_unique unique (id, user_id);

create index if not exists attendance_user_status_idx on public.attendance (user_id, status);

-- At most one active (working / on break) day per user.
create unique index if not exists attendance_one_active_day_per_user
  on public.attendance (user_id)
  where status in ('working', 'on_break');

comment on table public.attendance is
  'Per-user per-day summary. Punches live in attendance_sessions / attendance_breaks; totals here are recomputed by att_recalc_day().';
comment on column public.attendance.clock_in is 'First clock-in of the day (null on leave days).';
comment on column public.attendance.clock_out is 'Last clock-out of the day (null while active or on leave).';
comment on column public.attendance.worked_minutes is
  'Σ closed session time − Σ breaks inside closed sessions, rounded to minutes. Recomputed on every change.';

-- ===========================================================================
-- 2. attendance_sessions
-- ===========================================================================
create table if not exists public.attendance_sessions (
  id             uuid primary key default gen_random_uuid(),
  attendance_id  uuid not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  clock_in       timestamptz not null,
  clock_out      timestamptz,
  closed_by      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint attendance_sessions_day_fk
    foreign key (attendance_id, user_id)
    references public.attendance (id, user_id) on delete cascade,
  constraint attendance_sessions_id_user_unique unique (id, user_id),
  constraint attendance_sessions_out_after_in check (clock_out is null or clock_out > clock_in),
  constraint attendance_sessions_closed_by_valid
    check (closed_by is null or closed_by in ('user', 'auto', 'correction')),
  constraint attendance_sessions_closed_by_consistency
    check ((clock_out is null) = (closed_by is null)),
  -- A user's sessions can never overlap, across any days.
  constraint attendance_sessions_no_overlap
    exclude using gist (
      user_id with =,
      tstzrange(clock_in, coalesce(clock_out, 'infinity'::timestamptz), '[)') with &&
    )
);

create unique index if not exists attendance_sessions_one_open_per_user
  on public.attendance_sessions (user_id)
  where clock_out is null;

create index if not exists attendance_sessions_day_idx
  on public.attendance_sessions (attendance_id, clock_in);

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. attendance_breaks
-- ===========================================================================
create table if not exists public.attendance_breaks (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  break_start  timestamptz not null,
  break_end    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint attendance_breaks_session_fk
    foreign key (session_id, user_id)
    references public.attendance_sessions (id, user_id) on delete cascade,
  constraint attendance_breaks_end_after_start check (break_end is null or break_end > break_start),
  constraint attendance_breaks_no_overlap
    exclude using gist (
      user_id with =,
      tstzrange(break_start, coalesce(break_end, 'infinity'::timestamptz), '[)') with &&
    )
);

create unique index if not exists attendance_breaks_one_open_per_user
  on public.attendance_breaks (user_id)
  where break_end is null;

create index if not exists attendance_breaks_session_idx
  on public.attendance_breaks (session_id, break_start);

drop trigger if exists attendance_breaks_set_updated_at on public.attendance_breaks;
create trigger attendance_breaks_set_updated_at
  before update on public.attendance_breaks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. attendance_audit (append-only)
-- ===========================================================================
create table if not exists public.attendance_audit (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  attendance_id  uuid,            -- no FK: the day row may since have been deleted
  work_date      date not null,
  action         text not null,
  actor          text not null,
  reason         text,
  before         jsonb,
  after          jsonb,
  created_at     timestamptz not null default now(),

  constraint attendance_audit_action_valid check (action in (
    'clock_in', 'clock_out', 'break_start', 'break_end', 'auto_close',
    'regularize', 'leave_mark', 'leave_cancel'
  )),
  constraint attendance_audit_actor_valid check (actor in ('user', 'system', 'auto_close'))
);

create index if not exists attendance_audit_user_date_idx
  on public.attendance_audit (user_id, work_date, created_at desc);

-- ===========================================================================
-- 5. Backfill: every existing day becomes one session
-- ===========================================================================
insert into public.attendance_sessions (attendance_id, user_id, clock_in, clock_out, closed_by)
select a.id, a.user_id, a.clock_in, a.clock_out,
       case when a.clock_out is null then null else 'user' end
from public.attendance a
where a.clock_in is not null
  and not exists (select 1 from public.attendance_sessions s where s.attendance_id = a.id);

-- ===========================================================================
-- 6. Row Level Security & privileges
--    Browser roles may READ their own rows; all writes go through the att_*
--    functions, which only service_role (Netlify Functions) may execute.
-- ===========================================================================
drop policy if exists attendance_insert_own on public.attendance;
drop policy if exists attendance_update_own on public.attendance;
drop policy if exists attendance_delete_own on public.attendance;

alter table public.attendance_sessions enable row level security;
alter table public.attendance_breaks   enable row level security;
alter table public.attendance_audit    enable row level security;

drop policy if exists attendance_sessions_select_own on public.attendance_sessions;
create policy attendance_sessions_select_own on public.attendance_sessions
  for select using (auth.uid() = user_id);

drop policy if exists attendance_breaks_select_own on public.attendance_breaks;
create policy attendance_breaks_select_own on public.attendance_breaks
  for select using (auth.uid() = user_id);

drop policy if exists attendance_audit_select_own on public.attendance_audit;
create policy attendance_audit_select_own on public.attendance_audit
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on
  public.attendance, public.attendance_sessions, public.attendance_breaks, public.attendance_audit
  from anon, authenticated;

-- ===========================================================================
-- 7. Functions
-- ===========================================================================

-- Raise a business-rule error. `message` is a stable machine code the API
-- maps to an HTTP status; `detail` is the human-readable text.
create or replace function public.att_raise(p_code text, p_message text)
returns void
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_message;
end;
$$;

-- Full day snapshot: { day: {...}, sessions: [{..., breaks: [...]}] }.
-- Used as the return value of every write function and as audit before/after.
create or replace function public.att_day_snapshot(p_day uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'day', to_jsonb(a) - 'user_id',
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'clock_in', s.clock_in,
          'clock_out', s.clock_out,
          'closed_by', s.closed_by,
          'breaks', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', b.id, 'break_start', b.break_start, 'break_end', b.break_end)
              order by b.break_start)
            from public.attendance_breaks b
            where b.session_id = s.id
          ), '[]'::jsonb)
        )
        order by s.clock_in)
      from public.attendance_sessions s
      where s.attendance_id = a.id
    ), '[]'::jsonb)
  )
  from public.attendance a
  where a.id = p_day;
$$;

create or replace function public.att_audit(
  p_user_id uuid, p_day uuid, p_work_date date, p_action text, p_actor text,
  p_reason text, p_before jsonb, p_after jsonb
)
returns void
language sql
set search_path = public
as $$
  insert into public.attendance_audit (user_id, attendance_id, work_date, action, actor, reason, before, after)
  values (p_user_id, p_day, p_work_date, p_action, p_actor, p_reason, p_before, p_after);
$$;

-- Recompute a day's summary columns from its sessions and breaks.
-- worked = round((Σ closed sessions − Σ closed breaks inside closed sessions) / 60s)
create or replace function public.att_recalc_day(p_day uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status      text;
  v_count       int;
  v_first_in    timestamptz;
  v_last_out    timestamptz;
  v_has_open    boolean;
  v_on_break    boolean;
  v_session_sec numeric;
  v_closed_brk  numeric;
  v_all_brk     numeric;
begin
  select status into v_status from public.attendance where id = p_day for update;
  if not found or v_status = 'leave' then
    return;
  end if;

  select count(*),
         min(clock_in),
         max(clock_out),
         coalesce(bool_or(clock_out is null), false),
         coalesce(sum(extract(epoch from (clock_out - clock_in))) filter (where clock_out is not null), 0)
    into v_count, v_first_in, v_last_out, v_has_open, v_session_sec
  from public.attendance_sessions
  where attendance_id = p_day;

  if v_count = 0 then
    perform public.att_raise('NO_SESSIONS', 'A work day must have at least one session.');
  end if;

  select coalesce(bool_or(b.break_end is null), false),
         coalesce(sum(extract(epoch from (b.break_end - b.break_start)))
                  filter (where b.break_end is not null and s.clock_out is not null), 0),
         coalesce(sum(extract(epoch from (b.break_end - b.break_start)))
                  filter (where b.break_end is not null), 0)
    into v_on_break, v_closed_brk, v_all_brk
  from public.attendance_breaks b
  join public.attendance_sessions s on s.id = b.session_id
  where s.attendance_id = p_day;

  update public.attendance
     set status         = case when v_on_break then 'on_break'
                               when v_has_open then 'working'
                               else 'completed' end,
         clock_in       = v_first_in,
         clock_out      = case when v_has_open then null else v_last_out end,
         worked_minutes = greatest(0, round((v_session_sec - v_closed_brk) / 60.0))::int,
         break_minutes  = round(v_all_brk / 60.0)::int
   where id = p_day;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clock in: start a new session (creating the day if needed).
-- ---------------------------------------------------------------------------
create or replace function public.att_clock_in(
  p_user_id uuid, p_timezone text, p_now timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_date   date := (p_now at time zone p_timezone)::date;
  v_day    public.attendance%rowtype;
  v_before jsonb;
  v_after  jsonb;
begin
  if exists (select 1 from public.attendance_sessions where user_id = p_user_id and clock_out is null) then
    perform public.att_raise('ALREADY_CLOCKED_IN', 'You are already clocked in. Clock out first.');
  end if;

  select * into v_day from public.attendance
   where user_id = p_user_id and work_date = v_date
   for update;

  if found then
    if v_day.status = 'leave' then
      perform public.att_raise('ON_LEAVE', 'This day is marked as leave. Cancel the leave to clock in.');
    end if;
    v_before := public.att_day_snapshot(v_day.id);
  else
    insert into public.attendance (user_id, work_date, timezone, status, clock_in)
    values (p_user_id, v_date, p_timezone, 'working', p_now)
    returning * into v_day;
  end if;

  insert into public.attendance_sessions (attendance_id, user_id, clock_in)
  values (v_day.id, p_user_id, p_now);

  perform public.att_recalc_day(v_day.id);
  v_after := public.att_day_snapshot(v_day.id);
  perform public.att_audit(p_user_id, v_day.id, v_date, 'clock_in', 'user', null, v_before, v_after);
  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clock out: close the open session (ending an open break first).
-- ---------------------------------------------------------------------------
create or replace function public.att_clock_out(p_user_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_date    date;
  v_before  jsonb;
  v_after   jsonb;
begin
  select * into v_session from public.attendance_sessions
   where user_id = p_user_id and clock_out is null
   for update;
  if not found then
    perform public.att_raise('NOT_CLOCKED_IN', 'No open session to clock out of.');
  end if;
  if p_now <= v_session.clock_in then
    perform public.att_raise('INVALID_TIME', 'Clock out time must be after clock in time.');
  end if;

  select work_date into v_date from public.attendance where id = v_session.attendance_id;
  v_before := public.att_day_snapshot(v_session.attendance_id);

  update public.attendance_breaks
     set break_end = greatest(p_now, break_start + interval '1 second')
   where session_id = v_session.id and break_end is null;

  update public.attendance_sessions
     set clock_out = greatest(p_now,
                              (select max(break_end) from public.attendance_breaks where session_id = v_session.id)),
         closed_by = 'user'
   where id = v_session.id;

  perform public.att_recalc_day(v_session.attendance_id);
  v_after := public.att_day_snapshot(v_session.attendance_id);
  perform public.att_audit(p_user_id, v_session.attendance_id, v_date, 'clock_out', 'user', null, v_before, v_after);
  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Breaks
-- ---------------------------------------------------------------------------
create or replace function public.att_break_start(p_user_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_date    date;
  v_before  jsonb;
  v_after   jsonb;
begin
  select * into v_session from public.attendance_sessions
   where user_id = p_user_id and clock_out is null
   for update;
  if not found then
    perform public.att_raise('NOT_CLOCKED_IN', 'Clock in before starting a break.');
  end if;
  if exists (select 1 from public.attendance_breaks where user_id = p_user_id and break_end is null) then
    perform public.att_raise('ALREADY_ON_BREAK', 'You are already on a break.');
  end if;
  if p_now <= v_session.clock_in then
    perform public.att_raise('INVALID_TIME', 'A break must start after clock in.');
  end if;

  select work_date into v_date from public.attendance where id = v_session.attendance_id;
  v_before := public.att_day_snapshot(v_session.attendance_id);

  insert into public.attendance_breaks (session_id, user_id, break_start)
  values (v_session.id, p_user_id, p_now);

  perform public.att_recalc_day(v_session.attendance_id);
  v_after := public.att_day_snapshot(v_session.attendance_id);
  perform public.att_audit(p_user_id, v_session.attendance_id, v_date, 'break_start', 'user', null, v_before, v_after);
  return v_after;
end;
$$;

create or replace function public.att_break_end(p_user_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_break   public.attendance_breaks%rowtype;
  v_day     uuid;
  v_date    date;
  v_before  jsonb;
  v_after   jsonb;
begin
  select * into v_break from public.attendance_breaks
   where user_id = p_user_id and break_end is null
   for update;
  if not found then
    perform public.att_raise('NOT_ON_BREAK', 'You are not on a break.');
  end if;
  if p_now <= v_break.break_start then
    perform public.att_raise('INVALID_TIME', 'A break must end after it starts.');
  end if;

  select s.attendance_id, a.work_date into v_day, v_date
    from public.attendance_sessions s join public.attendance a on a.id = s.attendance_id
   where s.id = v_break.session_id;
  v_before := public.att_day_snapshot(v_day);

  update public.attendance_breaks set break_end = p_now where id = v_break.id;

  perform public.att_recalc_day(v_day);
  v_after := public.att_day_snapshot(v_day);
  perform public.att_audit(p_user_id, v_day, v_date, 'break_end', 'user', null, v_before, v_after);
  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-close: sessions still open after their local work day has ended are
-- closed at 23:59 local time of work_date and flagged for review.
-- Returns the number of sessions closed. Intended for a scheduled job.
-- ---------------------------------------------------------------------------
create or replace function public.att_auto_close(p_now timestamptz default now())
returns integer
language plpgsql
set search_path = public
as $$
declare
  r        record;
  v_close  timestamptz;
  v_before jsonb;
  v_after  jsonb;
  v_count  int := 0;
begin
  for r in
    select s.id as session_id, s.user_id, s.clock_in, a.id as day_id, a.work_date, a.timezone
      from public.attendance_sessions s
      join public.attendance a on a.id = s.attendance_id
     where s.clock_out is null
       and p_now >= ((a.work_date + 1)::timestamp at time zone a.timezone)
     for update of s skip locked
  loop
    v_close := greatest(
      (r.work_date + time '23:59') at time zone r.timezone,
      r.clock_in + interval '1 second',
      coalesce((select max(break_start) + interval '1 second'
                  from public.attendance_breaks where session_id = r.session_id), '-infinity'::timestamptz)
    );

    v_before := public.att_day_snapshot(r.day_id);

    update public.attendance_breaks set break_end = v_close
     where session_id = r.session_id and break_end is null;
    update public.attendance_sessions set clock_out = v_close, closed_by = 'auto'
     where id = r.session_id;
    update public.attendance set auto_closed = true, needs_review = true
     where id = r.day_id;

    perform public.att_recalc_day(r.day_id);
    v_after := public.att_day_snapshot(r.day_id);
    perform public.att_audit(r.user_id, r.day_id, r.work_date, 'auto_close', 'auto_close',
                             'Session left open past the end of the day.', v_before, v_after);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Regularization: replace a day's sessions (and their breaks) with a
-- corrected set. p_sessions =
--   [{ "clock_in": iso, "clock_out": iso,
--      "breaks": [{ "break_start": iso, "break_end": iso }] }]
-- An empty array removes the day entirely. Returns the new snapshot, or
-- NULL when the day was removed.
-- ---------------------------------------------------------------------------
create or replace function public.att_regularize(
  p_user_id   uuid,
  p_work_date date,
  p_timezone  text,
  p_sessions  jsonb,
  p_reason    text,
  p_now       timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_day     public.attendance%rowtype;
  v_found   boolean;
  v_tz      text;
  v_today   date;
  v_before  jsonb;
  v_after   jsonb;
  v_sess    jsonb;
  v_brk     jsonb;
  v_ci      timestamptz;
  v_co      timestamptz;
  v_bs      timestamptz;
  v_be      timestamptz;
  v_sid     uuid;
  v_min_in  timestamptz;
  v_max_out timestamptz;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    perform public.att_raise('REASON_REQUIRED', 'Please give a reason for the correction (at least 3 characters).');
  end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then
    perform public.att_raise('INVALID_SESSIONS', 'Sessions must be a list.');
  end if;
  if jsonb_array_length(p_sessions) > 12 then
    perform public.att_raise('INVALID_SESSIONS', 'A day can have at most 12 sessions.');
  end if;

  select * into v_day from public.attendance
   where user_id = p_user_id and work_date = p_work_date
   for update;
  v_found := found;

  v_tz := coalesce(v_day.timezone, p_timezone);
  v_today := (p_now at time zone v_tz)::date;
  if p_work_date > v_today or p_work_date < v_today - 30 then
    perform public.att_raise('OUTSIDE_CORRECTION_WINDOW', 'Only today and the previous 30 days can be corrected.');
  end if;

  if v_found then
    if v_day.status = 'leave' then
      perform public.att_raise('DAY_IS_LEAVE', 'This day is marked as leave. Cancel the leave first.');
    end if;
    if exists (select 1 from public.attendance_sessions
                where attendance_id = v_day.id and clock_out is null) then
      perform public.att_raise('SESSION_OPEN', 'Clock out before correcting this day.');
    end if;
    v_before := public.att_day_snapshot(v_day.id);
    delete from public.attendance_sessions where attendance_id = v_day.id; -- breaks cascade
  end if;

  -- Removing every session removes the day.
  if jsonb_array_length(p_sessions) = 0 then
    if v_found then
      delete from public.attendance where id = v_day.id;
      perform public.att_audit(p_user_id, v_day.id, p_work_date, 'regularize', 'user',
                               btrim(p_reason), v_before, null);
    end if;
    return null;
  end if;

  -- Validate every session/break before writing anything.
  for v_sess in select * from jsonb_array_elements(p_sessions) loop
    v_ci := nullif(v_sess->>'clock_in', '')::timestamptz;
    v_co := nullif(v_sess->>'clock_out', '')::timestamptz;
    if v_ci is null or v_co is null then
      perform public.att_raise('INVALID_SESSION', 'Every session needs both a clock-in and a clock-out time.');
    end if;
    if v_co <= v_ci then
      perform public.att_raise('INVALID_SESSION', 'Clock-out must be after clock-in.');
    end if;
    if v_co > p_now then
      perform public.att_raise('FUTURE_TIME', 'Times cannot be in the future.');
    end if;
    if v_co - v_ci > interval '24 hours' then
      perform public.att_raise('SESSION_TOO_LONG', 'A session cannot be longer than 24 hours.');
    end if;
    if (v_ci at time zone v_tz)::date <> p_work_date then
      perform public.att_raise('SESSION_DATE_MISMATCH', 'Each session must start on the day being corrected.');
    end if;
    if v_sess ? 'breaks' and jsonb_typeof(v_sess->'breaks') <> 'array' then
      perform public.att_raise('INVALID_BREAK', 'Breaks must be a list.');
    end if;
    for v_brk in select * from jsonb_array_elements(coalesce(v_sess->'breaks', '[]'::jsonb)) loop
      v_bs := nullif(v_brk->>'break_start', '')::timestamptz;
      v_be := nullif(v_brk->>'break_end', '')::timestamptz;
      if v_bs is null or v_be is null or v_be <= v_bs then
        perform public.att_raise('INVALID_BREAK', 'Every break needs a start and an end after it.');
      end if;
      if v_bs < v_ci or v_be > v_co then
        perform public.att_raise('BREAK_OUTSIDE_SESSION', 'Breaks must fall inside their session.');
      end if;
    end loop;
    v_min_in  := least(coalesce(v_min_in, v_ci), v_ci);
    v_max_out := greatest(coalesce(v_max_out, v_co), v_co);
  end loop;

  if not v_found then
    insert into public.attendance (user_id, work_date, timezone, status, clock_in, clock_out, worked_minutes)
    values (p_user_id, p_work_date, v_tz, 'completed', v_min_in, v_max_out, 0)
    returning * into v_day;
  end if;

  begin
    for v_sess in select * from jsonb_array_elements(p_sessions) loop
      insert into public.attendance_sessions (attendance_id, user_id, clock_in, clock_out, closed_by)
      values (v_day.id, p_user_id, (v_sess->>'clock_in')::timestamptz, (v_sess->>'clock_out')::timestamptz,
              'correction')
      returning id into v_sid;

      for v_brk in select * from jsonb_array_elements(coalesce(v_sess->'breaks', '[]'::jsonb)) loop
        insert into public.attendance_breaks (session_id, user_id, break_start, break_end)
        values (v_sid, p_user_id, (v_brk->>'break_start')::timestamptz, (v_brk->>'break_end')::timestamptz);
      end loop;
    end loop;
  exception when exclusion_violation then
    perform public.att_raise('OVERLAPPING_TIMES',
      'Sessions (or breaks) overlap each other or another day''s session.');
  end;

  update public.attendance set needs_review = false where id = v_day.id;
  perform public.att_recalc_day(v_day.id);
  v_after := public.att_day_snapshot(v_day.id);
  perform public.att_audit(p_user_id, v_day.id, p_work_date, 'regularize', 'user', btrim(p_reason), v_before, v_after);
  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create or replace function public.att_mark_leave(
  p_user_id uuid, p_work_date date, p_timezone text, p_reason text, p_now timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today date := (p_now at time zone p_timezone)::date;
  v_day   public.attendance%rowtype;
  v_after jsonb;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    perform public.att_raise('REASON_REQUIRED', 'Please give a reason for the leave (at least 3 characters).');
  end if;
  if p_work_date < v_today then
    perform public.att_raise('LEAVE_DATE_IN_PAST', 'Leave can be marked for today or a future date.');
  end if;
  if p_work_date > v_today + 365 then
    perform public.att_raise('LEAVE_DATE_TOO_FAR', 'Leave can be marked up to one year ahead.');
  end if;

  select * into v_day from public.attendance
   where user_id = p_user_id and work_date = p_work_date
   for update;
  if found then
    if v_day.status = 'leave' then
      perform public.att_raise('ALREADY_ON_LEAVE', 'This day is already marked as leave.');
    end if;
    perform public.att_raise('DAY_HAS_ATTENDANCE', 'You already have attendance on this day.');
  end if;

  insert into public.attendance (user_id, work_date, timezone, status, worked_minutes, leave_reason)
  values (p_user_id, p_work_date, p_timezone, 'leave', 0, btrim(p_reason))
  returning * into v_day;

  v_after := public.att_day_snapshot(v_day.id);
  perform public.att_audit(p_user_id, v_day.id, p_work_date, 'leave_mark', 'user', btrim(p_reason), null, v_after);
  return v_after;
end;
$$;

create or replace function public.att_cancel_leave(
  p_user_id uuid, p_work_date date, p_reason text default null, p_now timestamptz default now()
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_day    public.attendance%rowtype;
  v_before jsonb;
begin
  select * into v_day from public.attendance
   where user_id = p_user_id and work_date = p_work_date
   for update;
  if not found or v_day.status <> 'leave' then
    perform public.att_raise('NOT_ON_LEAVE', 'This day is not marked as leave.');
  end if;
  if p_work_date < (p_now at time zone v_day.timezone)::date - 30 then
    perform public.att_raise('OUTSIDE_CORRECTION_WINDOW', 'Leave older than 30 days cannot be cancelled.');
  end if;

  v_before := public.att_day_snapshot(v_day.id);
  delete from public.attendance where id = v_day.id;
  perform public.att_audit(p_user_id, v_day.id, p_work_date, 'leave_cancel', 'user',
                           nullif(btrim(coalesce(p_reason, '')), ''), v_before, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: service_role only. Supabase grants EXECUTE on new
-- public functions to anon/authenticated by default — without this, anyone
-- with the public anon key could call e.g. att_clock_in for another user id
-- straight through PostgREST.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.att_raise(text, text),
  public.att_day_snapshot(uuid),
  public.att_audit(uuid, uuid, date, text, text, text, jsonb, jsonb),
  public.att_recalc_day(uuid),
  public.att_clock_in(uuid, text, timestamptz),
  public.att_clock_out(uuid, timestamptz),
  public.att_break_start(uuid, timestamptz),
  public.att_break_end(uuid, timestamptz),
  public.att_auto_close(timestamptz),
  public.att_regularize(uuid, date, text, jsonb, text, timestamptz),
  public.att_mark_leave(uuid, date, text, text, timestamptz),
  public.att_cancel_leave(uuid, date, text, timestamptz),
  public.check_rate_limit(text, int, int)   -- same exposure, from 0002
  from public, anon, authenticated;

grant execute on function
  public.att_raise(text, text),
  public.att_audit(uuid, uuid, date, text, text, text, jsonb, jsonb),
  public.att_recalc_day(uuid),
  public.att_clock_in(uuid, text, timestamptz),
  public.att_clock_out(uuid, timestamptz),
  public.att_break_start(uuid, timestamptz),
  public.att_break_end(uuid, timestamptz),
  public.att_auto_close(timestamptz),
  public.att_regularize(uuid, date, text, jsonb, text, timestamptz),
  public.att_mark_leave(uuid, date, text, text, timestamptz),
  public.att_cancel_leave(uuid, date, text, timestamptz),
  public.att_day_snapshot(uuid),
  public.check_rate_limit(text, int, int)
  to service_role;
