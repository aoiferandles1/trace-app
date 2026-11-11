-- Trace redesign (2 of 4): the record builder and the patient functions.
--
-- private.record_v2_json() builds every section of the redesigned record. It
-- serves two readers with one set of rules:
--   * the owner, through my_record(section): everything, including personal
--     notes, every medication note and every mental health item;
--   * a doctor, through portal_get_record(..., version => 2) (migration 3):
--     only what the session's scopes grant. A section that is not granted
--     returns shared = false and data = null, and its tables are not read.
--
-- New patient functions: my_record, log_strength_change, undo_strength_change,
-- save_insurance, upload_document, my_document_file, the create_share_code
-- overload with the four new scopes, and export_my_data(version).
-- Nothing that exists is changed.

-- ---------------------------------------------------------------------------
-- Shapes
-- ---------------------------------------------------------------------------

-- How a relation sits in the family tree, and its default label.
create or replace function private.relation_info(p_relation text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select (case p_relation
    when 'mother'               then '{"label": "Mum", "generation": -1, "side": "maternal"}'
    when 'father'               then '{"label": "Dad", "generation": -1, "side": "paternal"}'
    when 'maternal_grandmother' then '{"label": "Mum''s mum", "generation": -2, "side": "maternal"}'
    when 'maternal_grandfather' then '{"label": "Mum''s dad", "generation": -2, "side": "maternal"}'
    when 'paternal_grandmother' then '{"label": "Dad''s mum", "generation": -2, "side": "paternal"}'
    when 'paternal_grandfather' then '{"label": "Dad''s dad", "generation": -2, "side": "paternal"}'
    when 'maternal_aunt'        then '{"label": "Mum''s sister", "generation": -1, "side": "maternal"}'
    when 'maternal_uncle'       then '{"label": "Mum''s brother", "generation": -1, "side": "maternal"}'
    when 'paternal_aunt'        then '{"label": "Dad''s sister", "generation": -1, "side": "paternal"}'
    when 'paternal_uncle'       then '{"label": "Dad''s brother", "generation": -1, "side": "paternal"}'
    when 'sister'               then '{"label": "Sister", "generation": 0, "side": null}'
    when 'brother'              then '{"label": "Brother", "generation": 0, "side": null}'
    when 'daughter'             then '{"label": "Daughter", "generation": 1, "side": null}'
    when 'son'                  then '{"label": "Son", "generation": 1, "side": null}'
    else                             '{"label": "Relative", "generation": null, "side": null}'
  end)::jsonb;
$$;

-- An entry (visit, result, prescription, letter...) with its detail.
create or replace function private.v2_entry_json(e public.entries)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'title', e.title, 'occurs_at', e.occurs_at,
    'upcoming', e.occurs_at > now(),
    'clinician', e.clinician, 'place', e.place, 'body', e.body,
    'is_mental_health', e.is_mental_health, 'source', e.source,
    'detail', case
      when e.kind = 'result' then jsonb_build_object(
        'kind', 'result',
        'results', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', r.id, 'name', r.name, 'value', r.value, 'unit', r.unit,
                   'ref_low', r.ref_low, 'ref_high', r.ref_high,
                   'flag', case when r.ref_low is not null and r.value < r.ref_low then 'low'
                                when r.ref_high is not null and r.value > r.ref_high then 'high' end)
                 order by r.position, r.created_at, r.id)
            from public.result_values r where r.entry_id = e.id), '[]'::jsonb))
      when e.kind = 'session_notes' then jsonb_build_object(
        'kind', 'text',
        'reason', e.detail ->> 'chief_complaint', 'assessment', e.detail ->> 'assessment',
        'plan', e.detail ->> 'plan', 'follow_up', e.detail ->> 'follow_up',
        'medication', null, 'quantity', null, 'pharmacy', null)
      when coalesce(e.reason, e.assessment, e.plan, e.rx_medication, e.rx_quantity, e.rx_pharmacy) is not null
        then jsonb_build_object(
        'kind', 'text',
        'reason', e.reason, 'assessment', e.assessment, 'plan', e.plan, 'follow_up', null,
        'medication', e.rx_medication, 'quantity', e.rx_quantity, 'pharmacy', e.rx_pharmacy)
    end);
$$;

-- A medication with its strength periods, newest first.
-- p_notes: 'owner' (every note, with note_shared), 'shared' (a note only when
-- its note_shared is on) or 'none' (no notes).
create or replace function private.v2_medication_json(m public.medications, p_notes text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with u as (
    select coalesce(m.unit, (private.parse_dose(m.dose)).unit) as unit,
           (m.ended_on is null or m.ended_on >= private.today_local()) as is_current,
           private.today_local() as today
  ), latest as (
    select p.strength from public.medication_periods p
     where p.medication_id = m.id order by p.start_date desc, p.created_at desc limit 1
  ), sched as (
    select coalesce(nullif(btrim(m.timing), ''),
                    case when m.frequency ilike '%as needed%' then 'as needed' end) as s
  )
  select jsonb_build_object(
    'id', m.id, 'name', m.name,
    'status', case when u.is_current then 'current' else 'past' end,
    'unit', u.unit,
    'strength', (select trim_scale(strength) from latest),
    'strength_label', coalesce((select trim_scale(strength)::text from latest) || coalesce(u.unit, ''), m.dose),
    'schedule', (select upper(left(s, 1)) || substr(s, 2) from sched),
    'form', m.form, 'frequency', m.frequency, 'timing', m.timing, 'drug_class', m.drug_class,
    'indication', m.indication, 'instructions', m.instructions,
    'prescriber', m.prescriber, 'prescriber_specialty', m.prescriber_specialty, 'prescriber_org', m.prescriber_org,
    'started_on', m.started_on, 'ended_on', m.ended_on, 'refill_due_on', m.refill_due_on,
    'supply_days_left', case when u.is_current and m.refill_due_on is not null then m.refill_due_on - u.today end,
    'period_count', (select count(*) from public.medication_periods p where p.medication_id = m.id),
    'periods', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', p.id, 'strength', trim_scale(p.strength),
                 'strength_label', trim_scale(p.strength)::text || coalesce(u.unit, ''),
                 'start_date', p.start_date, 'end_date', p.end_date, 'date_precision', p.date_precision,
                 'prescribed_by', p.prescribed_by,
                 'note', case when p_notes = 'owner' or (p_notes = 'shared' and p.note_shared) then p.note end)
               || case when p_notes = 'owner' then jsonb_build_object('note_shared', p.note_shared)
                       else '{}'::jsonb end
               order by p.start_date desc, p.created_at desc)
        from public.medication_periods p where p.medication_id = m.id), '[]'::jsonb))
  from u;
$$;

-- A full-timeline event with its prescriptions.
create or replace function private.v2_event_json(h public.health_events)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', h.id, 'kind', h.kind, 'title', h.title,
    'occurred_on', h.occurred_on, 'date_precision', h.date_precision,
    'clinician', h.clinician, 'place', h.place,
    'seen_by', nullif(concat_ws(', ', h.clinician, h.place), ''),
    'outcome', h.outcome, 'notes', h.notes, 'is_mental_health', h.is_mental_health,
    'prescriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'name', x.name, 'detail', x.detail,
               'medication_id', x.medication_id, 'medication_period_id', x.medication_period_id)
             order by x.position, x.created_at, x.id)
        from public.health_event_prescriptions x where x.event_id = h.id), '[]'::jsonb));
$$;

-- A relative with their conditions. p_mh: include mental health conditions.
create or replace function private.v2_relative_json(r public.relatives, p_mh boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'relation', r.relation,
    'label', coalesce(r.label, private.relation_info(r.relation) ->> 'label'),
    'generation', private.relation_info(r.relation) -> 'generation',
    'side', private.relation_info(r.relation) -> 'side',
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'age_at_diagnosis', c.age_at_diagnosis,
               'category', c.category, 'is_mental_health', c.is_mental_health,
               'label', c.name || coalesce(' at ' || c.age_at_diagnosis, ''))
             order by c.created_at, c.id)
        from public.relative_conditions c
       where c.relative_id = r.id and (p_mh or not c.is_mental_health)), '[]'::jsonb));
$$;

create or replace function private.v2_document_json(d public.documents)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'content_type', d.content_type, 'byte_size', d.byte_size,
    'document_date', d.document_date, 'created_at', d.created_at, 'is_mental_health', d.is_mental_health);
$$;

create or replace function private.v2_insurance_json(i public.insurance_connections)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'provider', i.provider,
    'member_number_masked', '•••• ' || i.member_number_last4,
    'plan_name', i.plan_name, 'renews_on', i.renews_on, 'via', i.via,
    'include_in_shares', i.include_in_shares, 'connected_at', i.connected_at);
$$;

create or replace function private.v2_condition_json(c public.conditions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'status', c.status, 'clinician', c.clinician,
    'specialty', c.specialty, 'diagnosed_year', c.diagnosed_year,
    'diagnosed_note', c.diagnosed_note, 'is_mental_health', c.is_mental_health);
$$;

-- What a session lets the doctor see. Used by portal_status and by every
-- portal_get_record version 2 response.
create or replace function private.v2_scope_json(s public.share_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'critical_safety', true,
    'medications', true,
    'conditions', s.share_conditions,
    'recent_visits', s.share_recent_visits,
    'full_timeline', s.share_full_timeline,
    'care_team', s.share_care_team,
    'mental_health', s.share_mental_health,
    'documents', s.share_documents,
    'insurance', s.share_insurance,
    'family_history', s.share_family_history,
    'medication_notes', s.share_medication_notes);
$$;

-- The file itself, base64 without line breaks.
create or replace function private.document_file_json(p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'content_type', d.content_type, 'byte_size', d.byte_size,
    'data_base64', translate(encode(f.bytes, 'base64'), E'\n', ''))
    from public.documents d
    join private.document_files f on f.document_id = d.id
   where d.id = p_document_id;
$$;

-- ---------------------------------------------------------------------------
-- The builder. s is the share session for a doctor, or null for the owner.
-- ---------------------------------------------------------------------------

create or replace function private.record_v2_json(p_uid uuid, p_section text, s public.share_sessions)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean := s.id is null;
  today date := private.today_local();
  p public.profiles;
  g_cond boolean := v_owner or s.share_conditions;
  g_recent boolean := v_owner or s.share_recent_visits;
  g_full boolean := v_owner or s.share_full_timeline;
  g_care boolean := v_owner or s.share_care_team;
  g_mh boolean := v_owner or s.share_mental_health;
  g_docs boolean := v_owner or s.share_documents;
  g_family boolean := v_owner or s.share_family_history;
  g_ins boolean := v_owner or s.share_insurance;
  notes_mode text := case when v_owner then 'owner' when s.share_medication_notes then 'shared' else 'none' end;
  is_shared boolean;
  j_data jsonb;
  j_cond jsonb;
  j_recent jsonb;
  j_cur jsonb;
  j_past jsonb;
  j_vitals jsonb;
  j_a jsonb;
  j_b jsonb;
  j_c jsonb;
  j_d jsonb;
begin
  is_shared := case p_section
    when 'overview' then true
    when 'medications' then true
    when 'conditions' then g_cond
    when 'recent_visits' then g_recent
    when 'full_timeline' then g_full
    when 'care_team' then g_care
    when 'family_history' then g_family
    when 'insurance' then g_ins
    when 'documents' then g_docs
    when 'mental_health' then g_mh
    else false end;

  select * into p from public.profiles where id = p_uid;

  if is_shared then
    -- Conditions (overview, conditions).
    if p_section in ('overview', 'conditions') and g_cond then
      select coalesce(jsonb_agg(private.v2_condition_json(c)
                      order by case c.status when 'resolved' then 1 else 0 end, c.created_at, c.id), '[]'::jsonb)
        into j_cond
        from public.conditions c
       where c.user_id = p_uid and (g_mh or not c.is_mental_health);
    end if;

    -- Recent visits (overview, recent_visits): the 3 most recent past entries
    -- and everything upcoming. Never a personal note for a doctor.
    if p_section in ('overview', 'recent_visits') and g_recent then
      select coalesce(jsonb_agg(private.v2_entry_json(x.e) order by (x.e).occurs_at desc, (x.e).id), '[]'::jsonb)
        into j_a
        from (select e from public.entries e
               where e.user_id = p_uid and (v_owner or e.kind <> 'note')
                 and (g_mh or not e.is_mental_health) and e.occurs_at <= now()
               order by e.occurs_at desc, e.id limit 3) x;
      select coalesce(jsonb_agg(private.v2_entry_json(e) order by e.occurs_at, e.id), '[]'::jsonb)
        into j_b
        from public.entries e
       where e.user_id = p_uid and (v_owner or e.kind <> 'note')
         and (g_mh or not e.is_mental_health) and e.occurs_at > now();
      j_recent := jsonb_build_object('past', j_a, 'upcoming', j_b);
    end if;

    -- Medications (overview: current only; medications: both). Always shared.
    if p_section in ('overview', 'medications') then
      select coalesce(jsonb_agg(private.v2_medication_json(m, notes_mode)
                        order by m.started_on desc nulls last, m.created_at, m.id)
                        filter (where m.ended_on is null or m.ended_on >= today), '[]'::jsonb),
             coalesce(jsonb_agg(private.v2_medication_json(m, notes_mode)
                        order by m.ended_on desc, m.created_at, m.id)
                        filter (where not (m.ended_on is null or m.ended_on >= today)), '[]'::jsonb)
        into j_cur, j_past
        from public.medications m
       where m.user_id = p_uid;
    end if;

    case p_section
    when 'overview' then
      if g_recent or g_full then
        select jsonb_build_object(
                 'recorded_on', v.recorded_on, 'systolic', v.systolic, 'diastolic', v.diastolic,
                 'heart_rate', v.heart_rate, 'weight_kg', v.weight_kg, 'spo2', v.spo2)
          into j_vitals
          from public.vitals v where v.user_id = p_uid
         order by v.recorded_on desc, v.created_at desc limit 1;
      end if;
      j_data := jsonb_build_object('conditions', j_cond, 'recent_visits', j_recent,
                                   'medications', j_cur, 'vitals', j_vitals);

    when 'conditions' then
      j_data := jsonb_build_object('conditions', j_cond);

    when 'recent_visits' then
      j_data := j_recent;

    when 'medications' then
      j_data := jsonb_build_object('current', j_cur, 'past', j_past);

    when 'full_timeline' then
      select coalesce(jsonb_agg(private.v2_event_json(h) order by h.occurred_on desc, h.created_at, h.id), '[]'::jsonb)
        into j_a
        from public.health_events h
       where h.user_id = p_uid and (g_mh or not h.is_mental_health);
      select coalesce(jsonb_agg(private.v2_entry_json(e) order by e.occurs_at desc, e.id), '[]'::jsonb)
        into j_b
        from public.entries e
       where e.user_id = p_uid and (v_owner or e.kind <> 'note')
         and (g_mh or not e.is_mental_health) and e.occurs_at <= now();
      j_data := jsonb_build_object('events', j_a, 'visits', j_b);

    when 'care_team' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ct.id, 'name', ct.name, 'role', ct.role,
               'organisation', ct.organisation, 'kind', ct.kind)
               order by case ct.kind when 'gp' then 0 when 'specialist' then 1 else 2 end,
                        ct.created_at, ct.id), '[]'::jsonb)
        into j_a
        from public.care_team ct where ct.user_id = p_uid;
      j_data := jsonb_build_object('care_team', j_a);

    when 'family_history' then
      select coalesce(jsonb_agg(private.v2_relative_json(r, g_mh)
               order by (private.relation_info(r.relation) ->> 'generation')::integer nulls last,
                        private.relation_info(r.relation) ->> 'side' nulls last, r.created_at, r.id), '[]'::jsonb)
        into j_a
        from public.relatives r where r.user_id = p_uid;
      j_data := jsonb_build_object('relatives', j_a);

    when 'insurance' then
      select coalesce(jsonb_agg(private.v2_insurance_json(i) order by i.connected_at), '[]'::jsonb)
        into j_a
        from public.insurance_connections i
       where i.user_id = p_uid and (v_owner or i.include_in_shares);
      j_data := jsonb_build_object('connections', j_a);

    when 'documents' then
      select coalesce(jsonb_agg(private.v2_document_json(d) order by d.created_at desc, d.id), '[]'::jsonb)
        into j_a
        from public.documents d
       where d.user_id = p_uid and (g_mh or not d.is_mental_health);
      j_data := jsonb_build_object('documents', j_a);

    when 'mental_health' then
      -- The flagged items, each only when its own section is shared too.
      if g_cond then
        select coalesce(jsonb_agg(private.v2_condition_json(c) order by c.created_at, c.id), '[]'::jsonb)
          into j_a from public.conditions c where c.user_id = p_uid and c.is_mental_health;
      else
        j_a := '[]'::jsonb;
      end if;
      select coalesce(jsonb_agg(private.v2_entry_json(e) order by e.occurs_at desc, e.id), '[]'::jsonb)
        into j_b
        from public.entries e
       where e.user_id = p_uid and e.is_mental_health
         and (v_owner or (e.kind <> 'note' and (
               (g_full and e.occurs_at <= now())
               or (g_recent and (e.occurs_at > now()
                    or e.id in (select r.id from public.entries r
                                 where r.user_id = p_uid and r.kind <> 'note' and r.occurs_at <= now()
                                 order by r.occurs_at desc, r.id limit 3))))));
      if g_full then
        select coalesce(jsonb_agg(private.v2_event_json(h) order by h.occurred_on desc, h.id), '[]'::jsonb)
          into j_c from public.health_events h where h.user_id = p_uid and h.is_mental_health;
      else
        j_c := '[]'::jsonb;
      end if;
      if g_docs then
        select coalesce(jsonb_agg(private.v2_document_json(d) order by d.created_at desc, d.id), '[]'::jsonb)
          into j_d from public.documents d where d.user_id = p_uid and d.is_mental_health;
      else
        j_d := '[]'::jsonb;
      end if;
      j_data := jsonb_build_object('conditions', j_a, 'visits', j_b, 'events', j_c, 'documents', j_d);
    else
      j_data := null;
    end case;
  end if;

  return jsonb_build_object(
    'version', 2,
    'section', p_section,
    'shared', is_shared,
    'patient', jsonb_build_object(
      'first_name', p.first_name,
      'last_name', p.last_name,
      'date_of_birth', p.date_of_birth,
      'age', case when p.date_of_birth is null then null
                  else extract(year from age(today, p.date_of_birth))::integer end,
      'sex', p.sex,
      'city', p.city),
    'critical', jsonb_build_object(
      'blood_type', p.blood_type,
      'allergies', to_jsonb(coalesce(p.allergies, '{}'::text[])),
      'implants', to_jsonb(coalesce(p.implants, '{}'::text[]))),
    'scope', case when v_owner then null else private.v2_scope_json(s) end,
    'data', j_data);
end;
$$;

create or replace function private.v2_sections()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['overview', 'conditions', 'recent_visits', 'medications', 'full_timeline', 'care_team',
               'family_history', 'insurance', 'documents', 'mental_health'];
$$;

revoke all on function private.relation_info(text) from public;
revoke all on function private.v2_entry_json(public.entries) from public;
revoke all on function private.v2_medication_json(public.medications, text) from public;
revoke all on function private.v2_event_json(public.health_events) from public;
revoke all on function private.v2_relative_json(public.relatives, boolean) from public;
revoke all on function private.v2_document_json(public.documents) from public;
revoke all on function private.v2_insurance_json(public.insurance_connections) from public;
revoke all on function private.v2_condition_json(public.conditions) from public;
revoke all on function private.v2_scope_json(public.share_sessions) from public;
revoke all on function private.document_file_json(uuid) from public;
revoke all on function private.record_v2_json(uuid, text, public.share_sessions) from public;
revoke all on function private.v2_sections() from public;

-- ---------------------------------------------------------------------------
-- my_record(section): the owner's own record, shaped like the portal's.
-- ---------------------------------------------------------------------------

create or replace function public.my_record(section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  if my_record.section is null or not (my_record.section = any (private.v2_sections())) then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  return private.record_v2_json(uid, my_record.section, null::public.share_sessions);
end;
$$;

-- ---------------------------------------------------------------------------
-- Strength changes. A change adds a period and closes the previous one on
-- the same date; nothing is overwritten. Atomic: the medication row is locked.
-- ---------------------------------------------------------------------------

create or replace function public.log_strength_change(
  medication_id uuid,
  strength      numeric,
  changed_on    date,
  prescribed_by text    default null,
  note          text    default null,
  note_shared   boolean default false,
  unit          text    default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  today date := private.today_local();
  m public.medications;
  latest public.medication_periods;
  v_strength numeric := log_strength_change.strength;
  v_on date := log_strength_change.changed_on;
  v_unit text;
  v_by text := nullif(btrim(coalesce(log_strength_change.prescribed_by, '')), '');
  v_note text := nullif(btrim(coalesce(log_strength_change.note, '')), '');
begin
  select * into m from public.medications x
   where x.id = log_strength_change.medication_id and x.user_id = uid
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_strength is null or v_strength <= 0 or v_strength >= 100000 then
    raise exception 'invalid_strength' using errcode = '22023';
  end if;

  v_unit := coalesce(m.unit, (private.parse_dose(m.dose)).unit);
  if log_strength_change.unit is not null then
    if log_strength_change.unit not in ('mg', 'mcg', 'g', 'mL', 'units', 'IU')
       or (v_unit is not null and v_unit <> log_strength_change.unit) then
      raise exception 'invalid_unit' using errcode = '22023',
        detail = 'The unit must match the medication''s unit.';
    end if;
    v_unit := log_strength_change.unit;
  end if;
  if v_unit is null then
    raise exception 'unit_required' using errcode = '22023';
  end if;

  if m.ended_on is not null and m.ended_on < today then
    raise exception 'medication_not_current' using errcode = '55000';
  end if;

  if v_on is null or v_on > today then
    raise exception 'invalid_date' using errcode = '22023', detail = 'The date must be today or earlier.';
  end if;

  select * into latest from public.medication_periods p
   where p.medication_id = m.id order by p.start_date desc, p.created_at desc limit 1;
  if latest.id is not null then
    if v_on <= latest.start_date then
      raise exception 'invalid_date' using errcode = '22023',
        detail = 'The change must come after ' || latest.start_date || ', when the current strength started.';
    end if;
    if latest.strength = v_strength then
      raise exception 'same_strength' using errcode = '22023';
    end if;
  end if;

  if char_length(coalesce(v_by, '')) > 200 or char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'invalid_input' using errcode = '22023',
      detail = 'Prescriber up to 200 characters, note up to 2000.';
  end if;

  perform set_config('trace.periods_managed', 'on', true);

  if latest.id is not null then
    update public.medication_periods
       set end_date = v_on
     where id = latest.id and (end_date is null or end_date > v_on);
  end if;

  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values (m.id, uid, v_strength, v_on, m.ended_on, 'day', v_by, v_note,
          coalesce(log_strength_change.note_shared, false));

  update public.medications
     set dose = trim_scale(v_strength)::text || v_unit,
         unit = v_unit,
         prescriber = coalesce(v_by, prescriber),
         started_on = coalesce(started_on, v_on)
   where id = m.id
  returning * into m;

  perform set_config('trace.periods_managed', '', true);

  return private.v2_medication_json(m, 'owner');
end;
$$;

-- Remove the newest strength change (a mistake) and reopen the one before.
create or replace function public.undo_strength_change(medication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  m public.medications;
  latest public.medication_periods;
  prev public.medication_periods;
  v_unit text;
begin
  select * into m from public.medications x
   where x.id = undo_strength_change.medication_id and x.user_id = uid
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into latest from public.medication_periods p
   where p.medication_id = m.id order by p.start_date desc, p.created_at desc limit 1;
  select * into prev from public.medication_periods p
   where p.medication_id = m.id order by p.start_date desc, p.created_at desc offset 1 limit 1;
  if prev.id is null then
    raise exception 'nothing_to_undo' using errcode = '55000';
  end if;

  v_unit := coalesce(m.unit, (private.parse_dose(m.dose)).unit);

  perform set_config('trace.periods_managed', 'on', true);
  delete from public.medication_periods where id = latest.id;
  update public.medication_periods set end_date = m.ended_on where id = prev.id;
  update public.medications
     set dose = trim_scale(prev.strength)::text || coalesce(v_unit, '')
   where id = m.id
  returning * into m;
  perform set_config('trace.periods_managed', '', true);

  return private.v2_medication_json(m, 'owner');
end;
$$;

-- ---------------------------------------------------------------------------
-- Insurance. One connection per account. Takes the member number and keeps
-- only its last four letters or digits. There is no password argument.
-- ---------------------------------------------------------------------------

create or replace function public.save_insurance(
  provider      text,
  member_number text,
  plan_name     text default null,
  renews_on     date default null,
  via           text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  v_provider text := nullif(btrim(coalesce(save_insurance.provider, '')), '');
  v_plan text := nullif(btrim(coalesce(save_insurance.plan_name, '')), '');
  v_digits text := regexp_replace(coalesce(save_insurance.member_number, ''), '[^0-9A-Za-z]', '', 'g');
  i public.insurance_connections;
begin
  if v_provider is null or char_length(v_provider) > 100 then
    raise exception 'invalid_provider' using errcode = '22023';
  end if;
  if char_length(v_digits) < 4 or char_length(coalesce(save_insurance.member_number, '')) > 40 then
    raise exception 'invalid_member_number' using errcode = '22023',
      detail = 'At least 4 letters or digits, up to 40 characters.';
  end if;
  if char_length(coalesce(v_plan, '')) > 100 then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;
  if save_insurance.via is null or save_insurance.via not in ('provider', 'manual') then
    raise exception 'invalid_via' using errcode = '22023';
  end if;

  insert into public.insurance_connections (user_id, provider, member_number_last4, plan_name, renews_on, via)
  values (uid, v_provider, right(v_digits, 4), v_plan, save_insurance.renews_on, save_insurance.via)
  on conflict (user_id) do update
    set provider = excluded.provider,
        member_number_last4 = excluded.member_number_last4,
        plan_name = excluded.plan_name,
        renews_on = excluded.renews_on,
        via = excluded.via,
        connected_at = now()
  returning * into i;

  return private.v2_insurance_json(i);
end;
$$;

-- ---------------------------------------------------------------------------
-- Documents. PDF, JPEG or PNG, checked by the leading bytes; up to 3 MB each.
-- Per account: 20 MB and 100 files (real), 3 MB and 5 files (demo). All demo
-- accounts together: 100 MB.
-- ---------------------------------------------------------------------------

create or replace function public.upload_document(
  title            text,
  content_type     text,
  data_base64      text,
  document_date    date    default null,
  is_mental_health boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := private.require_uid();
  v_title text := nullif(btrim(coalesce(upload_document.title, '')), '');
  v_bytes bytea;
  v_size integer;
  v_detected text;
  v_demo boolean;
  n_files integer;
  n_bytes bigint;
  max_files integer;
  max_bytes bigint;
  d public.documents;
begin
  if v_title is null or char_length(v_title) > 200 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  if upload_document.content_type is null
     or upload_document.content_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'invalid_type' using errcode = '22023', detail = 'PDF, JPEG or PNG only.';
  end if;
  if upload_document.data_base64 is null or char_length(upload_document.data_base64) = 0 then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  if char_length(upload_document.data_base64) > 4400000 then
    raise exception 'file_too_large' using errcode = '22023', detail = 'Up to 3 MB.';
  end if;

  begin
    v_bytes := decode(regexp_replace(upload_document.data_base64, '\s', '', 'g'), 'base64');
  exception when others then
    v_bytes := null;
  end;
  if v_bytes is null or octet_length(v_bytes) = 0 then
    raise exception 'invalid_file' using errcode = '22023', detail = 'The data is not valid base64.';
  end if;
  v_size := octet_length(v_bytes);
  if v_size > 3145728 then
    raise exception 'file_too_large' using errcode = '22023', detail = 'Up to 3 MB.';
  end if;

  v_detected := case
    when substring(v_bytes from 1 for 5) = '\x255044462d'::bytea then 'application/pdf'
    when substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea then 'image/jpeg'
    when substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea then 'image/png'
  end;
  if v_detected is null then
    raise exception 'invalid_type' using errcode = '22023', detail = 'The file is not a PDF, JPEG or PNG.';
  end if;
  if v_detected <> upload_document.content_type then
    raise exception 'type_mismatch' using errcode = '22023',
      detail = 'The file is a ' || v_detected || ', not a ' || upload_document.content_type || '.';
  end if;

  -- One upload at a time per account, so the caps hold.
  select pr.is_demo into v_demo from public.profiles pr where pr.id = uid for update;
  v_demo := coalesce(v_demo, true);
  max_files := case when v_demo then 5 else 100 end;
  max_bytes := case when v_demo then 3145728 else 20971520 end;

  select count(*), coalesce(sum(x.byte_size), 0) into n_files, n_bytes
    from public.documents x where x.user_id = uid;
  if n_files + 1 > max_files or n_bytes + v_size > max_bytes then
    raise exception 'quota_exceeded' using errcode = '53400',
      detail = format('Up to %s files and %s MB per account.', max_files, max_bytes / 1048576);
  end if;

  if v_demo and (select coalesce(sum(x.byte_size), 0)
                   from public.documents x join public.profiles pr on pr.id = x.user_id
                  where pr.is_demo) + v_size > 104857600 then
    raise exception 'storage_full' using errcode = '53400',
      detail = 'The demo has no room for more files today.';
  end if;

  insert into public.documents (user_id, title, content_type, byte_size, document_date, is_mental_health)
  values (uid, v_title, upload_document.content_type, v_size, upload_document.document_date,
          coalesce(upload_document.is_mental_health, false))
  returning * into d;

  insert into private.document_files (document_id, user_id, content_type, byte_size, bytes)
  values (d.id, uid, d.content_type, d.byte_size, v_bytes);

  return private.v2_document_json(d);
end;
$$;

create or replace function public.my_document_file(document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  if not exists (select 1 from public.documents d
                  where d.id = my_document_file.document_id and d.user_id = uid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.document_file_json(my_document_file.document_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_share_code with the four new scopes. An overload: the four new
-- switches come first and have no default, so a call that names none of
-- them (the old app) can only reach the original function, and a call that
-- names them can only reach this one. Same rules and errors as the original.
-- ---------------------------------------------------------------------------

create or replace function public.create_share_code(
  share_documents        boolean,
  share_family_history   boolean,
  share_insurance        boolean,
  share_medication_notes boolean,
  share_conditions       boolean default true,
  share_recent_visits    boolean default true,
  share_full_timeline    boolean default false,
  share_care_team        boolean default true,
  share_mental_health    boolean default false,
  allow_notes            boolean default true,
  duration_kind          text    default '30m',
  appointment_entry_id   uuid    default null)
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
     or create_share_code.share_mental_health is null or create_share_code.allow_notes is null
     or create_share_code.share_documents is null or create_share_code.share_family_history is null
     or create_share_code.share_insurance is null or create_share_code.share_medication_notes is null then
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
        share_mental_health, allow_notes, duration_kind, appointment_entry_id,
        share_documents, share_family_history, share_insurance, share_medication_notes)
      values (
        uid, 'code_issued', new_code, now() + interval '5 minutes',
        create_share_code.share_conditions, create_share_code.share_recent_visits,
        create_share_code.share_full_timeline, create_share_code.share_care_team,
        create_share_code.share_mental_health, create_share_code.allow_notes,
        create_share_code.duration_kind, create_share_code.appointment_entry_id,
        create_share_code.share_documents, create_share_code.share_family_history,
        create_share_code.share_insurance, create_share_code.share_medication_notes)
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
    'share_documents', s.share_documents,
    'share_family_history', s.share_family_history,
    'share_insurance', s.share_insurance,
    'share_medication_notes', s.share_medication_notes,
    'allow_notes', s.allow_notes,
    'duration_kind', s.duration_kind,
    'appointment_entry_id', s.appointment_entry_id));

  return private.patient_session_json(s);
end;
$$;

-- ---------------------------------------------------------------------------
-- export_my_data(version => 2): every row the caller owns, the new tables
-- included, documents with their bytes. The original export_my_data() is
-- unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data(version integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  if export_my_data.version is distinct from 2 then
    raise exception 'invalid_version' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'version', 2,
    'exported_at', now(),
    'user_id', uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at, c.id)
                              from public.conditions c where c.user_id = uid), '[]'::jsonb),
    'medications', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
                               from public.medications m where m.user_id = uid), '[]'::jsonb),
    'medication_periods', coalesce((select jsonb_agg(to_jsonb(x) order by x.medication_id, x.start_date, x.id)
                               from public.medication_periods x where x.user_id = uid), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.occurs_at, e.id)
                           from public.entries e where e.user_id = uid), '[]'::jsonb),
    'result_values', coalesce((select jsonb_agg(to_jsonb(r) order by r.entry_id, r.position, r.id)
                           from public.result_values r where r.user_id = uid), '[]'::jsonb),
    'health_events', coalesce((select jsonb_agg(to_jsonb(h) order by h.occurred_on, h.id)
                           from public.health_events h where h.user_id = uid), '[]'::jsonb),
    'health_event_prescriptions', coalesce((select jsonb_agg(to_jsonb(x) order by x.event_id, x.position, x.id)
                           from public.health_event_prescriptions x where x.user_id = uid), '[]'::jsonb),
    'care_team', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at, t.id)
                             from public.care_team t where t.user_id = uid), '[]'::jsonb),
    'vitals', coalesce((select jsonb_agg(to_jsonb(v) order by v.recorded_on, v.id)
                          from public.vitals v where v.user_id = uid), '[]'::jsonb),
    'relatives', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at, r.id)
                          from public.relatives r where r.user_id = uid), '[]'::jsonb),
    'relative_conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.relative_id, c.created_at, c.id)
                          from public.relative_conditions c where c.user_id = uid), '[]'::jsonb),
    'insurance_connections', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
                          from public.insurance_connections i where i.user_id = uid), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
                                     'data_base64', translate(encode(f.bytes, 'base64'), E'\n', ''))
                                   order by d.created_at, d.id)
                             from public.documents d
                             join private.document_files f on f.document_id = d.id
                            where d.user_id = uid), '[]'::jsonb),
    'share_sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'portal_token_hash' order by s.created_at, s.id)
                                  from public.share_sessions s where s.patient_id = uid), '[]'::jsonb),
    'access_events', coalesce((select jsonb_agg(to_jsonb(a) order by a.at, a.id)
                                 from public.access_events a where a.patient_id = uid), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only (anonymous demo users included).
-- ---------------------------------------------------------------------------

revoke all on function public.my_record(text) from public, anon, authenticated;
revoke all on function public.log_strength_change(uuid, numeric, date, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.undo_strength_change(uuid) from public, anon, authenticated;
revoke all on function public.save_insurance(text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.upload_document(text, text, text, date, boolean) from public, anon, authenticated;
revoke all on function public.my_document_file(uuid) from public, anon, authenticated;
revoke all on function public.create_share_code(boolean, boolean, boolean, boolean, boolean, boolean, boolean,
                                                boolean, boolean, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.export_my_data(integer) from public, anon, authenticated;

grant execute on function public.my_record(text) to authenticated;
grant execute on function public.log_strength_change(uuid, numeric, date, text, text, boolean, text) to authenticated;
grant execute on function public.undo_strength_change(uuid) to authenticated;
grant execute on function public.save_insurance(text, text, text, date, text) to authenticated;
grant execute on function public.upload_document(text, text, text, date, boolean) to authenticated;
grant execute on function public.my_document_file(uuid) to authenticated;
grant execute on function public.create_share_code(boolean, boolean, boolean, boolean, boolean, boolean, boolean,
                                                   boolean, boolean, boolean, text, uuid) to authenticated;
grant execute on function public.export_my_data(integer) to authenticated;
