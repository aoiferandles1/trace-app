-- Trace: the share session state machine and the patient-side functions.
--
--   code_issued --correct code typed in the portal, within 5 min--> requested
--   code_issued --5 min pass--> expired
--   requested   --patient taps Allow--> active (expires_at from duration_kind)
--   requested   --patient taps Deny--> denied
--   requested   --doctor cancels--> code_issued (keeps its original code_expires_at)
--   requested   --5 min with no answer--> expired
--   active      --expires_at passes--> paused
--   paused      --patient adds 15 or 30 min--> active
--   paused      --patient ends, or 30 min pass--> ended
--   active      --patient or doctor ends--> ended
--   code_issued / requested --patient regenerates or cancels--> cancelled
--
-- Time-based transitions are applied lazily by private.advance_session(),
-- which every function that reads a session calls first.

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

create or replace function private.today_local()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Dublin')::date;
$$;

create or replace function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return uid;
end;
$$;

create or replace function private.log_event(
  p_session_id uuid, p_patient_id uuid, p_actor text, p_event text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.access_events (session_id, patient_id, actor, event, detail)
  values (p_session_id, p_patient_id, p_actor, p_event, coalesce(p_detail, '{}'::jsonb));
$$;

-- The patient-facing JSON for a session: the table row without the portal
-- token hash, plus closes_at (when a paused session ends on its own).
create or replace function private.patient_session_json(s public.share_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when s.id is null then null else
    (to_jsonb(s) - 'portal_token_hash')
    || jsonb_build_object('closes_at',
         case when s.status = 'paused' then s.paused_at + interval '30 minutes' end)
  end;
$$;

-- End a session that is active or paused. The caller must hold the row lock.
-- Writes the doctor's notes to the record when allowed and non-empty.
create or replace function private.finish_session(p_id uuid, p_by text, p_at timestamptz)
returns public.share_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.share_sessions;
  entry_id uuid;
  body_text text;
begin
  update public.share_sessions
     set status = 'ended', ended_at = p_at, ended_by = p_by, paused_at = null
   where id = p_id and status in ('active', 'paused')
  returning * into s;

  if not found then
    select * into s from public.share_sessions where id = p_id;
    return s;
  end if;

  if s.allow_notes
     and (nullif(btrim(coalesce(s.chief_complaint, '')), '') is not null
          or nullif(btrim(coalesce(s.assessment, '')), '') is not null
          or nullif(btrim(coalesce(s.plan, '')), '') is not null
          or nullif(btrim(coalesce(s.follow_up, '')), '') is not null) then
    body_text := concat_ws(E'\n\n',
      case when nullif(btrim(coalesce(s.chief_complaint, '')), '') is not null
           then 'Chief complaint: ' || btrim(s.chief_complaint) end,
      case when nullif(btrim(coalesce(s.assessment, '')), '') is not null
           then 'Assessment: ' || btrim(s.assessment) end,
      case when nullif(btrim(coalesce(s.plan, '')), '') is not null
           then 'Plan: ' || btrim(s.plan) end,
      case when nullif(btrim(coalesce(s.follow_up, '')), '') is not null
           then 'Follow-up: ' || btrim(s.follow_up) end);

    insert into public.entries (user_id, kind, title, occurs_at, clinician, place, body,
                                is_mental_health, source, session_id, detail)
    values (s.patient_id, 'session_notes', 'Session notes', p_at, s.clinician_name,
            s.clinician_practice, body_text, false, 'clinician_session', s.id,
            jsonb_build_object(
              'chief_complaint', nullif(btrim(coalesce(s.chief_complaint, '')), ''),
              'assessment', nullif(btrim(coalesce(s.assessment, '')), ''),
              'plan', nullif(btrim(coalesce(s.plan, '')), ''),
              'follow_up', nullif(btrim(coalesce(s.follow_up, '')), ''),
              'clinician_name', s.clinician_name,
              'clinician_role', s.clinician_role,
              'clinician_practice', s.clinician_practice))
    returning id into entry_id;

    update public.share_sessions set notes_entry_id = entry_id where id = s.id
    returning * into s;

    perform private.log_event(s.id, s.patient_id, 'clinician', 'notes_saved',
                              jsonb_build_object('entry_id', entry_id));
  end if;

  perform private.log_event(s.id, s.patient_id,
                            case p_by when 'timeout' then 'system' else p_by end,
                            'ended', jsonb_build_object('by', p_by));
  return s;
end;
$$;

-- Apply every time-based transition that is due, and return the row.
-- Takes the row lock, so callers can rely on the returned state.
create or replace function private.advance_session(p_id uuid)
returns public.share_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.share_sessions;
  t timestamptz := now();
begin
  select * into s from public.share_sessions where id = p_id for update;
  if not found then
    return null;
  end if;

  if s.status = 'code_issued' and s.code_expires_at <= t then
    update public.share_sessions set status = 'expired' where id = s.id returning * into s;
    perform private.log_event(s.id, s.patient_id, 'system', 'expired', '{"stage":"code"}'::jsonb);
  elsif s.status = 'requested' and s.request_expires_at <= t then
    update public.share_sessions set status = 'expired' where id = s.id returning * into s;
    perform private.log_event(s.id, s.patient_id, 'system', 'expired', '{"stage":"request"}'::jsonb);
  end if;

  if s.status = 'active' and s.expires_at <= t then
    update public.share_sessions set status = 'paused', paused_at = s.expires_at
     where id = s.id returning * into s;
    perform private.log_event(s.id, s.patient_id, 'system', 'paused', '{"reason":"timer"}'::jsonb);
  end if;

  if s.status = 'paused' and s.paused_at + interval '30 minutes' <= t then
    s := private.finish_session(s.id, 'timeout', s.paused_at + interval '30 minutes');
  end if;

  return s;
end;
$$;

-- The caller's newest session, advanced. Because a new code cancels any live
-- session, the newest session is the live one whenever one exists.
create or replace function private.newest_session_for(p_uid uuid)
returns public.share_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select id into sid from public.share_sessions
   where patient_id = p_uid
   order by created_at desc, id desc
   limit 1;
  if sid is null then
    return null;
  end if;
  return private.advance_session(sid);
end;
$$;

-- A 4-digit code from a cryptographically strong source.
create or replace function private.random_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 10000)::text, 4, '0');
$$;

revoke all on function private.today_local() from public;
revoke all on function private.require_uid() from public;
revoke all on function private.log_event(uuid, uuid, text, text, jsonb) from public;
revoke all on function private.patient_session_json(public.share_sessions) from public;
revoke all on function private.finish_session(uuid, text, timestamptz) from public;
revoke all on function private.advance_session(uuid) from public;
revoke all on function private.newest_session_for(uuid) from public;
revoke all on function private.random_code() from public;

-- ---------------------------------------------------------------------------
-- Patient functions (signed-in users, including anonymous demo users)
-- ---------------------------------------------------------------------------

create or replace function public.create_share_code(
  share_conditions     boolean default true,
  share_recent_visits  boolean default true,
  share_full_timeline  boolean default false,
  share_care_team      boolean default true,
  share_mental_health  boolean default false,
  allow_notes          boolean default true,
  duration_kind        text    default '30m',
  appointment_entry_id uuid    default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  live public.share_sessions;
  s public.share_sessions;
  new_code text;
  conflict text;
  attempt integer := 0;
begin
  if create_share_code.duration_kind is null
     or create_share_code.duration_kind not in ('30m', '1h', 'all_day', 'manual') then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  if create_share_code.share_conditions is null or create_share_code.share_recent_visits is null
     or create_share_code.share_full_timeline is null or create_share_code.share_care_team is null
     or create_share_code.share_mental_health is null or create_share_code.allow_notes is null then
    raise exception 'invalid_preferences' using errcode = '22023';
  end if;

  if create_share_code.appointment_entry_id is not null
     and not exists (select 1 from public.entries e
                      where e.id = create_share_code.appointment_entry_id
                        and e.user_id = uid and e.kind = 'visit') then
    raise exception 'invalid_appointment' using errcode = '22023';
  end if;

  live := private.newest_session_for(uid);
  if live.status in ('active', 'paused') then
    raise exception 'session_live' using errcode = '55000',
      detail = 'End the live session before generating a new code.';
  elsif live.status in ('code_issued', 'requested') then
    update public.share_sessions set status = 'cancelled' where id = live.id;
    perform private.log_event(live.id, uid, 'patient', 'cancelled', '{"reason":"regenerated"}'::jsonb);
  end if;

  loop
    attempt := attempt + 1;
    new_code := private.random_code();
    begin
      insert into public.share_sessions (
        patient_id, status, code, code_expires_at,
        share_conditions, share_recent_visits, share_full_timeline, share_care_team,
        share_mental_health, allow_notes, duration_kind, appointment_entry_id)
      values (
        uid, 'code_issued', new_code, now() + interval '5 minutes',
        create_share_code.share_conditions, create_share_code.share_recent_visits,
        create_share_code.share_full_timeline, create_share_code.share_care_team,
        create_share_code.share_mental_health, create_share_code.allow_notes,
        create_share_code.duration_kind, create_share_code.appointment_entry_id)
      returning * into s;
      exit;
    exception when unique_violation then
      get stacked diagnostics conflict = constraint_name;
      if conflict = 'share_sessions_one_live_per_patient_key' then
        raise exception 'session_live' using errcode = '55000';
      end if;
      if attempt >= 50 then
        raise exception 'no_code_available' using errcode = '55000';
      end if;
    end;
  end loop;

  perform private.log_event(s.id, uid, 'patient', 'code_generated', jsonb_build_object(
    'share_conditions', s.share_conditions,
    'share_recent_visits', s.share_recent_visits,
    'share_full_timeline', s.share_full_timeline,
    'share_care_team', s.share_care_team,
    'share_mental_health', s.share_mental_health,
    'allow_notes', s.allow_notes,
    'duration_kind', s.duration_kind,
    'appointment_entry_id', s.appointment_entry_id));

  return private.patient_session_json(s);
end;
$$;

create or replace function public.respond_to_request(session_id uuid, allow boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  s public.share_sessions;
  new_expiry timestamptz;
begin
  if respond_to_request.allow is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if not exists (select 1 from public.share_sessions x
                  where x.id = respond_to_request.session_id and x.patient_id = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  s := private.advance_session(respond_to_request.session_id);
  if s.status <> 'requested' then
    raise exception 'not_requested' using errcode = '55000', detail = s.status;
  end if;

  if respond_to_request.allow then
    new_expiry := case s.duration_kind
      when '30m' then now() + interval '30 minutes'
      when '1h' then now() + interval '1 hour'
      when 'all_day' then (private.today_local() + time '23:59') at time zone 'Europe/Dublin'
      else now() + interval '12 hours'
    end;
    update public.share_sessions
       set status = 'active', approved_at = now(), expires_at = new_expiry
     where id = s.id returning * into s;
    perform private.log_event(s.id, uid, 'patient', 'approved',
      jsonb_build_object('expires_at', s.expires_at, 'duration_kind', s.duration_kind));
  else
    update public.share_sessions set status = 'denied' where id = s.id returning * into s;
    perform private.log_event(s.id, uid, 'patient', 'denied', '{}'::jsonb);
  end if;

  return private.patient_session_json(s);
end;
$$;

create or replace function public.extend_session(minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  s public.share_sessions;
  was text;
  new_expiry timestamptz;
  hard_stop timestamptz;
begin
  if extend_session.minutes is null or extend_session.minutes not in (15, 30) then
    raise exception 'invalid_minutes' using errcode = '22023';
  end if;

  s := private.newest_session_for(uid);
  if s.id is null or s.status not in ('active', 'paused') then
    raise exception 'no_live_session' using errcode = '55000';
  end if;

  was := s.status;
  hard_stop := s.approved_at + interval '12 hours';
  if s.status = 'paused' then
    new_expiry := now() + make_interval(mins => extend_session.minutes);
  else
    new_expiry := s.expires_at + make_interval(mins => extend_session.minutes);
  end if;
  new_expiry := least(new_expiry, hard_stop);
  if new_expiry <= now() then
    raise exception 'session_limit_reached' using errcode = '55000',
      detail = 'A session cannot run longer than 12 hours.';
  end if;

  update public.share_sessions
     set status = 'active', expires_at = new_expiry, paused_at = null
   where id = s.id returning * into s;
  perform private.log_event(s.id, uid, 'patient', 'extended',
    jsonb_build_object('minutes', extend_session.minutes, 'from', was, 'expires_at', s.expires_at));

  return private.patient_session_json(s);
end;
$$;

create or replace function public.end_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  s public.share_sessions;
begin
  s := private.newest_session_for(uid);
  if s.id is null then
    return null;
  end if;

  if s.status in ('active', 'paused') then
    s := private.finish_session(s.id, 'patient', now());
  elsif s.status in ('code_issued', 'requested') then
    update public.share_sessions set status = 'cancelled' where id = s.id returning * into s;
    perform private.log_event(s.id, uid, 'patient', 'cancelled', '{"reason":"patient"}'::jsonb);
  else
    return null;
  end if;

  return private.patient_session_json(s);
end;
$$;

create or replace function public.my_share_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  return private.patient_session_json(private.newest_session_for(uid));
end;
$$;

revoke all on function public.create_share_code(boolean, boolean, boolean, boolean, boolean, boolean, text, uuid)
  from public, anon, authenticated;
revoke all on function public.respond_to_request(uuid, boolean) from public, anon, authenticated;
revoke all on function public.extend_session(integer) from public, anon, authenticated;
revoke all on function public.end_session() from public, anon, authenticated;
revoke all on function public.my_share_session() from public, anon, authenticated;

grant execute on function public.create_share_code(boolean, boolean, boolean, boolean, boolean, boolean, text, uuid)
  to authenticated;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;
grant execute on function public.extend_session(integer) to authenticated;
grant execute on function public.end_session() to authenticated;
grant execute on function public.my_share_session() to authenticated;
