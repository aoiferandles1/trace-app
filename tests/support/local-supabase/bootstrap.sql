-- The parts of a Supabase project the migrations in supabase/migrations/
-- expect to exist before they run, recreated for PGlite (Postgres 17 in
-- WebAssembly). Test-only: see tests/support/local-supabase/README.md.
--
-- Nothing here is Trace's own schema. If a migration needs something else
-- from Supabase (a schema, role, extension), add it here; never edit an
-- applied migration to suit the stand-in.

-- The API roles. PostgREST switches to one of these for every request.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

-- Supabase's default privileges: the API roles may use the public schema,
-- and every new table, sequence and function there is granted to them (the
-- migrations then revoke what they do not want, as on the hosted project).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- pgcrypto lives in "extensions" on Supabase (gen_random_bytes and friends).
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto with schema extensions;

-- auth: the users table (the columns GoTrue keeps; the migrations and the
-- stand-in's auth endpoints read a handful of them) and the JWT helpers,
-- which read the claims PostgREST puts in `request.jwt.claims`.
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  instance_id                 uuid,
  id                          uuid primary key,
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255),
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          varchar(255),
  confirmation_sent_at        timestamptz,
  recovery_token              varchar(255),
  recovery_sent_at            timestamptz,
  email_change_token_new      varchar(255),
  email_change                varchar(255),
  email_change_sent_at        timestamptz,
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb,
  raw_user_meta_data          jsonb,
  is_super_admin              boolean,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  phone                       text unique default null,
  phone_confirmed_at          timestamptz,
  phone_change                text default '',
  phone_change_token          varchar(255) default '',
  phone_change_sent_at        timestamptz,
  confirmed_at                timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current  varchar(255) default '',
  email_change_confirm_status smallint default 0,
  banned_until                timestamptz,
  reauthentication_token      varchar(255) default '',
  reauthentication_sent_at    timestamptz,
  is_sso_user                 boolean not null default false,
  deleted_at                  timestamptz,
  is_anonymous                boolean not null default false
);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt() to anon, authenticated, service_role;

-- Realtime's publication (the migrations add share_sessions to it).
create publication supabase_realtime;
