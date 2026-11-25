-- 0001_init.sql
-- Clock In / Clock Out — initial schema
-- Target: Supabase Postgres (Free Tier)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enum: attendance_status
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('working', 'completed');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Table: attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  work_date       date not null,
  clock_in        timestamptz not null,
  clock_out       timestamptz,
  timezone        text not null,
  worked_minutes  integer,
  status          attendance_status not null default 'working',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint attendance_user_date_unique unique (user_id, work_date),

  constraint attendance_clock_out_after_clock_in
    check (clock_out is null or clock_out > clock_in),

  constraint attendance_worked_minutes_non_negative
    check (worked_minutes is null or worked_minutes >= 0),

  constraint attendance_status_consistency
    check (
      (status = 'working'   and clock_out is null     and worked_minutes is null)
      or
      (status = 'completed' and clock_out is not null and worked_minutes is not null)
    )
);

comment on table public.attendance is
  'One row per user per calendar day. Enforces "one clock-in per day" via the unique (user_id, work_date) constraint.';
comment on column public.attendance.work_date is
  'Local calendar date at clock-in time (NOT derived from clock_in::date, which would use UTC).';
comment on column public.attendance.timezone is
  'IANA timezone captured client-side at clock-in, e.g. Asia/Kolkata.';
comment on column public.attendance.worked_minutes is
  'Persisted at clock-out time: round(extract(epoch from (clock_out - clock_in)) / 60).';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- attendance_user_date_unique (above) already indexes (user_id, work_date).

create index if not exists attendance_user_status_idx
  on public.attendance (user_id, status);

create index if not exists attendance_user_created_idx
  on public.attendance (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: attendance
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own
  on public.attendance for select
  using (auth.uid() = user_id);

drop policy if exists attendance_insert_own on public.attendance;
create policy attendance_insert_own
  on public.attendance for insert
  with check (auth.uid() = user_id);

drop policy if exists attendance_update_own on public.attendance;
create policy attendance_update_own
  on public.attendance for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists attendance_delete_own on public.attendance;
create policy attendance_delete_own
  on public.attendance for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table: rate_limits (server-side only, no RLS needed — only the service
-- role, used by Netlify Functions after JWT verification, ever touches it)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key           text primary key,
  hit_count     integer not null default 0,
  window_start  timestamptz not null default now()
);

comment on table public.rate_limits is
  'Fixed-window rate limiter counters keyed by "<endpoint>:<user_id>". Written only by Netlify Functions using the service-role key.';

alter table public.rate_limits enable row level security;
-- Intentionally no policies: with RLS enabled and zero policies, PostgREST/anon
-- and authenticated JWTs can never read or write this table. Only the
-- service-role key (which bypasses RLS entirely) can access it.
