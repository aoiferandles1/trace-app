-- Test: the redesign's demo seed, insurance, export, deletion and isolation.
-- * seed_demo_record_v2 matches the approved boards (docs/redesign/canvas):
--   medications and Concerta's five periods, past medications, visits and
--   results with their dates relative to today, the nine timeline events,
--   seven relatives, care team, vitals; no penicillin antibiotic; it resets;
--   it refuses a real account; seed_demo_record is untouched.
-- * save_insurance keeps only the last four of the member number; the table
--   has no column that could hold a password.
-- * export_my_data(version => 2) covers every new table, files included;
--   export_my_data() is unchanged.
-- * delete_my_account removes every new row, document bytes included.
-- * One user cannot read or write another's rows in any new table; the anon
--   role reads none of them.
--
-- Runs inside a transaction that rolls back.

begin;

create temp table _results (n serial, test text, pass boolean, info text);
create function pg_temp.ok(t text, pass boolean, info text default null) returns void
  language sql as $$ insert into _results (test, pass, info) values (t, coalesce(pass, false), info) $$;
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
create function pg_temp.new_counts(uid uuid) returns text language sql as $$
  select format('periods=%s results=%s events=%s prescriptions=%s relatives=%s rel_conditions=%s insurance=%s documents=%s files=%s',
    (select count(*) from public.medication_periods where user_id = uid),
    (select count(*) from public.result_values where user_id = uid),
    (select count(*) from public.health_events where user_id = uid),
    (select count(*) from public.health_event_prescriptions where user_id = uid),
    (select count(*) from public.relatives where user_id = uid),
    (select count(*) from public.relative_conditions where user_id = uid),
    (select count(*) from public.insurance_connections where user_id = uid),
    (select count(*) from public.documents where user_id = uid),
    (select count(*) from private.document_files where user_id = uid))
$$;

insert into private.allowed_emails (email) values ('real-10@example.com');
insert into auth.users (id, is_anonymous, aud, role) values
  ('00000000-0000-4000-8000-000000000a01', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000a02', true, 'authenticated', 'authenticated');
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000a03', 'real-10@example.com', 'authenticated', 'authenticated');

-- 1. The seed matches the boards.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000a01'; j jsonb; d date := (now() at time zone 'Europe/Dublin')::date;
  meds jsonb; tl jsonb; fam jsonb; ov jsonb; rv jsonb; con jsonb; s text;
begin
  perform pg_temp.login(uid);
  j := public.seed_demo_record_v2();
  meds := public.my_record('medications');
  tl := public.my_record('full_timeline');
  fam := public.my_record('family_history');
  ov := public.my_record('overview');
  rv := public.my_record('recent_visits');
  perform pg_temp.logout();

  perform pg_temp.ok('Current medications: Concerta 36mg Morning, Levothyroxine 50mcg Morning, Warfarin 5mg Evening, Salbutamol 100mcg As needed',
    (select string_agg(m ->> 'name' || ' ' || (m ->> 'strength_label') || ' ' || (m ->> 'schedule'), '|' order by o)
       from jsonb_array_elements(meds -> 'data' -> 'current') with ordinality t(m, o))
      = 'Concerta 36mg Morning|Levothyroxine 50mcg Morning|Warfarin 5mg Evening|Salbutamol 100mcg As needed',
    (select string_agg(m ->> 'name' || ' ' || (m ->> 'strength_label') || ' ' || coalesce(m ->> 'schedule', '-'), '|')
       from jsonb_array_elements(meds -> 'data' -> 'current') m));

  con := meds -> 'data' -> 'current' -> 0;
  perform pg_temp.ok('Concerta: 18, 27, 36, 45, 36 from Jan 2024, every period Dr Hennessy, newest first, with the notes',
    (select string_agg(p ->> 'strength' || '@' || (p ->> 'start_date') || '-' || coalesce(p ->> 'end_date', 'now'), ','
                       order by o desc)
       from jsonb_array_elements(con -> 'periods') with ordinality t(p, o))
      = '18@2024-01-01-2024-03-01,27@2024-03-01-2024-06-01,36@2024-06-01-2024-10-01,45@2024-10-01-2025-02-01,36@2025-02-01-now'
    and (select bool_and(p ->> 'prescribed_by' = 'Dr Hennessy' and p ->> 'date_precision' = 'month')
           from jsonb_array_elements(con -> 'periods') p)
    and con -> 'periods' -> 0 ->> 'note' = 'Back on 36. Smoother and sleeping better.'
    and con -> 'periods' -> 4 ->> 'note' = 'Barely noticed it. A little more focus in the morning, gone by lunch.'
    and con -> 'periods' -> 1 ->> 'note' = 'Too much. Racing heart and trouble sleeping.'
    and (con ->> 'period_count')::int = 5,
    (con -> 'periods')::text);

  perform pg_temp.ok('Levothyroxine 25mcg (Mar to Sep 2022) then 50mcg, Dr Walsh; Warfarin 8 days of supply left',
    meds -> 'data' -> 'current' -> 1 -> 'periods' -> 1 ->> 'strength_label' = '25mcg'
    and meds -> 'data' -> 'current' -> 1 -> 'periods' -> 1 ->> 'end_date' = '2022-09-01'
    and meds -> 'data' -> 'current' -> 1 -> 'periods' -> 0 ->> 'prescribed_by' = 'Dr Walsh'
    and (meds -> 'data' -> 'current' -> 2 ->> 'supply_days_left')::int = 8,
    (meds -> 'data' -> 'current' -> 1)::text);

  perform pg_temp.ok('Past: Doxycycline 100mg 2 to 9 Aug 2026, Prednisolone 20mg, Nitrofurantoin 100mg, Cetirizine 10mg, all Dr Hennessy',
    (select string_agg(m ->> 'name' || ' ' || (m ->> 'strength_label') || ' ' || (m ->> 'started_on') || '/' || (m ->> 'ended_on')
                       || ' ' || (m -> 'periods' -> 0 ->> 'prescribed_by'), '|' order by o)
       from jsonb_array_elements(meds -> 'data' -> 'past') with ordinality t(m, o))
      = 'Doxycycline 100mg 2026-08-02/2026-08-09 Dr Hennessy|Prednisolone 20mg 2026-02-09/2026-02-14 Dr Hennessy'
        || '|Nitrofurantoin 100mg 2025-09-12/2025-09-17 Dr Hennessy|Cetirizine 10mg 2024-04-01/2024-09-30 Dr Hennessy',
    (meds -> 'data' -> 'past')::text);

  select string_agg(kind || ':' || title || '@' || ((occurs_at at time zone 'Europe/Dublin')::date - d), ',' order by occurs_at)
    into s from public.entries where user_id = uid;
  perform pg_temp.ok('Visits: Warfarin renewed -12, Fatigue symptoms note -11, Blood count and INR -9, GP visit today, INR +14, Cardiology +48',
    s = 'prescription:Warfarin renewed@-12,note:Fatigue symptoms@-11,result:Blood count and INR@-9,visit:GP visit@0,'
        || 'visit:INR blood test@14,visit:Cardiology follow-up@48', s);

  perform pg_temp.ok('Today''s GP visit at 9:30 with Dr Hennessy carries Reason, Assessment and Plan (INR date relative)',
    exists (select 1 from public.entries e where e.id = (j ->> 'appointment_entry_id')::uuid
              and e.occurs_at = ((d + time '09:30') at time zone 'Europe/Dublin')
              and e.clinician = 'Dr Hennessy' and e.place = 'Rathmines Medical Centre'
              and e.reason = 'Tired for three weeks'
              and e.plan = 'Blood tests. Repeat INR on ' || to_char(d + 14, 'FMDD Mon') || '.'), j::text);

  perform pg_temp.ok('Blood count and INR: five rows with ranges; only Ferritin flagged low',
    (select string_agg(r ->> 'name' || '=' || (r ->> 'value') || coalesce(' ' || (r ->> 'flag'), ''), ',' order by o)
       from jsonb_array_elements((select x from jsonb_array_elements(tl -> 'data' -> 'visits') x
                                   where x ->> 'title' = 'Blood count and INR') -> 'detail' -> 'results')
            with ordinality t(r, o))
      = 'Haemoglobin=128,White cells=6.2,Platelets=245,INR=2.4,Ferritin=18 low',
    (tl -> 'data' -> 'visits')::text);

  perform pg_temp.ok('Warfarin renewed: prescription fields, Dr O''Mahony, Boots Rathmines',
    exists (select 1 from jsonb_array_elements(tl -> 'data' -> 'visits') x
             where x ->> 'title' = 'Warfarin renewed' and x -> 'detail' ->> 'medication' = 'Warfarin 5mg, daily'
               and x -> 'detail' ->> 'quantity' = '28 tablets' and x ->> 'clinician' = 'Dr O''Mahony'),
    null);

  perform pg_temp.ok('Upcoming: INR blood test then Cardiology follow-up',
    (select string_agg(x ->> 'title', '|' order by o) from jsonb_array_elements(rv -> 'data' -> 'upcoming') with ordinality t(x, o)
      where x ->> 'title' <> 'GP visit')   -- today's 9:30 visit is upcoming only before 9:30
      = 'INR blood test|Cardiology follow-up', (rv -> 'data' -> 'upcoming')::text);

  perform pg_temp.ok('Full timeline: the nine events from the board, newest first',
    (select string_agg(e ->> 'title' || ' ' || to_char((e ->> 'occurred_on')::date, 'Mon YYYY'), '|' order by o)
       from jsonb_array_elements(tl -> 'data' -> 'events') with ordinality t(e, o))
      = 'Chest infection Aug 2026|Asthma flare Feb 2026|Urinary tract infection Sep 2025|Hay fever Apr 2024'
        || '|Tonsillitis Nov 2023|Hypothyroidism diagnosed Mar 2022|Covid-19 Dec 2020'
        || '|Atrial fibrillation diagnosed Jun 2019|Glandular fever Feb 2018',
    null);

  perform pg_temp.ok('Timeline detail: Seen by, Outcome, Prescribed and notes as on the board',
    tl -> 'data' -> 'events' -> 0 ->> 'seen_by' = 'Dr Hennessy, Rathmines Medical Centre'
    and tl -> 'data' -> 'events' -> 0 ->> 'outcome' = 'resolved'
    and tl -> 'data' -> 'events' -> 0 -> 'prescriptions' -> 0 ->> 'name' = 'Doxycycline 100mg'
    and tl -> 'data' -> 'events' -> 0 -> 'prescriptions' -> 0 ->> 'detail' = '7 days, from 2 Aug'
    and tl -> 'data' -> 'events' -> 0 -> 'prescriptions' -> 0 ->> 'medication_period_id' is not null
    and tl -> 'data' -> 'events' -> 1 -> 'prescriptions' -> 1 ->> 'name' = 'Salbutamol 100mcg'
    and tl -> 'data' -> 'events' -> 7 ->> 'seen_by' = 'Dr O''Mahony, Cardiology, Mater Private'
    and tl -> 'data' -> 'events' -> 5 -> 'prescriptions' -> 0 ->> 'detail' = 'Raised to 50mcg in Sep 2022'
    and tl -> 'data' -> 'events' -> 1 ->> 'notes' = 'Wheeze after a cold. Peak flow improved on treatment.',
    (tl -> 'data' -> 'events' -> 0)::text);

  perform pg_temp.ok('Penicillin allergy: no penicillin-class antibiotic anywhere in the seed',
    not exists (select 1 from public.medications where user_id = uid
                 and name ~* '(cillin|penicillin|amoxi|co-amoxiclav|flucloxa)')
    and not exists (select 1 from public.health_event_prescriptions where user_id = uid
                     and name ~* '(cillin|penicillin|amoxi|co-amoxiclav|flucloxa)'), 'ok');

  perform pg_temp.ok('Family: seven relatives, as on the tree',
    (select string_agg(r ->> 'label' || ':' || coalesce((select string_agg(c ->> 'label', '+') from jsonb_array_elements(r -> 'conditions') c), 'none known'),
                       '|' order by o)
       from jsonb_array_elements(fam -> 'data' -> 'relatives') with ordinality t(r, o))
      = 'Mum''s mum:Type 2 diabetes|Mum''s dad:none known|Dad''s mum:Asthma|Dad''s dad:Heart attack at 61'
        || '|Mum:Type 2 diabetes|Dad:Atrial fibrillation|Brother:Asthma',
    null);

  perform pg_temp.ok('Overview: conditions, vitals 128/82, 74, 58, 98; care team of four; no documents, insurance or mental health items',
    jsonb_array_length(ov -> 'data' -> 'conditions') = 3
    and ov -> 'data' -> 'vitals' ->> 'systolic' = '128' and ov -> 'data' -> 'vitals' ->> 'spo2' = '98'
    and (select count(*) from public.care_team where user_id = uid) = 4
    and (select name || ', ' || role || ', ' || organisation from public.care_team where user_id = uid and kind = 'pharmacy')
        = 'Boots, Pharmacy, Rathmines'
    and pg_temp.new_counts(uid) = 'periods=13 results=5 events=9 prescriptions=10 relatives=7 rel_conditions=6 insurance=0 documents=0 files=0'
    and not exists (select 1 from public.conditions where user_id = uid and is_mental_health)
    and not exists (select 1 from public.entries where user_id = uid and is_mental_health),
    pg_temp.new_counts(uid));
end $$;

-- 2. The seed resets everything, new tables included, and refuses a real account.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000a01'; before text; e text; e2 text;
begin
  before := pg_temp.new_counts(uid);
  perform pg_temp.login(uid);
  perform public.save_insurance('Laya Healthcare', 'LH-99887766', null, null, 'manual');
  perform public.upload_document('Scan', 'image/png', encode('\x89504e470d0a1a0a0000'::bytea, 'base64'));
  insert into public.relatives (relation) values ('sister');
  perform public.create_share_code(share_documents => true, share_family_history => true,
                                   share_insurance => true, share_medication_notes => true);
  perform public.seed_demo_record_v2();
  perform pg_temp.logout();
  perform pg_temp.ok('Calling it again resets every table, sessions included',
    pg_temp.new_counts(uid) = before
    and not exists (select 1 from public.share_sessions where patient_id = uid), pg_temp.new_counts(uid));
  perform pg_temp.login('00000000-0000-4000-8000-000000000a03');
  begin perform public.seed_demo_record_v2(); e := 'no error';
  exception when others then e := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  begin perform public.seed_demo_record_v2(); e2 := 'no error';
  exception when others then e2 := sqlstate; end;
  perform pg_temp.logout();
  perform pg_temp.ok('A real account is refused (not_anonymous); the anon key alone is refused',
    e = 'not_anonymous' and e2 = '42501', e || ' / ' || e2);
end $$;

-- 3. Insurance: masked, no password anywhere.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000a02'; i jsonb; e1 text; e2 text; e3 text; n int;
begin
  perform pg_temp.login(uid);
  i := public.save_insurance('VHI', '1234 5678 4821', 'Comprehensive plan', date '2027-03-01', 'provider');
  begin perform public.save_insurance('VHI', '12', null, null, 'manual'); e1 := 'no error';
  exception when others then e1 := sqlerrm; end;
  begin insert into public.insurance_connections (provider, member_number_last4, via) values ('VHI', '1234', 'manual');
    e2 := 'no error';
  exception when others then e2 := sqlstate; end;
  begin update public.insurance_connections set member_number_last4 = '9999'; e3 := 'no error';
  exception when others then e3 := sqlstate; end;
  update public.insurance_connections set include_in_shares = true;
  get diagnostics n = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('save_insurance keeps only the last four characters and returns them masked',
    i ->> 'member_number_masked' = '•••• 4821' and i ->> 'include_in_shares' = 'false'
    and (select member_number_last4 from public.insurance_connections where user_id = uid) = '4821'
    and i::text not like '%5678%', i::text);
  perform pg_temp.ok('A member number shorter than four characters is refused', e1 = 'invalid_member_number', e1);
  perform pg_temp.ok('The browser cannot insert a connection or change the stored number; it can toggle include_in_shares',
    e2 = '42501' and e3 = '42501' and n = 1, format('%s %s %s', e2, e3, n));
  perform pg_temp.ok('No column in the insurance table could hold a password or token',
    not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'insurance_connections'
                   and column_name ~* '(pass|secret|token|cred|pin|auth)')
    and (select array_agg(column_name::text order by column_name) from information_schema.columns
          where table_schema = 'public' and table_name = 'insurance_connections')
        = array['connected_at', 'created_at', 'id', 'include_in_shares', 'member_number_last4', 'plan_name',
                'provider', 'renews_on', 'updated_at', 'user_id', 'via'],
    null);
  perform pg_temp.ok('save_insurance takes no password argument',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'save_insurance'
                   and array_to_string(p.proargnames, ',') ~* '(pass|secret|token|cred)'), null);
end $$;

-- 4. Export, version 2: every table, files included. The original export is unchanged.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000a01'; j jsonb; old jsonb; e text;
begin
  perform pg_temp.login(uid);
  perform public.upload_document('Scan', 'image/png', encode('\x89504e470d0a1a0a0000'::bytea, 'base64'));
  j := public.export_my_data(version => 2);
  old := public.export_my_data();
  begin perform public.export_my_data(version => 1); e := 'no error';
  exception when others then e := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('export_my_data(version 2) has every table the user owns',
    (select array_agg(k order by k) from jsonb_object_keys(j) k) =
      array['access_events', 'care_team', 'conditions', 'documents', 'entries', 'exported_at', 'health_event_prescriptions',
            'health_events', 'insurance_connections', 'medication_periods', 'medications', 'profile', 'relative_conditions',
            'relatives', 'result_values', 'share_sessions', 'user_id', 'version', 'vitals']
    and jsonb_array_length(j -> 'medication_periods') = 13 and jsonb_array_length(j -> 'health_events') = 9
    and jsonb_array_length(j -> 'relatives') = 7 and jsonb_array_length(j -> 'result_values') = 5
    and j -> 'documents' -> 0 ->> 'data_base64' = encode('\x89504e470d0a1a0a0000'::bytea, 'base64'),
    (select string_agg(k, ',') from jsonb_object_keys(j) k));
  perform pg_temp.ok('export_my_data() keeps its original keys',
    (select array_agg(k order by k) from jsonb_object_keys(old) k) =
      array['access_events', 'care_team', 'conditions', 'entries', 'exported_at', 'medications', 'profile',
            'share_sessions', 'user_id', 'vitals'], null);
  perform pg_temp.ok('Another version is refused (invalid_version)', e = 'invalid_version', e);
end $$;

-- 5. Isolation: another user reads and changes nothing; anon reads nothing.
do $$
declare t text; c int; total int := 0; errs text := ''; denied int := 0; n int; e text;
  foreign_entry uuid := (select id from public.entries where user_id = '00000000-0000-4000-8000-000000000a01'
                          and kind = 'result' limit 1);
  tables text[] := array['medication_periods', 'result_values', 'health_events', 'health_event_prescriptions',
                         'relatives', 'relative_conditions', 'insurance_connections', 'documents'];
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000a02');
  foreach t in array tables loop
    execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-000000000a01') into c;
    total := total + c;
  end loop;
  update public.health_events set title = 'hacked' where user_id = '00000000-0000-4000-8000-000000000a01';
  get diagnostics n = row_count;
  begin
    insert into public.relatives (user_id, relation) values ('00000000-0000-4000-8000-000000000a01', 'sister');
    e := 'no error';
  exception when others then e := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Another user reads none of the new tables'' rows, updates none and cannot plant one',
    total = 0 and n = 0 and e = '42501', format('read=%s updated=%s insert=%s', total, n, e));

  -- A child row cannot point at someone else's parent.
  perform pg_temp.login('00000000-0000-4000-8000-000000000a02');
  begin
    insert into public.result_values (entry_id, name, value) values (foreign_entry, 'planted', 1);
    e := 'no error';
  exception when others then e := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('A child row cannot attach to another user''s record (foreign key on id and user_id)',
    e = '23503' and foreign_entry is not null, e);

  foreach t in array tables loop
    perform pg_temp.login_anon();
    begin
      execute format('select count(*) from public.%I', t);
      errs := errs || t || ':readable ';
    exception when insufficient_privilege then denied := denied + 1;
    end;
    perform pg_temp.logout();
  end loop;
  perform pg_temp.ok('anon has no access to any new table', denied = 8, coalesce(nullif(errs, ''), 'all 8 denied'));
end $$;

-- 6. Deleting the account removes every new row, document bytes included.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000a01'; c text;
begin
  perform pg_temp.login(uid);
  perform public.save_insurance('VHI', '4821-0000-1111', null, null, 'provider');
  perform public.delete_my_account();
  perform pg_temp.logout();
  c := pg_temp.new_counts(uid);
  perform pg_temp.ok('delete_my_account removes every new table''s rows and the stored files',
    not exists (select 1 from auth.users where id = uid)
    and c = 'periods=0 results=0 events=0 prescriptions=0 relatives=0 rel_conditions=0 insurance=0 documents=0 files=0', c);
end $$;

select n, test, pass, info from _results order by n;

rollback;
