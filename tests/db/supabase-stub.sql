-- Minimal stand-in for the parts of a Supabase project the migrations rely
-- on, so they can run in PGlite (in-process Postgres) for tests:
-- the auth schema/users table, auth.uid(), the three API roles, and
-- Supabase's default privileges (anon/authenticated get access to new
-- public tables & functions — which is exactly what 0003 has to revoke).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
