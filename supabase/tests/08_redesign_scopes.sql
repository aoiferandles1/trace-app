-- Test: the redesign's share scopes, enforced in portal_get_record version 2.
-- * Defaults: Full timeline, Documents, Family history, Insurance, Mental
--   health and Medication notes off; the ungranted sections come back with
--   shared = false and data = null, and no view is logged for them.
-- * Each new scope, switched on alone, changes exactly its own section.
-- * A medication note reaches the doctor only when the Medication notes scope
--   was granted and that note's note_shared is on.
-- * A mental-health-flagged item in each table (conditions, entries,
--   health_events, documents, relative_conditions) stays hidden without the
--   Mental health scope, while every medication still comes through.
-- * Unknown sections and versions are refused; nothing is returned unless
--   the session is active; portal_status reports every scope.
-- * The create_share_code overload: the old call shape still reaches the
--   original; the new one must name all four new scopes.
--
-- Runs inside a transaction that rolls back.

begin;

create temp table _results (n serial, test text, pass boolean, info text);
create temp table _ctx (k text primary key, v text);
create function pg_temp.ok(t text, pass boolean, info text default null) returns void
  language sql as $$ insert into _results (test, pass, info) values (t, coalesce(pass, false), info) $$;
create function pg_temp.put(k text, v text) returns void
  language sql as $$ insert into _ctx values (k, v) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.get(k text) returns text language sql as $$ select v from _ctx where _ctx.k = get.k $$;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Run one share with the given scopes, read every v2 section, end it.
-- Returns { "<section>": response, ..., "_status": portal_status, "_session": id }.
create function pg_temp.share_all(prefs jsonb) returns jsonb language plpgsql as $$
declare
  uid uuid := '00000000-0000-4000-8000-000000000801';
  tok text := 'v2-scope-token-' || md5(random()::text);
  appt uuid := pg_temp.get('appt')::uuid;
  j jsonb; out jsonb := '{}'::jsonb; sec text; st jsonb;
begin
  perform pg_temp.login(uid);
  j := public.create_share_code(
    share_documents => coalesce((prefs ->> 'documents')::boolean, false),
    share_family_history => coalesce((prefs ->> 'family_history')::boolean, false),
    share_insurance => coalesce((prefs ->> 'insurance')::boolean, false),
    share_medication_notes => coalesce((prefs ->> 'medication_notes')::boolean, false),
    share_conditions => coalesce((prefs ->> 'conditions')::boolean, true),
    share_recent_visits => coalesce((prefs ->> 'recent_visits')::boolean, true),
    share_full_timeline => coalesce((prefs ->> 'full_timeline')::boolean, false),
    share_care_team => coalesce((prefs ->> 'care_team')::boolean, true),
    share_mental_health => coalesce((prefs ->> 'mental_health')::boolean, false),
    appointment_entry_id => appt);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', tok, j ->> 'code', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
                                    'v2-ip-' || md5(random()::text));
  perform pg_temp.logout();
  perform pg_temp.login(uid);
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', tok);
  foreach sec in array array['overview', 'conditions', 'recent_visits', 'medications', 'full_timeline', 'care_team',
                             'family_history', 'insurance', 'documents', 'mental_health'] loop
    out := out || jsonb_build_object(sec, public.portal_get_record('test-secret', tok, sec, 2));
  end loop;
  perform pg_temp.logout();
  perform pg_temp.login(uid);
  perform public.end_session();
  perform pg_temp.logout();
  return out || jsonb_build_object('_status', st, '_session', j ->> 'id', '_code_detail',
    (select detail from public.access_events where session_id = (j ->> 'id')::uuid and event = 'code_generated'));
end $$;

-- Sections whose response (without the scope object) differs between two runs.
create function pg_temp.changed(a jsonb, b jsonb) returns text language sql as $$
  select coalesce(string_agg(s, ',' order by s), '')
    from unnest(array['overview', 'conditions', 'recent_visits', 'medications', 'full_timeline', 'care_team',
                      'family_history', 'insurance', 'documents', 'mental_health']) s
   where (a -> s) - 'scope' is distinct from (b -> s) - 'scope'
$$;
-- Sections a run reports as shared.
create function pg_temp.shared(a jsonb) returns text language sql as $$
  select coalesce(string_agg(s, ',' order by s), '')
    from unnest(array['overview', 'conditions', 'recent_visits', 'medications', 'full_timeline', 'care_team',
                      'family_history', 'insurance', 'documents', 'mental_health']) s
   where (a -> s ->> 'shared')::boolean
$$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into auth.users (id, is_anonymous, aud, role)
values ('00000000-0000-4000-8000-000000000801', true, 'authenticated', 'authenticated');

-- Jane's redesign record, plus one mental-health-flagged item in each table,
-- one ordinary document and a connected insurance plan included in shares.
do $$
declare j jsonb; rel uuid; d jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  j := public.seed_demo_record_v2();
  insert into public.conditions (name, status, is_mental_health) values ('Anxiety', 'ongoing', true);
  insert into public.entries (kind, title, occurs_at, is_mental_health) values
    ('visit', 'Counselling session', now() - interval '5 days', true);
  insert into public.health_events (kind, title, occurred_on, outcome, is_mental_health)
    values ('condition', 'Panic attacks', date '2021-05-01', 'managed', true);
  select id into rel from public.relatives where relation = 'mother';
  insert into public.relative_conditions (relative_id, name, is_mental_health) values (rel, 'Depression', true);
  insert into public.medications (name, dose, started_on) values ('Sertraline', '50mg', current_date - 60);
  d := public.upload_document('Therapy letter', 'image/png',
         encode('\x89504e470d0a1a0a'::bytea || '\x0000000d49484452'::bytea, 'base64'), null, true);
  d := public.upload_document('Discharge letter', 'application/pdf',
         encode(convert_to('%PDF-1.4 discharge', 'UTF8'), 'base64'));
  perform public.save_insurance('VHI', '1234 5678 4821', 'Comprehensive plan', date '2027-03-01', 'provider');
  update public.insurance_connections set include_in_shares = true;
  perform pg_temp.logout();
  perform pg_temp.put('appt', j ->> 'appointment_entry_id');
end $$;

-- 1. Defaults.
do $$
declare base jsonb := pg_temp.share_all('{}'::jsonb); n_logged int;
begin
  perform pg_temp.put('base', base::text);
  perform pg_temp.ok('Defaults: overview, conditions, recent visits, medications and care team are shared; the rest not',
    pg_temp.shared(base) = 'care_team,conditions,medications,overview,recent_visits', pg_temp.shared(base));
  perform pg_temp.ok('An ungranted section returns shared false and data null (but the header, for the page)',
    (select bool_and(base -> s ->> 'shared' = 'false' and base -> s -> 'data' = 'null'::jsonb
                     and base -> s -> 'patient' ->> 'first_name' = 'Jane')
       from unnest(array['full_timeline', 'family_history', 'insurance', 'documents', 'mental_health']) s),
    (base -> 'documents')::text);
  perform pg_temp.ok('Nothing from an ungranted section leaks into any response',
    base::text not like '%Glandular fever%' and base::text not like '%Discharge letter%'
    and base::text not like '%Heart attack%' and base::text not like '%4821%' and base::text not like '%Barely noticed%',
    'ok');
  select count(*) into n_logged from public.access_events
   where session_id = (base ->> '_session')::uuid and event = 'section_viewed';
  perform pg_temp.ok('Only shared sections are logged as viewed',
    n_logged = 5 and not exists (select 1 from public.access_events
                                  where session_id = (base ->> '_session')::uuid and event = 'section_viewed'
                                    and detail ->> 'section' in ('full_timeline', 'family_history', 'insurance',
                                                                 'documents', 'mental_health')),
    n_logged::text);
  perform pg_temp.ok('portal_status reports every scope, the four new ones false',
    (select array_agg(k order by k) from jsonb_object_keys(base -> '_status' -> 'scope') k)
      = array['care_team', 'conditions', 'critical_safety', 'documents', 'family_history', 'full_timeline',
              'insurance', 'medication_notes', 'medications', 'mental_health', 'recent_visits']
    and base -> '_status' -> 'scope' ->> 'documents' = 'false'
    and base -> '_status' -> 'scope' ->> 'medication_notes' = 'false',
    (base -> '_status' -> 'scope')::text);
  perform pg_temp.ok('The access log records the new scopes chosen',
    base -> '_code_detail' ->> 'share_documents' = 'false' and base -> '_code_detail' ? 'share_medication_notes',
    (base -> '_code_detail')::text);
end $$;

-- 2. Each new scope on its own changes exactly its own section.
do $$
declare base jsonb := pg_temp.get('base')::jsonb; r jsonb;
begin
  r := pg_temp.share_all('{"full_timeline": true}');
  perform pg_temp.ok('Full timeline on: only the full_timeline section changes; nine events, newest first, with prescriptions',
    pg_temp.changed(base, r) = 'full_timeline' and jsonb_array_length(r -> 'full_timeline' -> 'data' -> 'events') = 9
    and r -> 'full_timeline' -> 'data' -> 'events' -> 0 ->> 'title' = 'Chest infection'
    and r -> 'full_timeline' -> 'data' -> 'events' -> 8 ->> 'title' = 'Glandular fever',
    pg_temp.changed(base, r));

  r := pg_temp.share_all('{"documents": true}');
  perform pg_temp.ok('Documents on: only the documents section changes; the flagged document stays out',
    pg_temp.changed(base, r) = 'documents'
    and jsonb_array_length(r -> 'documents' -> 'data' -> 'documents') = 1
    and r -> 'documents' -> 'data' -> 'documents' -> 0 ->> 'title' = 'Discharge letter',
    pg_temp.changed(base, r));

  r := pg_temp.share_all('{"family_history": true}');
  perform pg_temp.ok('Family history on: only the family_history section changes; seven relatives',
    pg_temp.changed(base, r) = 'family_history'
    and jsonb_array_length(r -> 'family_history' -> 'data' -> 'relatives') = 7,
    pg_temp.changed(base, r));

  r := pg_temp.share_all('{"insurance": true}');
  perform pg_temp.ok('Insurance on: only the insurance section changes; the member number is masked',
    pg_temp.changed(base, r) = 'insurance'
    and r -> 'insurance' -> 'data' -> 'connections' -> 0 ->> 'member_number_masked' = '•••• 4821'
    and (r -> 'insurance')::text not like '%5678%',
    pg_temp.changed(base, r));

  r := pg_temp.share_all('{"medication_notes": true}');
  perform pg_temp.ok('Medication notes on: only the medications (and the overview''s medication list) change',
    pg_temp.changed(base, r) = 'medications,overview'
    and (r -> 'overview' -> 'data') - 'medications' = (base -> 'overview' -> 'data') - 'medications',
    pg_temp.changed(base, r));

  r := pg_temp.share_all('{"conditions": false}');
  perform pg_temp.ok('Conditions off: the conditions section is not shared and the overview has no conditions',
    pg_temp.changed(base, r) = 'conditions,overview' and r -> 'conditions' ->> 'shared' = 'false'
    and r -> 'overview' -> 'data' -> 'conditions' = 'null'::jsonb, pg_temp.changed(base, r));

  r := pg_temp.share_all('{"recent_visits": false}');
  perform pg_temp.ok('Recent visits off: that section is not shared; the overview has no visits and no vitals',
    pg_temp.changed(base, r) = 'overview,recent_visits' and r -> 'recent_visits' ->> 'shared' = 'false'
    and r -> 'overview' -> 'data' -> 'recent_visits' = 'null'::jsonb
    and r -> 'overview' -> 'data' -> 'vitals' = 'null'::jsonb, pg_temp.changed(base, r));

  r := pg_temp.share_all('{"care_team": false}');
  perform pg_temp.ok('Care team off: only the care team section changes', pg_temp.changed(base, r) = 'care_team',
    pg_temp.changed(base, r));
end $$;

-- 3. Medication notes need both the scope and the note's own note_shared.
do $$
declare r jsonb; notes text;
begin
  update public.medication_periods set note_shared = false
   where note = 'Too much. Racing heart and trouble sleeping.';
  r := pg_temp.share_all('{}');
  perform pg_temp.ok('Scope off: no note at all, even ones marked shared',
    not exists (select 1 from jsonb_array_elements(r -> 'medications' -> 'data' -> 'current') m,
                               jsonb_array_elements(m -> 'periods') p where p ->> 'note' is not null)
    and r::text not like '%Back on 36%', 'ok');
  r := pg_temp.share_all('{"medication_notes": true}');
  select string_agg(p ->> 'note', '|') into notes
    from jsonb_array_elements(r -> 'medications' -> 'data' -> 'current') m, jsonb_array_elements(m -> 'periods') p
   where m ->> 'name' = 'Concerta' and p ->> 'note' is not null;
  perform pg_temp.ok('Scope on: shared notes come through, the one with note_shared off does not',
    notes like '%Back on 36%' and notes like '%Barely noticed%' and notes not like '%Racing heart%'
    and r::text not like '%Racing heart%', notes);
  perform pg_temp.ok('The doctor never sees the note_shared flag itself',
    r -> 'medications' -> 'data' -> 'current' -> 0 -> 'periods' -> 0 ? 'note' and
    not (r -> 'medications' -> 'data' -> 'current' -> 0 -> 'periods' -> 0 ? 'note_shared'), 'ok');
end $$;

-- 4. Mental health: a flagged item in each table is hidden without the scope.
do $$
declare off_r jsonb; on_r jsonb; nodocs jsonb;
begin
  off_r := pg_temp.share_all('{"full_timeline": true, "documents": true, "family_history": true}');
  perform pg_temp.ok('Mental health off: no flagged condition, visit, event, document or relative condition anywhere',
    off_r::text not like '%Anxiety%' and off_r::text not like '%Counselling%' and off_r::text not like '%Panic attacks%'
    and off_r::text not like '%Therapy letter%' and off_r::text not like '%Depression%'
    and off_r -> 'mental_health' ->> 'shared' = 'false', 'ok');
  perform pg_temp.ok('Mental health off: every medication still comes through (5 current, 4 past)',
    jsonb_array_length(off_r -> 'medications' -> 'data' -> 'current') = 5
    and jsonb_array_length(off_r -> 'medications' -> 'data' -> 'past') = 4
    and (off_r -> 'medications')::text like '%Sertraline%', 'ok');

  on_r := pg_temp.share_all('{"full_timeline": true, "documents": true, "family_history": true, "mental_health": true}');
  perform pg_temp.ok('Mental health on: each flagged item appears in its own section',
    (on_r -> 'conditions')::text like '%Anxiety%' and (on_r -> 'recent_visits')::text like '%Counselling session%'
    and (on_r -> 'full_timeline')::text like '%Panic attacks%' and (on_r -> 'documents')::text like '%Therapy letter%'
    and (on_r -> 'family_history')::text like '%Depression%', 'ok');
  perform pg_temp.ok('Mental health on: the mental health section collects the flagged items',
    on_r -> 'mental_health' -> 'data' -> 'conditions' -> 0 ->> 'name' = 'Anxiety'
    and on_r -> 'mental_health' -> 'data' -> 'visits' -> 0 ->> 'title' = 'Counselling session'
    and on_r -> 'mental_health' -> 'data' -> 'events' -> 0 ->> 'title' = 'Panic attacks'
    and on_r -> 'mental_health' -> 'data' -> 'documents' -> 0 ->> 'title' = 'Therapy letter',
    (on_r -> 'mental_health' -> 'data')::text);

  nodocs := pg_temp.share_all('{"mental_health": true}');
  perform pg_temp.ok('A flagged item needs its own section too: no documents or events without those scopes',
    nodocs -> 'mental_health' -> 'data' -> 'documents' = '[]'::jsonb
    and nodocs -> 'mental_health' -> 'data' -> 'events' = '[]'::jsonb
    and nodocs::text not like '%Therapy letter%' and nodocs::text not like '%Panic attacks%',
    (nodocs -> 'mental_health' -> 'data')::text);
end $$;

-- 5. The portal_get_record gate.
do $$
declare e1 text; e2 text; e3 text; e4 text; r jsonb; tok text := 'v2-closed-token-0123456789abcdefghijklm'; j jsonb;
begin
  perform pg_temp.login_anon();
  begin perform public.portal_get_record('test-secret', tok, 'notes', 2); e1 := 'no error';
  exception when others then e1 := sqlerrm; end;
  begin perform public.portal_get_record('test-secret', tok, 'documents', 1); e2 := 'no error';
  exception when others then e2 := sqlerrm; end;
  begin perform public.portal_get_record('test-secret', tok, 'documents'); e3 := 'no error';
  exception when others then e3 := sqlerrm; end;
  begin perform public.portal_get_record('wrong', tok, 'overview', 2); e4 := 'no error';
  exception when others then e4 := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('An unknown section raises invalid_section', e1 = 'invalid_section', e1);
  perform pg_temp.ok('A version other than 2 raises invalid_version', e2 = 'invalid_version', e2);
  perform pg_temp.ok('The three-argument call still refuses the new sections (old contract unchanged)',
    e3 = 'invalid_section', e3);
  perform pg_temp.ok('Version 2 checks the server secret first', e4 = 'invalid_server_secret', e4);

  -- Before Allow and after the end: null.
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  j := public.create_share_code(share_documents => true, share_family_history => true,
                                share_insurance => true, share_medication_notes => true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', tok, j ->> 'code', 'Dr Hennessy', null, null, 'v2-ip-closed');
  r := public.portal_get_record('test-secret', tok, 'overview', 2);
  perform pg_temp.logout();
  perform pg_temp.ok('Nothing before Allow', r is null, coalesce(r::text, 'null'));
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform public.end_session();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  r := public.portal_get_record('test-secret', tok, 'documents', 2);
  perform pg_temp.logout();
  perform pg_temp.ok('Nothing after the session ends', r is null, coalesce(r::text, 'null'));
end $$;

-- 6. The create_share_code overload.
do $$
declare j jsonb; e text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  j := public.create_share_code(share_conditions => false, allow_notes => false, duration_kind => '1h');
  perform pg_temp.logout();
  perform pg_temp.ok('The old call shape reaches the original: new scopes stored false',
    j ->> 'status' = 'code_issued' and j ->> 'share_conditions' = 'false' and j ->> 'duration_kind' = '1h'
    and j ->> 'share_documents' = 'false' and j ->> 'share_family_history' = 'false'
    and j ->> 'share_insurance' = 'false' and j ->> 'share_medication_notes' = 'false', j::text);
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  begin perform public.create_share_code(share_documents => true); e := 'no error';
  exception when others then e := sqlstate; end;
  perform pg_temp.logout();
  perform pg_temp.ok('Naming only some of the new scopes matches neither function (all four must be chosen)',
    e = '42883', e);
  perform pg_temp.login('00000000-0000-4000-8000-000000000801');
  begin perform public.create_share_code(share_documents => null, share_family_history => false,
                                         share_insurance => false, share_medication_notes => false); e := 'no error';
  exception when others then e := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('A null scope is refused (invalid_preferences)', e = 'invalid_preferences', e);
  perform pg_temp.ok('Execute grants: the new patient functions are authenticated only, the portal ones anon',
    not has_function_privilege('anon', 'public.create_share_code(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.create_share_code(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.my_record(text)', 'execute')
    and not has_function_privilege('anon', 'public.seed_demo_record_v2()', 'execute')
    and not has_function_privilege('anon', 'public.upload_document(text,text,text,date,boolean)', 'execute')
    and has_function_privilege('anon', 'public.portal_get_record(text,text,text,integer)', 'execute')
    and has_function_privilege('anon', 'public.portal_get_document(text,text,uuid)', 'execute')
    and not has_function_privilege('public', 'public.portal_get_document(text,text,uuid)', 'execute'), 'ok');
end $$;

select n, test, pass, info from _results order by n;

rollback;
