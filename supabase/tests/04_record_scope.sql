-- Test: portal_get_record applies the patient's choices exactly.
-- * Each preference switch hides exactly its section.
-- * Mental health rows stay hidden when the switch is off; medications always come through.
-- * Personal notes (kind note) are never returned, even with the full timeline shared.
-- * The visit the share was started from is not repeated in the timeline.
-- * Each section returns only its own parts.
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
-- Titles in a JSON array of entries, newest first as returned.
create function pg_temp.titles(a jsonb) returns text language sql as $$
  select coalesce(string_agg(x ->> 'title', '|' order by ord), '') from jsonb_array_elements(a) with ordinality t(x, ord)
$$;

-- Run one whole share as the patient and the portal, read one section, end it.
create function pg_temp.share_view(prefs jsonb, section text, with_appointment boolean default true)
returns jsonb language plpgsql as $$
declare
  uid uuid := '00000000-0000-4000-8000-0000000000e1';
  appt uuid := case when with_appointment then pg_temp.get('appt')::uuid end;
  tok text := 'scope-token-' || md5(random()::text);
  j jsonb; r jsonb; rec jsonb;
begin
  perform pg_temp.login(uid);
  j := public.create_share_code(
    share_conditions => coalesce((prefs ->> 'conditions')::boolean, true),
    share_recent_visits => coalesce((prefs ->> 'recent_visits')::boolean, true),
    share_full_timeline => coalesce((prefs ->> 'full_timeline')::boolean, false),
    share_care_team => coalesce((prefs ->> 'care_team')::boolean, true),
    share_mental_health => coalesce((prefs ->> 'mental_health')::boolean, false),
    allow_notes => true,
    duration_kind => '30m',
    appointment_entry_id => appt);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', tok, j ->> 'code', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
                                 'scope-ip-' || md5(random()::text));
  perform pg_temp.logout();
  perform pg_temp.login(uid);
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  rec := public.portal_get_record('test-secret', tok, section);
  perform pg_temp.logout();
  perform pg_temp.login(uid);
  perform public.end_session();
  perform pg_temp.logout();
  return rec;
end $$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into auth.users (id, is_anonymous, aud, role)
values ('00000000-0000-4000-8000-0000000000e1', true, 'authenticated', 'authenticated');

do $$
declare j jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000e1');
  j := public.seed_demo_record();
  perform pg_temp.logout();
  perform pg_temp.put('appt', j ->> 'appointment_entry_id');
end $$;

-- Extra rows on top of Jane's seed: mental health items, a recent personal note, an old letter.
insert into public.conditions (user_id, name, status, is_mental_health)
values ('00000000-0000-4000-8000-0000000000e1', 'Anxiety', 'ongoing', true);
insert into public.entries (user_id, kind, title, occurs_at, is_mental_health, body) values
  ('00000000-0000-4000-8000-0000000000e1', 'visit', 'Counselling session', now() - interval '5 days', true, null),
  ('00000000-0000-4000-8000-0000000000e1', 'visit', 'Counselling follow-up', now() + interval '20 days', true, null),
  ('00000000-0000-4000-8000-0000000000e1', 'note', 'Private thought', now() - interval '1 day', false, 'Only for me'),
  ('00000000-0000-4000-8000-0000000000e1', 'letter', 'Referral letter', now() - interval '100 days', false, null);
insert into public.medications (user_id, name, dose, drug_class, started_on)
values ('00000000-0000-4000-8000-0000000000e1', 'Sertraline', '50mg', 'SSRI', current_date - 60);

-- 1. GP visit defaults.
do $$
declare rec jsonb := pg_temp.share_view('{}'::jsonb, 'overview');
begin
  perform pg_temp.ok('Defaults: conditions without the mental health one',
    (select string_agg(x ->> 'name', '|' order by ord) from jsonb_array_elements(rec -> 'conditions') with ordinality t(x, ord))
      = 'Atrial fibrillation|Hypothyroidism|Mild asthma',
    (rec -> 'conditions')::text);
  perform pg_temp.ok('Defaults: the 3 most recent past entries, no note, no mental health, not today''s visit',
    pg_temp.titles(rec -> 'timeline') = 'Blood test, full blood count and INR|Warfarin prescription renewed|Cardiology review',
    pg_temp.titles(rec -> 'timeline'));
  perform pg_temp.ok('Defaults: upcoming visits without the mental health one',
    pg_temp.titles(rec -> 'upcoming') = 'INR blood test|Cardiology follow-up', pg_temp.titles(rec -> 'upcoming'));
  perform pg_temp.ok('Medications always come through, including one for a mental health condition',
    jsonb_array_length(rec -> 'medications' -> 'current') = 4
    and jsonb_array_length(rec -> 'medications' -> 'expired') = 2
    and (rec -> 'medications')::text like '%Sertraline%',
    format('current=%s expired=%s', jsonb_array_length(rec -> 'medications' -> 'current'),
           jsonb_array_length(rec -> 'medications' -> 'expired')));
  perform pg_temp.ok('Overview carries vitals, critical safety and scope; not the care team',
    rec -> 'vitals' ->> 'systolic' = '128' and rec -> 'critical' ->> 'blood_type' = 'A+'
    and rec -> 'scope' ->> 'mental_health' = 'false' and rec -> 'care_team' = 'null'::jsonb,
    format('vitals=%s care_team=%s', rec -> 'vitals', rec -> 'care_team'));
end $$;

-- 2. Active conditions off.
do $$
declare rec jsonb := pg_temp.share_view('{"conditions": false}'::jsonb, 'overview');
declare rec2 jsonb := pg_temp.share_view('{"conditions": false}'::jsonb, 'conditions');
begin
  perform pg_temp.ok('Conditions off: conditions null in overview and in the conditions section, medications still there',
    rec -> 'conditions' = 'null'::jsonb and rec2 -> 'conditions' = 'null'::jsonb
    and jsonb_array_length(rec -> 'medications' -> 'current') = 4, (rec -> 'conditions')::text);
end $$;

-- 3. Mental health on.
do $$
declare rec jsonb := pg_temp.share_view('{"mental_health": true}'::jsonb, 'overview');
begin
  perform pg_temp.ok('Mental health on: the mental health condition is included',
    (rec -> 'conditions')::text like '%Anxiety%' and jsonb_array_length(rec -> 'conditions') = 4,
    (rec -> 'conditions')::text);
  perform pg_temp.ok('Mental health on: mental health entries join the recent 3 and upcoming',
    pg_temp.titles(rec -> 'timeline') = 'Counselling session|Blood test, full blood count and INR|Warfarin prescription renewed'
    and pg_temp.titles(rec -> 'upcoming') = 'INR blood test|Counselling follow-up|Cardiology follow-up',
    pg_temp.titles(rec -> 'timeline') || ' / ' || pg_temp.titles(rec -> 'upcoming'));
end $$;

-- 4. Full timeline, mental health on: every past entry except notes and today's visit.
do $$
declare rec jsonb := pg_temp.share_view('{"full_timeline": true, "mental_health": true}'::jsonb, 'timeline');
begin
  perform pg_temp.ok('Full timeline: every past entry, newest first',
    pg_temp.titles(rec -> 'timeline') =
      'Counselling session|Blood test, full blood count and INR|Warfarin prescription renewed|Cardiology review|Referral letter',
    pg_temp.titles(rec -> 'timeline'));
  perform pg_temp.ok('A personal note is never returned, even with full timeline and mental health on',
    not exists (select 1 from jsonb_array_elements(coalesce(rec -> 'timeline', '[]') || coalesce(rec -> 'upcoming', '[]')) x
                 where x ->> 'kind' = 'note')
    and rec::text not like '%Private thought%' and rec::text not like '%Only for me%'
    and rec::text not like '%Fatigue symptoms%' and rec::text not like '%Personal note%',
    'no note in the timeline section');
end $$;

-- 5. Full timeline, mental health off: mental health entries still hidden.
do $$
declare rec jsonb := pg_temp.share_view('{"full_timeline": true, "recent_visits": false}'::jsonb, 'timeline');
begin
  perform pg_temp.ok('Full timeline with mental health off: no mental health entries',
    pg_temp.titles(rec -> 'timeline') =
      'Blood test, full blood count and INR|Warfarin prescription renewed|Cardiology review|Referral letter'
    and rec::text not like '%Counselling%', pg_temp.titles(rec -> 'timeline'));
end $$;

-- 6. Recent visits and full timeline both off: no timeline, no upcoming, no vitals.
do $$
declare rec jsonb := pg_temp.share_view('{"recent_visits": false, "full_timeline": false}'::jsonb, 'overview');
begin
  perform pg_temp.ok('Timeline off: timeline, upcoming and vitals are null; medications still there',
    rec -> 'timeline' = 'null'::jsonb and rec -> 'upcoming' = 'null'::jsonb and rec -> 'vitals' = 'null'::jsonb
    and jsonb_array_length(rec -> 'medications' -> 'current') = 4, rec::text);
end $$;

-- 7. Care team switch.
do $$
declare on_rec jsonb := pg_temp.share_view('{}'::jsonb, 'care_team');
declare off_rec jsonb := pg_temp.share_view('{"care_team": false}'::jsonb, 'care_team');
begin
  perform pg_temp.ok('Care team on: the care team section lists it (GP first)',
    jsonb_array_length(on_rec -> 'care_team') = 4 and on_rec -> 'care_team' -> 0 ->> 'name' = 'Dr Hennessy',
    (on_rec -> 'care_team')::text);
  perform pg_temp.ok('Care team off: null', off_rec -> 'care_team' = 'null'::jsonb, (off_rec -> 'care_team')::text);
end $$;

-- 8. Every switch off: critical safety and medications still travel.
do $$
declare rec jsonb := pg_temp.share_view(
  '{"conditions": false, "recent_visits": false, "full_timeline": false, "care_team": false, "mental_health": false}'::jsonb,
  'medications');
begin
  perform pg_temp.ok('Everything off: patient, critical safety and all medications are still returned',
    rec -> 'patient' ->> 'first_name' = 'Jane' and rec -> 'critical' -> 'allergies' = '["Penicillin"]'::jsonb
    and jsonb_array_length(rec -> 'medications' -> 'current') = 4
    and jsonb_array_length(rec -> 'medications' -> 'expired') = 2, (rec -> 'medications' -> 'expired')::text);
  perform pg_temp.ok('The medications section carries no conditions, timeline or care team',
    rec -> 'conditions' = 'null'::jsonb and rec -> 'timeline' = 'null'::jsonb and rec -> 'care_team' = 'null'::jsonb,
    rec::text);
end $$;

-- 9. Shared from Profile (no appointment): today's visit is part of the record like any other entry.
do $$
declare rec jsonb := pg_temp.share_view('{}'::jsonb, 'overview', false);
begin
  perform pg_temp.ok('Without an appointment, today''s GP visit appears in the timeline or upcoming',
    (pg_temp.titles(rec -> 'timeline') || '|' || pg_temp.titles(rec -> 'upcoming')) like '%GP visit%',
    pg_temp.titles(rec -> 'timeline') || ' / ' || pg_temp.titles(rec -> 'upcoming'));
end $$;

-- 10. An unknown section is refused.
do $$
declare e text;
begin
  perform pg_temp.login_anon();
  begin
    perform public.portal_get_record('test-secret', 'any-token-0123456789abcdefghijklmnopq', 'documents');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('portal_get_record refuses an unknown section (documents are never shared)', e = 'invalid_section', e);
end $$;

select n, test, pass, info from _results order by n;

rollback;
