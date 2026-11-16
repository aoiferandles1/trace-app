-- Test: medication doses (Home's "Today's medicines" ticks).
-- * The owner ticks (insert), sees and unticks (delete) a dose; one row per
--   medication, day and time of day; only the five times of day are accepted.
-- * Another account cannot see, add to or remove a user's doses, nor tick a
--   dose against someone else's medication; anon has no access; nobody can
--   update a row.
-- * A dose goes with its medication and with the account.
-- * No portal section returns doses: a doctor never sees them.
-- * export_my_data(version 2) includes them.
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
insert into auth.users (id, is_anonymous, aud, role) values
  ('00000000-0000-4000-8000-000000000b01', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000b02', true, 'authenticated', 'authenticated');

-- Jane (b01) has Warfarin; Ann (b02) has Aspirin.
do $$
declare w uuid; a uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000b01');
  insert into public.medications (name, dose, unit, timing) values ('Warfarin', '5mg', 'mg', 'evening') returning id into w;
  perform pg_temp.login('00000000-0000-4000-8000-000000000b02');
  insert into public.medications (name, dose, unit, timing) values ('Aspirin', '75mg', 'mg', 'morning') returning id into a;
  perform pg_temp.logout();
  perform pg_temp.put('w', w::text);
  perform pg_temp.put('a', a::text);
end $$;

-- 1. The owner ticks, sees and unticks. (Checks are recorded after logout:
--    the results table belongs to the owner.)
do $$
declare w uuid := pg_temp.get('w')::uuid; n int; dup text; slot_e text; upd text; un int; d uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000b01');
  insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-16', 'evening') returning id into d;
  select count(*) into n from public.medication_doses;
  begin
    insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-16', 'evening');
    dup := 'no error';
  exception when others then dup := sqlstate;
  end;
  begin
    insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-16', 'lunch');
    slot_e := 'no error';
  exception when others then slot_e := sqlstate;
  end;
  begin
    update public.medication_doses set taken_on = date '2026-11-15' where id = d;
    upd := 'no error';
  exception when others then upd := sqlstate;
  end;
  insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-15', 'evening');
  delete from public.medication_doses where taken_on = date '2026-11-15';
  get diagnostics un = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('The owner ticks a dose and sees it', n = 1, n::text);
  perform pg_temp.ok('A second tick for the same day and time is refused (unique)', dup = '23505', dup);
  perform pg_temp.ok('Only morning, midday, evening, bedtime and other are times of day', slot_e = '23514', slot_e);
  perform pg_temp.ok('A dose cannot be updated (untick and tick again)', upd = '42501', upd);
  perform pg_temp.ok('The owner unticks a dose', un = 1, un::text);
end $$;

-- 2. Another account and anon.
do $$
declare w uuid := pg_temp.get('w')::uuid; a uuid := pg_temp.get('a')::uuid;
  seen int; gone int; other text; as_jane text; cross_med text; anon_e text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000b02');
  select count(*) into seen from public.medication_doses;
  delete from public.medication_doses where medication_id = w;
  get diagnostics gone = row_count;
  begin
    insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-16', 'morning');
    other := 'no error';
  exception when others then other := sqlstate;
  end;
  begin
    insert into public.medication_doses (user_id, medication_id, taken_on, slot)
    values ('00000000-0000-4000-8000-000000000b01', w, date '2026-11-16', 'morning');
    as_jane := 'no error';
  exception when others then as_jane := sqlstate;
  end;
  perform pg_temp.login('00000000-0000-4000-8000-000000000b01');
  begin
    insert into public.medication_doses (medication_id, taken_on, slot) values (a, date '2026-11-16', 'morning');
    cross_med := 'no error';
  exception when others then cross_med := sqlstate;
  end;
  perform pg_temp.login_anon();
  begin
    perform count(*) from public.medication_doses;
    anon_e := 'no error';
  exception when others then anon_e := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Another account sees none of Jane''s doses', seen = 0, seen::text);
  perform pg_temp.ok('Another account cannot untick Jane''s doses', gone = 0, gone::text);
  perform pg_temp.ok('Another account cannot tick a dose of Jane''s medication', other = '23503', other);
  perform pg_temp.ok('Another account cannot write a dose as Jane', as_jane = '42501', as_jane);
  perform pg_temp.ok('Jane cannot tick a dose against Ann''s medication', cross_med = '23503', cross_med);
  perform pg_temp.ok('anon has no access', anon_e = '42501', anon_e);
end $$;

-- 3. The export has them; no portal section returns them.
do $$
declare j jsonb; n int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000b01');
  j := public.export_my_data(version => 2);
  perform pg_temp.logout();
  perform pg_temp.ok('export_my_data(version 2) includes the doses',
    jsonb_array_length(j -> 'medication_doses') = 1 and j -> 'medication_doses' -> 0 ->> 'slot' = 'evening',
    j ->> 'medication_doses');
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname in ('public', 'private') and p.proname like 'portal%' and p.prosrc ilike '%medication_doses%';
  perform pg_temp.ok('No portal function reads medication_doses', n = 0, n::text);
end $$;

-- 4. A dose goes with its medication, and with the account.
do $$
declare w uuid := pg_temp.get('w')::uuid; a uuid := pg_temp.get('a')::uuid; n int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000b01');
  insert into public.medication_doses (medication_id, taken_on, slot) values (w, date '2026-11-17', 'evening');
  delete from public.medications where id = w;
  perform pg_temp.logout();
  select count(*) into n from public.medication_doses where medication_id = w;
  perform pg_temp.ok('Deleting a medication deletes its doses', n = 0, n::text);

  perform pg_temp.login('00000000-0000-4000-8000-000000000b02');
  insert into public.medication_doses (medication_id, taken_on, slot) values (a, date '2026-11-16', 'morning');
  perform pg_temp.logout();
  delete from auth.users where id = '00000000-0000-4000-8000-000000000b02';
  select count(*) into n from public.medication_doses where user_id = '00000000-0000-4000-8000-000000000b02';
  perform pg_temp.ok('Deleting the account deletes its doses', n = 0, n::text);
end $$;

select n, test, pass, info from _results order by n;

rollback;
