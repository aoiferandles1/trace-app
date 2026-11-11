-- Test: medication strength periods (redesign, brief 4.1).
-- * log_strength_change adds a period and closes the previous one on the same
--   date; the previous period's strength and note are never overwritten.
-- * Its refusals: someone else's medication, an earlier date, the same
--   strength, a stopped medication, a future date.
-- * Medications written the old way (dose text) keep their periods in step:
--   a new row gets its first period, a dose change closes and opens, ended_on
--   closes, and the old dose column stays filled when the new function is used.
-- * undo_strength_change removes the newest period and reopens the one before.
-- * The browser can edit only a period's note and note_shared.
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
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- "strength:start:end" for every period of a medication, oldest first.
create function pg_temp.periods(mid uuid) returns text language sql as $$
  select string_agg(trim_scale(strength)::text || ':' || start_date || ':' || coalesce(end_date::text, 'open'),
                    ',' order by start_date, created_at)
    from public.medication_periods where medication_id = mid
$$;

insert into auth.users (id, is_anonymous, aud, role) values
  ('00000000-0000-4000-8000-000000000701', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000702', true, 'authenticated', 'authenticated');

-- A medication written the way the old app writes it.
do $$
declare mid uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  insert into public.medications (name, dose, started_on, prescriber)
  values ('Concerta', '18mg', current_date - 400, 'Dr Hennessy')
  returning id into mid;
  perform pg_temp.logout();
  perform pg_temp.put('mid', mid::text);
  perform pg_temp.ok('Old-style insert: the first period comes from dose, started_on and prescriber',
    pg_temp.periods(mid) = '18:' || (current_date - 400) || ':open'
    and (select prescribed_by from public.medication_periods where medication_id = mid) = 'Dr Hennessy',
    pg_temp.periods(mid));
end $$;

-- 1. A strength change closes the previous period on the same date and adds one.
do $$
declare mid uuid := pg_temp.get('mid')::uuid; j jsonb; m public.medications; first_note text;
begin
  update public.medication_periods set note = 'Barely noticed it.' where medication_id = mid;
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  j := public.log_strength_change(mid, 27, current_date - 300, 'Dr Hennessy', 'Better focus.', false);
  j := public.log_strength_change(medication_id => mid, strength => 36, changed_on => current_date - 200,
                                  note => 'Steady all day.', note_shared => true);
  perform pg_temp.logout();
  select * into m from public.medications where id = mid;
  select note into first_note from public.medication_periods where medication_id = mid and strength = 18;
  perform pg_temp.ok('Each change closes the previous period on the change date and opens a new one',
    pg_temp.periods(mid) = format('18:%s:%s,27:%s:%s,36:%s:open', current_date - 400, current_date - 300,
                                  current_date - 300, current_date - 200, current_date - 200),
    pg_temp.periods(mid));
  perform pg_temp.ok('Nothing is overwritten: the first period keeps its strength and note',
    first_note = 'Barely noticed it.' and (select count(*) from public.medication_periods where medication_id = mid) = 3,
    first_note);
  perform pg_temp.ok('The old dose column follows the current strength (the old app keeps working)',
    m.dose = '36mg' and m.unit = 'mg', m.dose);
  perform pg_temp.ok('The result is the medication with its periods newest first, notes for the owner',
    j ->> 'strength_label' = '36mg' and j ->> 'status' = 'current' and (j ->> 'period_count')::int = 3
    and j -> 'periods' -> 0 ->> 'strength' = '36' and j -> 'periods' -> 0 ->> 'note' = 'Steady all day.'
    and j -> 'periods' -> 0 ->> 'note_shared' = 'true' and j -> 'periods' -> 2 ->> 'strength' = '18',
    j::text);
end $$;

-- 2. Refusals.
do $$
declare mid uuid := pg_temp.get('mid')::uuid; e1 text; e2 text; e3 text; e4 text; e5 text; e6 text; before text;
begin
  before := pg_temp.periods(mid);
  perform pg_temp.login('00000000-0000-4000-8000-000000000702');
  begin perform public.log_strength_change(mid, 45, current_date); e1 := 'no error';
  exception when others then e1 := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  begin perform public.log_strength_change(mid, 45, current_date - 250); e2 := 'no error';
  exception when others then e2 := sqlerrm; end;
  begin perform public.log_strength_change(mid, 36, current_date); e3 := 'no error';
  exception when others then e3 := sqlerrm; end;
  begin perform public.log_strength_change(mid, 45, current_date + 1); e4 := 'no error';
  exception when others then e4 := sqlerrm; end;
  begin perform public.log_strength_change(mid, 0, current_date); e5 := 'no error';
  exception when others then e5 := sqlerrm; end;
  begin perform public.log_strength_change(mid, 45, current_date, unit => 'mcg'); e6 := 'no error';
  exception when others then e6 := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('Another user cannot change this medication (not_found)', e1 = 'not_found', e1);
  perform pg_temp.ok('A change dated on or before the current period''s start is refused (invalid_date)', e2 = 'invalid_date', e2);
  perform pg_temp.ok('The same strength is refused (same_strength)', e3 = 'same_strength', e3);
  perform pg_temp.ok('A future date is refused (invalid_date)', e4 = 'invalid_date', e4);
  perform pg_temp.ok('A zero strength is refused (invalid_strength)', e5 = 'invalid_strength', e5);
  perform pg_temp.ok('A different unit is refused (invalid_unit)', e6 = 'invalid_unit', e6);
  perform pg_temp.ok('Refused changes leave the periods as they were', pg_temp.periods(mid) = before, pg_temp.periods(mid));
end $$;

-- 3. Undo removes the newest period and reopens the one before.
do $$
declare mid uuid := pg_temp.get('mid')::uuid; j jsonb; e text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  j := public.undo_strength_change(mid);
  perform pg_temp.logout();
  perform pg_temp.ok('undo_strength_change drops the newest period and reopens the previous one; dose follows',
    pg_temp.periods(mid) = format('18:%s:%s,27:%s:open', current_date - 400, current_date - 300, current_date - 300)
    and (select dose from public.medications where id = mid) = '27mg' and j ->> 'strength_label' = '27mg',
    pg_temp.periods(mid));
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  perform public.undo_strength_change(mid);
  begin perform public.undo_strength_change(mid); e := 'no error';
  exception when others then e := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('The first period cannot be undone (nothing_to_undo)', e = 'nothing_to_undo', e);
end $$;

-- 4. The old app changes the dose text: the open period closes today and a new one opens.
do $$
declare mid uuid := pg_temp.get('mid')::uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  update public.medications set dose = '54mg' where id = mid;
  perform pg_temp.logout();
  perform pg_temp.ok('Old-style dose change: previous period closes today, a new one opens today',
    pg_temp.periods(mid) = format('18:%s:%s,54:%s:open', current_date - 400, (now() at time zone 'Europe/Dublin')::date,
                                  (now() at time zone 'Europe/Dublin')::date),
    pg_temp.periods(mid));
end $$;

-- 5. The old app stops the medication: the latest period ends with it; changes are then refused.
do $$
declare mid uuid := pg_temp.get('mid')::uuid; e text; j jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  update public.medications set ended_on = current_date + 1 where id = mid;
  update public.medications set ended_on = current_date - 1 where id = mid;
  begin perform public.log_strength_change(mid, 18, current_date - 1); e := 'no error';
  exception when others then e := sqlerrm; end;
  j := public.my_record('medications');
  perform pg_temp.logout();
  perform pg_temp.ok('ended_on closes the latest period (never before its start)',
    (select end_date from public.medication_periods where medication_id = mid and strength = 54)
      = (now() at time zone 'Europe/Dublin')::date
    and not exists (select 1 from public.medication_periods where medication_id = mid and end_date is null),
    pg_temp.periods(mid));
  perform pg_temp.ok('A stopped medication refuses a strength change (medication_not_current)', e = 'medication_not_current', e);
  perform pg_temp.ok('A stopped medication is listed under past with its periods',
    jsonb_array_length(j -> 'data' -> 'past') = 1 and j -> 'data' -> 'past' -> 0 ->> 'status' = 'past'
    and jsonb_array_length(j -> 'data' -> 'current') = 0, (j -> 'data')::text);
end $$;

-- 6. A dose the old app wrote as free text has no period, and still reads.
do $$
declare mid uuid; j jsonb; k jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000702');
  insert into public.medications (name, dose) values ('Cream', 'thin layer') returning id into mid;
  j := public.my_record('medications');
  k := public.log_strength_change(mid, 1, current_date, unit => 'g');
  perform pg_temp.logout();
  perform pg_temp.ok('An unreadable dose gives no period; strength_label falls back to the dose text',
    j -> 'data' -> 'current' -> 0 ->> 'strength_label' = 'thin layer'
    and j -> 'data' -> 'current' -> 0 -> 'periods' = '[]'::jsonb, (j -> 'data')::text);
  perform pg_temp.ok('With a unit given, the first strength change creates the first period',
    k ->> 'strength_label' = '1g' and (k ->> 'period_count')::int = 1, k::text);
end $$;

-- 7. What the browser may change on a period.
do $$
declare mid uuid := pg_temp.get('mid')::uuid; e1 text; e2 text; e3 text; n int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000701');
  update public.medication_periods set note = 'Edited note', note_shared = true where medication_id = mid and strength = 18;
  get diagnostics n = row_count;
  begin update public.medication_periods set strength = 99 where medication_id = mid; e1 := 'no error';
  exception when others then e1 := sqlstate; end;
  begin insert into public.medication_periods (medication_id, strength, start_date) values (mid, 5, current_date); e2 := 'no error';
  exception when others then e2 := sqlstate; end;
  begin delete from public.medication_periods where medication_id = mid; e3 := 'no error';
  exception when others then e3 := sqlstate; end;
  perform pg_temp.logout();
  perform pg_temp.ok('The owner can edit a period''s note and note_shared', n = 1
    and (select note from public.medication_periods where medication_id = mid and strength = 18) = 'Edited note', n::text);
  perform pg_temp.ok('The browser cannot change a strength, insert or delete a period directly',
    e1 = '42501' and e2 = '42501' and e3 = '42501', format('update=%s insert=%s delete=%s', e1, e2, e3));
  perform pg_temp.login('00000000-0000-4000-8000-000000000702');
  update public.medication_periods set note = 'hacked' where medication_id = mid;
  get diagnostics n = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('Another user cannot see or edit these periods', n = 0, n::text);
end $$;

-- 8. note_shared defaults to false.
select pg_temp.ok('note_shared defaults to false',
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'medication_periods' and column_name = 'note_shared') = 'false',
  null);

select n, test, pass, info from _results order by n;

rollback;
