-- 0002_attendance_refinements.sql
-- Adds a hard DB-level guarantee for "no clock-in while already clocked in"
-- (the per-day unique constraint from 0001 alone doesn't catch a session left
-- open across midnight), plus an atomic rate-limit RPC used by Netlify
-- Functions instead of a paid Redis add-on.

-- ---------------------------------------------------------------------------
-- At most one open ("working") session per user, regardless of work_date.
-- A partial unique index closes the race window a check-then-insert in
-- application code cannot: two concurrent clock-in requests will have one
-- fail with a 23505 unique-violation, which the function maps to 409.
-- ---------------------------------------------------------------------------
create unique index if not exists attendance_one_open_session_per_user
  on public.attendance (user_id)
  where (status = 'working');

-- ---------------------------------------------------------------------------
-- Atomic fixed-window rate limiter.
-- Called by Netlify Functions with the service-role key. Single UPSERT
-- statement, so concurrent calls for the same key can't race each other.
-- Returns true if the call is within the limit, false if it should be
-- rejected with 429.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
as $$
declare
  v_hit_count int;
begin
  insert into public.rate_limits (key, hit_count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hit_count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.hit_count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning hit_count into v_hit_count;

  return v_hit_count <= p_limit;
end;
$$;

comment on function public.check_rate_limit is
  'Atomic fixed-window rate limit check. Increments (or resets, if the window elapsed) the counter for p_key and returns whether the call is still within p_limit for the current p_window_seconds window.';
