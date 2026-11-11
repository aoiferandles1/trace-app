-- Trace redesign (1 of 4): new columns and tables, row-level security, the
-- strength-period sync and the backfill.
--
-- Additive only. The live site keeps running the old code against this
-- database until the redesign ships: nothing here drops, renames or changes
-- the meaning of anything the old app or the old functions use.
--
--   medications        + unit (mg, mcg...). dose stays filled and in sync.
--   medication_periods   one row per strength the patient took (brief 4.1)
--   entries            + visit detail, text kind (reason, assessment, plan,
--                        prescription fields)
--   result_values        visit detail, result kind (rows with reference ranges)
--   health_events        the full timeline (brief 4.2)
--   health_event_prescriptions
--   relatives, relative_conditions   family history (brief 4.4)
--   insurance_connections            insurance, member number masked, no password
--   documents          + private.document_files (the bytes)
--   share_sessions     + four new scope switches (brief 4.5)
--   access_events      + the document_viewed event

-- ---------------------------------------------------------------------------
-- Composite keys, so a child row always belongs to the same user as its parent
-- ---------------------------------------------------------------------------

alter table public.medications add constraint medications_id_user_key unique (id, user_id);
alter table public.entries add constraint entries_id_user_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- medications: the unit of every strength period. Null on rows written before
-- the redesign; readers fall back to the unit in dose ("5mg").
-- ---------------------------------------------------------------------------

alter table public.medications
  add column unit text check (unit in ('mg', 'mcg', 'g', 'mL', 'units', 'IU'));

-- ---------------------------------------------------------------------------
-- entries: the text kind of visit detail. (The result kind is result_values.)
-- ---------------------------------------------------------------------------

alter table public.entries
  add column reason        text check (char_length(reason) <= 2000),
  add column assessment    text check (char_length(assessment) <= 5000),
  add column plan          text check (char_length(plan) <= 5000),
  add column rx_medication text check (char_length(rx_medication) <= 300),
  add column rx_quantity   text check (char_length(rx_quantity) <= 100),
  add column rx_pharmacy   text check (char_length(rx_pharmacy) <= 200);

-- ---------------------------------------------------------------------------
-- share_sessions: the new scopes, off unless the patient switches them on.
-- Full timeline and mental health already have columns.
-- ---------------------------------------------------------------------------

alter table public.share_sessions
  add column share_documents        boolean not null default false,
  add column share_family_history   boolean not null default false,
  add column share_insurance        boolean not null default false,
  add column share_medication_notes boolean not null default false;

-- access_events: one more event (widened, nothing removed).
alter table public.access_events drop constraint access_events_event_check;
alter table public.access_events add constraint access_events_event_check
  check (event in ('code_generated', 'requested', 'request_cancelled', 'approved',
                   'denied', 'expired', 'cancelled', 'section_viewed',
                   'notes_saved', 'extended', 'paused', 'ended', 'document_viewed'));

-- ---------------------------------------------------------------------------
-- medication_periods
-- ---------------------------------------------------------------------------

create table public.medication_periods (
  id             uuid primary key default gen_random_uuid(),
  medication_id  uuid not null,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  strength       numeric(12, 4) not null check (strength > 0 and strength < 100000),
  start_date     date not null,
  end_date       date,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year')),
  prescribed_by  text check (char_length(prescribed_by) <= 200),
  note           text check (char_length(note) <= 2000),
  note_shared    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint medication_periods_dates_check check (end_date is null or end_date >= start_date),
  constraint medication_periods_id_user_key unique (id, user_id),
  constraint medication_periods_medication_fkey foreign key (medication_id, user_id)
    references public.medications (id, user_id) on delete cascade
);

-- At most one open period per medication.
create unique index medication_periods_one_open_key on public.medication_periods (medication_id)
  where end_date is null;
create index medication_periods_medication_start_idx on public.medication_periods (medication_id, start_date desc);
create index medication_periods_user_idx on public.medication_periods (user_id);

-- ---------------------------------------------------------------------------
-- result_values: rows of a result entry
-- ---------------------------------------------------------------------------

create table public.result_values (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id   uuid not null,
  position   integer not null default 0 check (position between 0 and 1000),
  name       text not null check (char_length(name) between 1 and 120),
  value      numeric not null,
  unit       text check (char_length(unit) <= 40),
  ref_low    numeric,
  ref_high   numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_values_range_check check (ref_low is null or ref_high is null or ref_low <= ref_high),
  constraint result_values_entry_fkey foreign key (entry_id, user_id)
    references public.entries (id, user_id) on delete cascade
);

create index result_values_entry_idx on public.result_values (entry_id, position);
create index result_values_user_idx on public.result_values (user_id);

-- ---------------------------------------------------------------------------
-- health_events and their prescriptions
-- ---------------------------------------------------------------------------

create table public.health_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('infection', 'condition')),
  title            text not null check (char_length(title) between 1 and 200),
  occurred_on      date not null,
  date_precision   text not null default 'month' check (date_precision in ('day', 'month', 'year')),
  clinician        text check (char_length(clinician) <= 200),
  place            text check (char_length(place) <= 200),
  outcome          text check (outcome in ('resolved', 'settled', 'ongoing', 'seasonal', 'managed')),
  notes            text check (char_length(notes) <= 5000),
  is_mental_health boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint health_events_id_user_key unique (id, user_id)
);

create index health_events_user_occurred_idx on public.health_events (user_id, occurred_on desc);

create table public.health_event_prescriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id             uuid not null,
  position             integer not null default 0 check (position between 0 and 1000),
  name                 text not null check (char_length(name) between 1 and 200),
  detail               text check (char_length(detail) <= 300),
  medication_id        uuid,
  medication_period_id uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint health_event_prescriptions_event_fkey foreign key (event_id, user_id)
    references public.health_events (id, user_id) on delete cascade,
  constraint health_event_prescriptions_medication_fkey foreign key (medication_id, user_id)
    references public.medications (id, user_id) on delete set null (medication_id),
  constraint health_event_prescriptions_period_fkey foreign key (medication_period_id, user_id)
    references public.medication_periods (id, user_id) on delete set null (medication_period_id)
);

create index health_event_prescriptions_event_idx on public.health_event_prescriptions (event_id, position);
create index health_event_prescriptions_user_idx on public.health_event_prescriptions (user_id);
create index health_event_prescriptions_medication_idx on public.health_event_prescriptions (medication_id);
create index health_event_prescriptions_period_idx on public.health_event_prescriptions (medication_period_id);

-- ---------------------------------------------------------------------------
-- relatives and their conditions (family history)
-- ---------------------------------------------------------------------------

create table public.relatives (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  relation   text not null check (relation in (
               'mother', 'father',
               'maternal_grandmother', 'maternal_grandfather',
               'paternal_grandmother', 'paternal_grandfather',
               'sister', 'brother', 'daughter', 'son',
               'maternal_aunt', 'maternal_uncle', 'paternal_aunt', 'paternal_uncle',
               'other')),
  label      text check (char_length(label) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relatives_id_user_key unique (id, user_id)
);

create index relatives_user_idx on public.relatives (user_id);

create table public.relative_conditions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  relative_id      uuid not null,
  name             text not null check (char_length(name) between 1 and 200),
  age_at_diagnosis integer check (age_at_diagnosis between 0 and 130),
  category         text check (category in ('heart', 'diabetes', 'asthma', 'cancer', 'stroke', 'other')),
  is_mental_health boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint relative_conditions_relative_fkey foreign key (relative_id, user_id)
    references public.relatives (id, user_id) on delete cascade
);

create index relative_conditions_relative_idx on public.relative_conditions (relative_id);
create index relative_conditions_user_idx on public.relative_conditions (user_id);

-- ---------------------------------------------------------------------------
-- insurance_connections. Insurance is a mock on every account (owner's
-- decision). There is deliberately no column that could hold a password or a
-- token, and the member number is stored as its last four characters only.
-- Written only through save_insurance(); the browser may toggle
-- include_in_shares and delete.
-- ---------------------------------------------------------------------------

create table public.insurance_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider            text not null check (char_length(provider) between 1 and 100),
  member_number_last4 text not null check (member_number_last4 ~ '^[0-9A-Za-z]{4}$'),
  plan_name           text check (char_length(plan_name) <= 100),
  renews_on           date,
  via                 text not null check (via in ('provider', 'manual')),
  include_in_shares   boolean not null default false,
  connected_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint insurance_connections_one_per_user_key unique (user_id)
);

-- ---------------------------------------------------------------------------
-- documents: metadata in public, bytes in private (owner's decision: in the
-- database, behind the same functions as the rest of the record). The bytes
-- table checks the leading bytes against the declared type and the size
-- against the metadata, so nothing else can land there.
-- ---------------------------------------------------------------------------

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  content_type     text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size        integer not null check (byte_size between 1 and 3145728),
  document_date    date,
  is_mental_health boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint documents_file_key unique (id, user_id, content_type, byte_size)
);

create index documents_user_idx on public.documents (user_id, created_at desc);

create table private.document_files (
  document_id  uuid primary key,
  user_id      uuid not null,
  content_type text not null,
  byte_size    integer not null,
  bytes        bytea not null,
  constraint document_files_size_check check (octet_length(bytes) = byte_size and byte_size <= 3145728),
  constraint document_files_type_check check (case content_type
    when 'application/pdf' then substring(bytes from 1 for 5) = '\x255044462d'::bytea   -- %PDF-
    when 'image/jpeg'      then substring(bytes from 1 for 3) = '\xffd8ff'::bytea
    when 'image/png'       then substring(bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea
    else false end),
  constraint document_files_document_fkey foreign key (document_id, user_id, content_type, byte_size)
    references public.documents (id, user_id, content_type, byte_size) on delete cascade
);

create index document_files_user_idx on private.document_files (user_id);
alter table private.document_files enable row level security;
revoke all on private.document_files from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger medication_periods_updated_at before update on public.medication_periods
  for each row execute function private.set_updated_at();
create trigger result_values_updated_at before update on public.result_values
  for each row execute function private.set_updated_at();
create trigger health_events_updated_at before update on public.health_events
  for each row execute function private.set_updated_at();
create trigger health_event_prescriptions_updated_at before update on public.health_event_prescriptions
  for each row execute function private.set_updated_at();
create trigger relatives_updated_at before update on public.relatives
  for each row execute function private.set_updated_at();
create trigger relative_conditions_updated_at before update on public.relative_conditions
  for each row execute function private.set_updated_at();
create trigger insurance_connections_updated_at before update on public.insurance_connections
  for each row execute function private.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- entries guard: session notes stay read-only, now including the new detail
-- columns. Same rules as before for every column that existed.
-- ---------------------------------------------------------------------------

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
        new.source, new.session_id, new.detail, new.created_at,
        new.reason, new.assessment, new.plan, new.rx_medication, new.rx_quantity, new.rx_pharmacy)
       is distinct from
       (old.user_id, old.kind, old.title, old.occurs_at, old.clinician, old.place, old.body,
        old.source, old.session_id, old.detail, old.created_at,
        old.reason, old.assessment, old.plan, old.rx_medication, old.rx_quantity, old.rx_pharmacy) then
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

revoke all on function private.guard_entries() from public;

-- ---------------------------------------------------------------------------
-- Strength periods follow medications written the old way.
--
-- The old app knows nothing about periods: it writes dose ("36mg"),
-- started_on and ended_on. This trigger keeps the periods in step:
--   * a new medication with a dose that reads as "<number><unit>" gets its
--     first period (start = started_on, end = ended_on);
--   * a dose that changes to another strength closes the open period today
--     and opens a new one (never overwrites), unless the open period started
--     today or the medication has ended, when the strength is corrected;
--   * ended_on closes (or reopens) the latest period; started_on moves the
--     first period's start.
-- log_strength_change() and the redesign seed manage periods themselves and
-- set trace.periods_managed for the rest of their own call, so this stays out.
-- ---------------------------------------------------------------------------

create or replace function private.parse_dose(p_dose text, out strength numeric, out unit text)
language sql
immutable
set search_path = ''
as $$
  select case when m[1]::numeric > 0 and m[1]::numeric < 100000 then m[1]::numeric end,
         case lower(m[2]) when 'mg' then 'mg' when 'mcg' then 'mcg' when 'µg' then 'mcg' when 'ug' then 'mcg'
                          when 'g' then 'g' when 'ml' then 'mL' when 'unit' then 'units' when 'units' then 'units'
                          when 'iu' then 'IU' end
    from (select regexp_match(coalesce(p_dose, ''),
            '^\s*([0-9]{1,5}(?:\.[0-9]{1,4})?)\s*(mg|mcg|µg|ug|g|ml|units?|iu)\s*$', 'i') as m) x;
$$;

create or replace function private.sync_medication_periods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  today date := private.today_local();
  latest public.medication_periods;
  first_p public.medication_periods;
  n integer;
begin
  if coalesce(current_setting('trace.periods_managed', true), '') = 'on' then
    return null;
  end if;

  select * into d from private.parse_dose(new.dose);
  select count(*) into n from public.medication_periods where medication_id = new.id;

  if tg_op = 'INSERT' or n = 0 then
    if d.strength is not null then
      insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date, prescribed_by)
      values (new.id, new.user_id, d.strength,
              least(coalesce(new.started_on, today), coalesce(new.ended_on, 'infinity'::date)),
              new.ended_on, left(new.prescriber, 200));
    end if;
    return null;
  end if;

  select * into latest from public.medication_periods
   where medication_id = new.id order by start_date desc, created_at desc limit 1;

  if new.dose is distinct from old.dose and d.strength is not null and d.strength <> latest.strength then
    if latest.end_date is null and latest.start_date < today
       and (new.ended_on is null or new.ended_on >= today) then
      update public.medication_periods set end_date = today where id = latest.id;
      insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date, prescribed_by)
      values (new.id, new.user_id, d.strength, today, null, left(new.prescriber, 200))
      returning * into latest;
    else
      update public.medication_periods set strength = d.strength where id = latest.id
      returning * into latest;
    end if;
  end if;

  if new.ended_on is distinct from old.ended_on then
    update public.medication_periods
       set end_date = case when new.ended_on is null then null else greatest(new.ended_on, start_date) end
     where id = latest.id;
  end if;

  if new.started_on is distinct from old.started_on and new.started_on is not null then
    select * into first_p from public.medication_periods
     where medication_id = new.id order by start_date, created_at limit 1;
    update public.medication_periods
       set start_date = least(new.started_on, coalesce(end_date, new.started_on))
     where id = first_p.id
       and not exists (select 1 from public.medication_periods q
                        where q.medication_id = new.id and q.id <> first_p.id
                          and q.start_date < new.started_on);
  end if;

  return null;
end;
$$;

revoke all on function private.parse_dose(text) from public;
revoke all on function private.sync_medication_periods() from public;

create trigger medications_sync_periods
  after insert or update of dose, started_on, ended_on on public.medications
  for each row execute function private.sync_medication_periods();

-- ---------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------

alter table public.medication_periods enable row level security;
alter table public.result_values enable row level security;
alter table public.health_events enable row level security;
alter table public.health_event_prescriptions enable row level security;
alter table public.relatives enable row level security;
alter table public.relative_conditions enable row level security;
alter table public.insurance_connections enable row level security;
alter table public.documents enable row level security;

revoke all on public.medication_periods, public.result_values, public.health_events,
              public.health_event_prescriptions, public.relatives, public.relative_conditions,
              public.insurance_connections, public.documents
  from public, anon, authenticated;

-- Full read and write, own rows.
grant select, insert, update, delete on public.result_values, public.health_events,
  public.health_event_prescriptions, public.relatives, public.relative_conditions to authenticated;

-- Periods: read; only the patient's own note and its sharing flag are
-- editable. New periods come from log_strength_change() or the sync trigger.
grant select on public.medication_periods to authenticated;
grant update (note, note_shared) on public.medication_periods to authenticated;

-- Insurance: read, toggle include_in_shares, disconnect. Connect through save_insurance().
grant select, delete on public.insurance_connections to authenticated;
grant update (include_in_shares) on public.insurance_connections to authenticated;

-- Documents: read the list, rename, date, flag, delete. Upload through upload_document().
grant select, delete on public.documents to authenticated;
grant update (title, document_date, is_mental_health) on public.documents to authenticated;

create policy medication_periods_select_own on public.medication_periods
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_periods_update_own on public.medication_periods
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy result_values_select_own on public.result_values
  for select to authenticated using ((select auth.uid()) = user_id);
create policy result_values_insert_own on public.result_values
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy result_values_update_own on public.result_values
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy result_values_delete_own on public.result_values
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy health_events_select_own on public.health_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy health_events_insert_own on public.health_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy health_events_update_own on public.health_events
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy health_events_delete_own on public.health_events
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy health_event_prescriptions_select_own on public.health_event_prescriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy health_event_prescriptions_insert_own on public.health_event_prescriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy health_event_prescriptions_update_own on public.health_event_prescriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy health_event_prescriptions_delete_own on public.health_event_prescriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy relatives_select_own on public.relatives
  for select to authenticated using ((select auth.uid()) = user_id);
create policy relatives_insert_own on public.relatives
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy relatives_update_own on public.relatives
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy relatives_delete_own on public.relatives
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy relative_conditions_select_own on public.relative_conditions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy relative_conditions_insert_own on public.relative_conditions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy relative_conditions_update_own on public.relative_conditions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy relative_conditions_delete_own on public.relative_conditions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy insurance_connections_select_own on public.insurance_connections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy insurance_connections_update_own on public.insurance_connections
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy insurance_connections_delete_own on public.insurance_connections
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy documents_select_own on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy documents_update_own on public.documents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy documents_delete_own on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Backfill: every existing medication whose dose reads as a strength gets its
-- first period, from what is there (dose, started_on, ended_on, prescriber).
-- Nothing in the existing rows changes (unit stays null; readers take it from
-- dose).
-- ---------------------------------------------------------------------------

insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date, prescribed_by)
select m.id, m.user_id, d.strength,
       least(coalesce(m.started_on, (m.created_at at time zone 'Europe/Dublin')::date),
             coalesce(m.ended_on, 'infinity'::date)),
       m.ended_on, left(m.prescriber, 200)
  from public.medications m
  cross join lateral private.parse_dose(m.dose) d
 where d.strength is not null
   and not exists (select 1 from public.medication_periods p where p.medication_id = m.id);
