-- Trace: the clinician portal functions.
--
-- The doctor has no account. The Next.js server calls these with the
-- publishable key, passing PORTAL_SERVER_SECRET as the first argument; each
-- function compares its SHA-256 with the hash in private.server_secrets and
-- raises invalid_server_secret if it does not match. The doctor's browser is
-- identified by a random portal token (an httpOnly cookie); the server passes
-- the raw token and the database stores only its SHA-256.
--
-- Rule: no portal function returns anything from the patient's record unless
-- the session is active at that moment, and only portal_get_record returns it.

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

create or replace function private.sha256_hex(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

create or replace function private.verify_server_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_secret is null
     or not exists (select 1 from private.server_secrets
                     where name = 'portal' and sha256_hex = private.sha256_hex(p_secret)) then
    raise exception 'invalid_server_secret' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.portal_token_hash(p_token text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'invalid_portal_token' using errcode = '22023',
      detail = 'The portal token must be 32 to 512 characters.';
  end if;
  return private.sha256_hex(p_token);
end;
$$;

-- The session this portal token is bound to, advanced; null if none.
create or replace function private.portal_session(p_token_hash text)
returns public.share_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  s public.share_sessions;
begin
  select session_id into sid from private.portal_bindings where portal_token_hash = p_token_hash;
  if sid is null then
    return null;
  end if;
  s := private.advance_session(sid);
  -- Belt and braces: the session must still carry this token.
  if s.id is null or s.portal_token_hash is distinct from p_token_hash then
    return null;
  end if;
  return s;
end;
$$;

-- When this token may try a code again: 5 wrong codes (since its last correct
-- one) within 15 minutes lock it for 15 minutes after the fifth.
create or replace function private.token_locked_until(p_token_hash text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  last_ok timestamptz;
  newest timestamptz;
  fifth timestamptz;
begin
  select max(at) into last_ok from private.portal_attempts
   where portal_token_hash = p_token_hash and ok;

  select max(at) filter (where rn = 1), max(at) filter (where rn = 5)
    into newest, fifth
    from (select at, row_number() over (order by at desc, id desc) as rn
            from private.portal_attempts
           where portal_token_hash = p_token_hash and not ok
             and at > coalesce(last_ok, '-infinity'::timestamptz)
             and at > now() - interval '30 minutes'
           order by at desc, id desc
           limit 5) w;

  if fifth is not null and fifth >= newest - interval '15 minutes'
     and newest + interval '15 minutes' > now() then
    return newest + interval '15 minutes';
  end if;
  return null;
end;
$$;

-- Wrong codes left before this token locks (5 minus wrong codes in the window).
create or replace function private.token_attempts_left(p_token_hash text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 5 - count(*))::integer
    from private.portal_attempts
   where portal_token_hash = p_token_hash and not ok
     and at > now() - interval '15 minutes'
     and at > coalesce((select max(at) from private.portal_attempts
                         where portal_token_hash = p_token_hash and ok), '-infinity'::timestamptz);
$$;

-- An IP hash may make 20 code attempts an hour.
create or replace function private.ip_locked_until(p_ip_hash text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) >= 20 then min(at) + interval '1 hour' end
    from (select at from private.portal_attempts
           where ip_hash = p_ip_hash and at > now() - interval '1 hour'
           order by at desc limit 20) w;
$$;

-- What the portal may know about its session. Holds nothing from the record.
create or replace function private.portal_status_json(s public.share_sessions, p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', coalesce(s.status, 'none'),
    'server_time', now(),
    'clinician', case when s.id is null then null else jsonb_build_object(
                   'name', s.clinician_name, 'role', s.clinician_role, 'practice', s.clinician_practice) end,
    'request_expires_at', case when s.status = 'requested' then s.request_expires_at end,
    'duration_kind', case when s.status in ('active', 'paused', 'ended') then s.duration_kind end,
    'approved_at', case when s.status in ('active', 'paused', 'ended') then s.approved_at end,
    'expires_at', case when s.status = 'active' then s.expires_at end,
    'paused_at', case when s.status = 'paused' then s.paused_at end,
    'closes_at', case when s.status = 'paused' then s.paused_at + interval '30 minutes' end,
    'ended_at', case when s.status = 'ended' then s.ended_at end,
    'ended_by', case when s.status = 'ended' then s.ended_by end,
    'allow_notes', case when s.status in ('active', 'paused') then s.allow_notes end,
    'scope', case when s.status = 'active' then jsonb_build_object(
               'critical_safety', true,
               'medications', true,
               'conditions', s.share_conditions,
               'recent_visits', s.share_recent_visits,
               'full_timeline', s.share_full_timeline,
               'care_team', s.share_care_team,
               'mental_health', s.share_mental_health,
               'documents', false,
               'insurance', false) end,
    'notes', case when s.status = 'active' and s.allow_notes then jsonb_build_object(
               'chief_complaint', s.chief_complaint,
               'assessment', s.assessment,
               'plan', s.plan,
               'follow_up', s.follow_up,
               'updated_at', s.notes_updated_at) end,
    'notes_saved_to_record', case when s.status = 'ended' then s.notes_entry_id is not null end,
    'locked_until', private.token_locked_until(p_token_hash));
$$;

-- The record as the doctor may see it, for one section. Applies the scope.
create or replace function private.portal_record_json(s public.share_sessions, p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := private.today_local();
  p public.profiles;
  shows_timeline boolean := s.share_recent_visits or s.share_full_timeline;
  want_conditions boolean := p_section in ('overview', 'conditions');
  want_medications boolean := p_section in ('overview', 'medications');
  want_timeline boolean := p_section in ('overview', 'timeline');
  want_care_team boolean := p_section = 'care_team';
  j_patient jsonb;
  j_critical jsonb;
  j_conditions jsonb;
  j_medications jsonb;
  j_vitals jsonb;
  j_timeline jsonb;
  j_upcoming jsonb;
  j_care_team jsonb;
begin
  select * into p from public.profiles where id = s.patient_id;

  j_patient := jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name,
    'date_of_birth', p.date_of_birth,
    'age', case when p.date_of_birth is null then null
                else extract(year from age(today, p.date_of_birth))::integer end,
    'sex', p.sex,
    'city', p.city);

  j_critical := jsonb_build_object(
    'blood_type', p.blood_type,
    'allergies', to_jsonb(coalesce(p.allergies, '{}'::text[])),
    'implants', to_jsonb(coalesce(p.implants, '{}'::text[])));

  if want_conditions and s.share_conditions then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.name, 'status', c.status, 'clinician', c.clinician,
             'specialty', c.specialty, 'diagnosed_year', c.diagnosed_year,
             'diagnosed_note', c.diagnosed_note, 'is_mental_health', c.is_mental_health)
             order by case c.status when 'resolved' then 1 else 0 end, c.created_at, c.id), '[]'::jsonb)
      into j_conditions
      from public.conditions c
     where c.user_id = s.patient_id
       and (s.share_mental_health or not c.is_mental_health);
  end if;

  if want_medications then
    select jsonb_build_object(
             'current', coalesce(jsonb_agg(m.j order by m.started_on desc nulls last, m.created_at, m.id)
                                 filter (where m.is_current), '[]'::jsonb),
             'expired', coalesce(jsonb_agg(m.j order by m.ended_on desc, m.created_at, m.id)
                                 filter (where not m.is_current), '[]'::jsonb))
      into j_medications
      from (select x.*, (x.ended_on is null or x.ended_on >= today) as is_current,
                   jsonb_build_object(
                     'id', x.id, 'name', x.name, 'dose', x.dose, 'form', x.form,
                     'frequency', x.frequency, 'timing', x.timing, 'drug_class', x.drug_class,
                     'prescriber', x.prescriber, 'prescriber_specialty', x.prescriber_specialty,
                     'prescriber_org', x.prescriber_org, 'indication', x.indication,
                     'started_on', x.started_on, 'ended_on', x.ended_on,
                     'instructions', x.instructions, 'refill_due_on', x.refill_due_on) as j
              from public.medications x
             where x.user_id = s.patient_id) m;
  end if;

  if want_timeline and shows_timeline then
    -- Past entries: the 3 most recent, or all with full timeline. Never notes;
    -- mental health only when switched on; never the visit this share is for.
    select coalesce(jsonb_agg(t.j order by t.occurs_at desc, t.id), '[]'::jsonb)
      into j_timeline
      from (select e.id, e.occurs_at,
                   jsonb_build_object(
                     'id', e.id, 'kind', e.kind, 'title', e.title, 'occurs_at', e.occurs_at,
                     'clinician', e.clinician, 'place', e.place, 'body', e.body,
                     'is_mental_health', e.is_mental_health, 'source', e.source,
                     'detail', e.detail) as j
              from public.entries e
             where e.user_id = s.patient_id
               and e.kind <> 'note'
               and (s.share_mental_health or not e.is_mental_health)
               and (s.appointment_entry_id is null or e.id <> s.appointment_entry_id)
               and e.occurs_at <= now()
             order by e.occurs_at desc, e.id
             limit case when s.share_full_timeline then null else 3 end) t;

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'kind', e.kind, 'title', e.title, 'occurs_at', e.occurs_at,
             'clinician', e.clinician, 'place', e.place, 'body', e.body,
             'is_mental_health', e.is_mental_health, 'source', e.source,
             'detail', e.detail) order by e.occurs_at, e.id), '[]'::jsonb)
      into j_upcoming
      from public.entries e
     where e.user_id = s.patient_id
       and e.kind <> 'note'
       and (s.share_mental_health or not e.is_mental_health)
       and (s.appointment_entry_id is null or e.id <> s.appointment_entry_id)
       and e.occurs_at > now();

    -- Latest vitals travel with the timeline (no switch of their own).
    select jsonb_build_object(
             'recorded_on', v.recorded_on, 'systolic', v.systolic, 'diastolic', v.diastolic,
             'heart_rate', v.heart_rate, 'weight_kg', v.weight_kg, 'spo2', v.spo2)
      into j_vitals
      from public.vitals v
     where v.user_id = s.patient_id
     order by v.recorded_on desc, v.created_at desc
     limit 1;
  end if;

  if want_care_team and s.share_care_team then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', ct.id, 'name', ct.name, 'role', ct.role,
             'organisation', ct.organisation, 'kind', ct.kind)
             order by case ct.kind when 'gp' then 0 when 'specialist' then 1 else 2 end,
                      ct.created_at, ct.id), '[]'::jsonb)
      into j_care_team
      from public.care_team ct
     where ct.user_id = s.patient_id;
  end if;

  return jsonb_build_object(
    'section', p_section,
    'patient', j_patient,
    'critical', j_critical,
    'scope', jsonb_build_object(
      'critical_safety', true,
      'medications', true,
      'conditions', s.share_conditions,
      'recent_visits', s.share_recent_visits,
      'full_timeline', s.share_full_timeline,
      'care_team', s.share_care_team,
      'mental_health', s.share_mental_health,
      'documents', false,
      'insurance', false),
    'conditions', j_conditions,
    'medications', j_medications,
    'vitals', j_vitals,
    'timeline', j_timeline,
    'upcoming', j_upcoming,
    'care_team', j_care_team);
end;
$$;

revoke all on function private.sha256_hex(text) from public;
revoke all on function private.verify_server_secret(text) from public;
revoke all on function private.portal_token_hash(text) from public;
revoke all on function private.portal_session(text) from public;
revoke all on function private.token_locked_until(text) from public;
revoke all on function private.token_attempts_left(text) from public;
revoke all on function private.ip_locked_until(text) from public;
revoke all on function private.portal_status_json(public.share_sessions, text) from public;
revoke all on function private.portal_record_json(public.share_sessions, text) from public;

-- ---------------------------------------------------------------------------
-- Portal functions (server only, gated by the server secret)
-- ---------------------------------------------------------------------------

create or replace function public.portal_submit_code(
  server_secret      text,
  portal_token       text,
  code               text,
  clinician_name     text,
  clinician_role     text,
  clinician_practice text,
  ip_hash            text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  h text;
  v_name text := nullif(btrim(coalesce(portal_submit_code.clinician_name, '')), '');
  v_role text := nullif(btrim(coalesce(portal_submit_code.clinician_role, '')), '');
  v_practice text := nullif(btrim(coalesce(portal_submit_code.clinician_practice, '')), '');
  v_code text := btrim(coalesce(portal_submit_code.code, ''));
  v_ip text := nullif(btrim(coalesce(portal_submit_code.ip_hash, '')), '');
  cur public.share_sessions;
  s public.share_sessions;
  sid uuid;
  lock_token timestamptz;
  lock_ip timestamptz;
  outcome text;
begin
  perform private.verify_server_secret(portal_submit_code.server_secret);
  h := private.portal_token_hash(portal_submit_code.portal_token);

  if v_name is null or char_length(v_name) > 100
     or char_length(coalesce(v_role, '')) > 60 or char_length(coalesce(v_practice, '')) > 120 then
    raise exception 'invalid_clinician' using errcode = '22023',
      detail = 'Name is required (up to 100 characters); role up to 60; practice up to 120.';
  end if;
  if v_ip is null or char_length(v_ip) > 200 then
    raise exception 'invalid_ip_hash' using errcode = '22023';
  end if;

  cur := private.portal_session(h);
  if cur.status in ('requested', 'active', 'paused') then
    raise exception 'portal_busy' using errcode = '55000',
      detail = 'This portal already has a session waiting or open. Cancel or end it first.';
  end if;

  lock_token := private.token_locked_until(h);
  lock_ip := private.ip_locked_until(v_ip);
  if lock_token is not null or lock_ip is not null then
    return jsonb_build_object(
      'result', 'locked',
      'request_expires_at', null,
      'attempts_left', 0,
      'locked_until', greatest(lock_token, lock_ip));
  end if;

  if v_code ~ '^[0-9]{4}$' then
    select x.id into sid from public.share_sessions x
     where x.code = v_code and x.status = 'code_issued'
     for update;
    if sid is not null then
      s := private.advance_session(sid);
    end if;
  end if;

  if s.status = 'code_issued' then
    update public.share_sessions
       set status = 'requested',
           clinician_name = v_name,
           clinician_role = v_role,
           clinician_practice = v_practice,
           portal_token_hash = h,
           requested_at = now(),
           request_expires_at = now() + interval '5 minutes'
     where id = s.id
    returning * into s;

    insert into private.portal_bindings (portal_token_hash, session_id, updated_at)
    values (h, s.id, now())
    on conflict (portal_token_hash) do update set session_id = excluded.session_id, updated_at = now();

    insert into private.portal_attempts (portal_token_hash, ip_hash, ok, result)
    values (h, v_ip, true, 'requested');

    perform private.log_event(s.id, s.patient_id, 'clinician', 'requested', jsonb_build_object(
      'clinician_name', v_name, 'clinician_role', v_role, 'clinician_practice', v_practice));

    return jsonb_build_object(
      'result', 'requested',
      'request_expires_at', s.request_expires_at,
      'attempts_left', null,
      'locked_until', null);
  end if;

  -- Not a live code. "expired" if it matches a share that expired in the last
  -- 30 minutes, otherwise "wrong". Both count as failed attempts.
  if v_code ~ '^[0-9]{4}$' and exists (
       select 1 from public.share_sessions x
        where x.code = v_code and x.status = 'expired'
          and coalesce(x.request_expires_at, x.code_expires_at) > now() - interval '30 minutes') then
    outcome := 'expired';
  else
    outcome := 'wrong';
  end if;

  insert into private.portal_attempts (portal_token_hash, ip_hash, ok, result)
  values (h, v_ip, false, outcome);

  return jsonb_build_object(
    'result', outcome,
    'request_expires_at', null,
    'attempts_left', private.token_attempts_left(h),
    'locked_until', greatest(private.token_locked_until(h), private.ip_locked_until(v_ip)));
end;
$$;

create or replace function public.portal_status(server_secret text, portal_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
begin
  perform private.verify_server_secret(portal_status.server_secret);
  h := private.portal_token_hash(portal_status.portal_token);
  return private.portal_status_json(private.portal_session(h), h);
end;
$$;

create or replace function public.portal_cancel_request(server_secret text, portal_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  s public.share_sessions;
begin
  perform private.verify_server_secret(portal_cancel_request.server_secret);
  h := private.portal_token_hash(portal_cancel_request.portal_token);
  s := private.portal_session(h);

  if s.status = 'requested' then
    update public.share_sessions
       set status = 'code_issued',
           clinician_name = null, clinician_role = null, clinician_practice = null,
           portal_token_hash = null, requested_at = null, request_expires_at = null
     where id = s.id;
    update private.portal_bindings set session_id = null, updated_at = now()
     where portal_token_hash = h;
    perform private.log_event(s.id, s.patient_id, 'clinician', 'request_cancelled', '{}'::jsonb);
    -- The code keeps its original expiry; expire it now if that has passed.
    perform private.advance_session(s.id);
  end if;

  return private.portal_status_json(private.portal_session(h), h);
end;
$$;

create or replace function public.portal_get_record(server_secret text, portal_token text, section text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  s public.share_sessions;
begin
  perform private.verify_server_secret(portal_get_record.server_secret);
  h := private.portal_token_hash(portal_get_record.portal_token);
  if portal_get_record.section is null
     or portal_get_record.section not in ('overview', 'conditions', 'timeline', 'medications', 'care_team') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;

  s := private.portal_session(h);
  if s.id is null or s.status <> 'active' or s.expires_at <= now() then
    return null;
  end if;

  -- Log the view, at most once per section per 30 seconds.
  if not exists (select 1 from public.access_events ev
                  where ev.session_id = s.id and ev.event = 'section_viewed'
                    and ev.detail ->> 'section' = portal_get_record.section
                    and ev.at > now() - interval '30 seconds') then
    perform private.log_event(s.id, s.patient_id, 'clinician', 'section_viewed',
                              jsonb_build_object('section', portal_get_record.section));
  end if;

  return private.portal_record_json(s, portal_get_record.section);
end;
$$;

create or replace function public.portal_save_notes(
  server_secret   text,
  portal_token    text,
  chief_complaint text,
  assessment      text,
  plan            text,
  follow_up       text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  h text;
  s public.share_sessions;
begin
  perform private.verify_server_secret(portal_save_notes.server_secret);
  h := private.portal_token_hash(portal_save_notes.portal_token);

  if char_length(coalesce(portal_save_notes.chief_complaint, '')) > 5000
     or char_length(coalesce(portal_save_notes.assessment, '')) > 5000
     or char_length(coalesce(portal_save_notes.plan, '')) > 5000
     or char_length(coalesce(portal_save_notes.follow_up, '')) > 5000 then
    raise exception 'notes_too_long' using errcode = '22001',
      detail = 'Each note field is limited to 5000 characters.';
  end if;

  s := private.portal_session(h);
  if s.id is null or s.status not in ('active', 'paused') then
    raise exception 'session_not_active' using errcode = '55000', detail = coalesce(s.status, 'none');
  end if;
  if not s.allow_notes then
    raise exception 'notes_not_allowed' using errcode = '42501';
  end if;

  update public.share_sessions
     set chief_complaint = portal_save_notes.chief_complaint,
         assessment = portal_save_notes.assessment,
         plan = portal_save_notes.plan,
         follow_up = portal_save_notes.follow_up,
         notes_updated_at = now()
   where id = s.id
  returning * into s;

  return jsonb_build_object('saved_at', s.notes_updated_at);
end;
$$;

create or replace function public.portal_end_session(server_secret text, portal_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  s public.share_sessions;
begin
  perform private.verify_server_secret(portal_end_session.server_secret);
  h := private.portal_token_hash(portal_end_session.portal_token);
  s := private.portal_session(h);
  if s.status in ('active', 'paused') then
    perform private.finish_session(s.id, 'clinician', now());
  end if;
  return private.portal_status_json(private.portal_session(h), h);
end;
$$;

-- Granted to anon (the server calls with the publishable key and no user
-- session) and authenticated (in the demo, the same browser may carry a
-- patient session cookie). The server secret is the real gate.
revoke all on function public.portal_submit_code(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.portal_status(text, text) from public, anon, authenticated;
revoke all on function public.portal_cancel_request(text, text) from public, anon, authenticated;
revoke all on function public.portal_get_record(text, text, text) from public, anon, authenticated;
revoke all on function public.portal_save_notes(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.portal_end_session(text, text) from public, anon, authenticated;

grant execute on function public.portal_submit_code(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.portal_status(text, text) to anon, authenticated;
grant execute on function public.portal_cancel_request(text, text) to anon, authenticated;
grant execute on function public.portal_get_record(text, text, text) to anon, authenticated;
grant execute on function public.portal_save_notes(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.portal_end_session(text, text) to anon, authenticated;
