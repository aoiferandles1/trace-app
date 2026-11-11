-- Trace: schemas, tables, indexes, row-level security and table privileges.
--
-- public  : the patient's own data, read and written from the browser under RLS.
-- private : server-only tables (invite list, server-secret hash, portal attempts,
--           portal token bindings). Not exposed through the API: anon and
--           authenticated have no usage on the schema.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers used by triggers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by a trigger on auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  first_name        text check (char_length(first_name) <= 100),
  last_name         text check (char_length(last_name) <= 100),
  date_of_birth     date,
  sex               text check (char_length(sex) <= 40),
  country           text check (char_length(country) <= 100),
  city              text check (char_length(city) <= 100),
  address           text check (char_length(address) <= 300),
  phone             text check (char_length(phone) <= 40),
  blood_type        text check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  allergies         text[] not null default '{}',
  implants          text[] not null default '{}',
  email_reminders   boolean not null default false,
  terms_accepted_at timestamptz,
  onboarding_step   text not null default 'about'
                    check (onboarding_step in ('about', 'medical', 'privacy', 'profiles', 'welcome', 'done')),
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Patient-owned record tables
-- ---------------------------------------------------------------------------

create table public.conditions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 200),
  status           text not null default 'ongoing' check (status in ('managed', 'ongoing', 'resolved')),
  clinician        text check (char_length(clinician) <= 200),
  specialty        text check (char_length(specialty) <= 200),
  diagnosed_year   integer check (diagnosed_year between 1900 and 2200),
  diagnosed_note   text check (char_length(diagnosed_note) <= 200),
  is_mental_health boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- No mental health flag on purpose: medications always travel.
create table public.medications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 200),
  dose                 text check (char_length(dose) <= 100),
  form                 text check (char_length(form) <= 100),
  frequency            text check (char_length(frequency) <= 100),
  timing               text check (char_length(timing) <= 100),
  drug_class           text check (char_length(drug_class) <= 100),
  prescriber           text check (char_length(prescriber) <= 200),
  prescriber_specialty text check (char_length(prescriber_specialty) <= 200),
  prescriber_org       text check (char_length(prescriber_org) <= 200),
  indication           text check (char_length(indication) <= 200),
  started_on           date,
  ended_on             date,
  instructions         text check (char_length(instructions) <= 2000),
  refill_due_on        date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('visit', 'result', 'prescription', 'note', 'letter',
                                                 'imaging', 'vaccination', 'session_notes')),
  title            text not null check (char_length(title) between 1 and 300),
  occurs_at        timestamptz not null,
  clinician        text check (char_length(clinician) <= 200),
  place            text check (char_length(place) <= 200),
  body             text check (char_length(body) <= 20000),
  is_mental_health boolean not null default false,
  source           text not null default 'patient' check (source in ('patient', 'clinician_session')),
  session_id       uuid,  -- foreign key added below, after share_sessions exists
  detail           jsonb,  -- session_notes only: the four note fields and the clinician
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.care_team (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  role         text check (char_length(role) <= 200),
  organisation text check (char_length(organisation) <= 200),
  kind         text not null default 'gp' check (kind in ('gp', 'specialist', 'pharmacy')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.vitals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  systolic    integer check (systolic between 30 and 300),
  diastolic   integer check (diastolic between 10 and 200),
  heart_rate  integer check (heart_rate between 10 and 300),
  weight_kg   numeric(5, 1) check (weight_kg between 0 and 700),
  spo2        integer check (spo2 between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sharing: sessions and the access log. Read-only to the owner; every change
-- goes through a security definer function.
-- ---------------------------------------------------------------------------

create table public.share_sessions (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references auth.users (id) on delete cascade,
  status               text not null default 'code_issued'
                       check (status in ('code_issued', 'requested', 'active', 'paused',
                                         'ended', 'denied', 'expired', 'cancelled')),
  code                 text not null check (code ~ '^[0-9]{4}$'),
  code_expires_at      timestamptz not null,
  share_conditions     boolean not null,
  share_recent_visits  boolean not null,
  share_full_timeline  boolean not null,
  share_care_team      boolean not null,
  share_mental_health  boolean not null,
  allow_notes          boolean not null,
  duration_kind        text not null check (duration_kind in ('30m', '1h', 'all_day', 'manual')),
  clinician_name       text check (char_length(clinician_name) <= 100),
  clinician_role       text check (char_length(clinician_role) <= 60),
  clinician_practice   text check (char_length(clinician_practice) <= 120),
  portal_token_hash    text,
  requested_at         timestamptz,
  request_expires_at   timestamptz,
  approved_at          timestamptz,
  expires_at           timestamptz,
  paused_at            timestamptz,
  ended_at             timestamptz,
  ended_by             text check (ended_by in ('patient', 'clinician', 'timeout')),
  appointment_entry_id uuid references public.entries (id) on delete set null,
  chief_complaint      text check (char_length(chief_complaint) <= 5000),
  assessment           text check (char_length(assessment) <= 5000),
  plan                 text check (char_length(plan) <= 5000),
  follow_up            text check (char_length(follow_up) <= 5000),
  notes_updated_at     timestamptz,
  notes_entry_id       uuid references public.entries (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.entries
  add constraint entries_session_id_fkey
  foreign key (session_id) references public.share_sessions (id) on delete set null;

-- A code is unique among live codes (code_issued, and requested, which can
-- go back to code_issued when the doctor cancels).
create unique index share_sessions_live_code_key
  on public.share_sessions (code) where status in ('code_issued', 'requested');

-- A patient has at most one live session.
create unique index share_sessions_one_live_per_patient_key
  on public.share_sessions (patient_id) where status in ('code_issued', 'requested', 'active', 'paused');

create index share_sessions_patient_created_idx on public.share_sessions (patient_id, created_at desc);
create index share_sessions_code_idx on public.share_sessions (code);
create index share_sessions_appointment_entry_idx on public.share_sessions (appointment_entry_id);
create index share_sessions_notes_entry_idx on public.share_sessions (notes_entry_id);

create table public.access_events (
  id         bigint generated always as identity primary key,
  session_id uuid references public.share_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  at         timestamptz not null default now(),
  actor      text not null check (actor in ('patient', 'clinician', 'system')),
  event      text not null check (event in ('code_generated', 'requested', 'request_cancelled', 'approved',
                                            'denied', 'expired', 'cancelled', 'section_viewed',
                                            'notes_saved', 'extended', 'paused', 'ended')),
  detail     jsonb not null default '{}'::jsonb
);

create index access_events_patient_at_idx on public.access_events (patient_id, at desc);
create index access_events_session_idx on public.access_events (session_id, at);

create index conditions_user_idx on public.conditions (user_id);
create index medications_user_idx on public.medications (user_id);
create index entries_user_occurs_idx on public.entries (user_id, occurs_at desc);
create index entries_session_idx on public.entries (session_id);
create index care_team_user_idx on public.care_team (user_id);
create index vitals_user_recorded_idx on public.vitals (user_id, recorded_on desc);

-- ---------------------------------------------------------------------------
-- Private tables (server only)
-- ---------------------------------------------------------------------------

create table private.allowed_emails (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);

create table private.server_secrets (
  name       text primary key,
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table private.portal_attempts (
  id                bigint generated always as identity primary key,
  portal_token_hash text not null,
  ip_hash           text not null,
  at                timestamptz not null default now(),
  ok                boolean not null,
  result            text not null
);

create index portal_attempts_token_at_idx on private.portal_attempts (portal_token_hash, at desc);
create index portal_attempts_ip_at_idx on private.portal_attempts (ip_hash, at desc);

-- Which session a portal browser (its token hash) is currently looking at.
create table private.portal_bindings (
  portal_token_hash text primary key,
  session_id        uuid references public.share_sessions (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create index portal_bindings_session_idx on private.portal_bindings (session_id);

alter table private.allowed_emails enable row level security;
alter table private.server_secrets enable row level security;
alter table private.portal_attempts enable row level security;
alter table private.portal_bindings enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger conditions_updated_at before update on public.conditions
  for each row execute function private.set_updated_at();
create trigger medications_updated_at before update on public.medications
  for each row execute function private.set_updated_at();
create trigger entries_updated_at before update on public.entries
  for each row execute function private.set_updated_at();
create trigger care_team_updated_at before update on public.care_team
  for each row execute function private.set_updated_at();
create trigger vitals_updated_at before update on public.vitals
  for each row execute function private.set_updated_at();
create trigger share_sessions_updated_at before update on public.share_sessions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards on what the browser may change (they apply only when the API roles
-- write directly; the security definer functions run as their owner).
-- ---------------------------------------------------------------------------

-- profiles: the browser may not change id, is_demo or created_at.
create or replace function private.guard_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.id is distinct from old.id
          or new.is_demo is distinct from old.is_demo
          or new.created_at is distinct from old.created_at) then
    raise exception 'read_only_field'
      using errcode = '42501', detail = 'id, is_demo and created_at cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profiles();

-- entries: the browser writes only patient entries. Session notes written by a
-- doctor are read-only apart from the is_mental_health flag, and can be deleted.
create or replace function private.guard_entries()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.kind = 'session_notes' or new.source <> 'patient'
       or new.session_id is not null or new.detail is not null then
      raise exception 'session_notes_read_only'
        using errcode = '42501', detail = 'Only a sharing session can write session notes.';
    end if;
  elsif old.source = 'clinician_session' then
    if (new.user_id, new.kind, new.title, new.occurs_at, new.clinician, new.place, new.body,
        new.source, new.session_id, new.detail, new.created_at)
       is distinct from
       (old.user_id, old.kind, old.title, old.occurs_at, old.clinician, old.place, old.body,
        old.source, old.session_id, old.detail, old.created_at) then
      raise exception 'session_notes_read_only'
        using errcode = '42501', detail = 'Only is_mental_health can be changed on session notes.';
    end if;
  else
    if new.kind = 'session_notes' or new.source <> 'patient'
       or new.session_id is not null or new.detail is not null then
      raise exception 'session_notes_read_only'
        using errcode = '42501', detail = 'Only a sharing session can write session notes.';
    end if;
  end if;
  return new;
end;
$$;

create trigger entries_guard before insert or update on public.entries
  for each row execute function private.guard_entries();

revoke all on function private.set_updated_at() from public;
revoke all on function private.guard_profiles() from public;
revoke all on function private.guard_entries() from public;

-- ---------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.conditions enable row level security;
alter table public.medications enable row level security;
alter table public.entries enable row level security;
alter table public.care_team enable row level security;
alter table public.vitals enable row level security;
alter table public.share_sessions enable row level security;
alter table public.access_events enable row level security;

-- Start from nothing, then grant exactly what the browser needs.
revoke all on public.profiles, public.conditions, public.medications, public.entries,
              public.care_team, public.vitals, public.share_sessions, public.access_events
  from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.conditions, public.medications, public.entries,
                                        public.care_team, public.vitals to authenticated;
grant select on public.share_sessions, public.access_events to authenticated;

-- profiles: the row is created by the auth trigger and deleted with the user.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The five record tables share one policy family.
create policy conditions_select_own on public.conditions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy conditions_insert_own on public.conditions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy conditions_update_own on public.conditions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy conditions_delete_own on public.conditions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy medications_select_own on public.medications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medications_insert_own on public.medications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medications_update_own on public.medications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy medications_delete_own on public.medications
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy entries_select_own on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy entries_insert_own on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy entries_update_own on public.entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy entries_delete_own on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy care_team_select_own on public.care_team
  for select to authenticated using ((select auth.uid()) = user_id);
create policy care_team_insert_own on public.care_team
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy care_team_update_own on public.care_team
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy care_team_delete_own on public.care_team
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy vitals_select_own on public.vitals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy vitals_insert_own on public.vitals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vitals_update_own on public.vitals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy vitals_delete_own on public.vitals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Read-only to the owner.
create policy share_sessions_select_own on public.share_sessions
  for select to authenticated using ((select auth.uid()) = patient_id);
create policy access_events_select_own on public.access_events
  for select to authenticated using ((select auth.uid()) = patient_id);
