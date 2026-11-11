-- Test: row-level security. A user reads and writes only their own rows;
-- share_sessions and access_events are read-only to their owner; the anon
-- role (publishable key, not signed in) can read no table at all.
--
-- Runs inside a transaction that rolls back. Run it with the Supabase MCP
-- execute_sql tool (or psql) as the postgres role. The final SELECT lists
-- every check with pass = true/false.

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

-- Two invited users, A and B.
insert into private.allowed_emails (email) values ('test-a@example.com'), ('test-b@example.com');
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

-- B's record, written as postgres.
insert into public.conditions (user_id, name) values ('00000000-0000-4000-8000-00000000000b', 'B condition');
insert into public.medications (user_id, name) values ('00000000-0000-4000-8000-00000000000b', 'B med');
insert into public.entries (user_id, kind, title, occurs_at)
  values ('00000000-0000-4000-8000-00000000000b', 'note', 'B note', now());
insert into public.care_team (user_id, name) values ('00000000-0000-4000-8000-00000000000b', 'B doctor');
insert into public.vitals (user_id, recorded_on, systolic) values ('00000000-0000-4000-8000-00000000000b', current_date, 120);
insert into public.share_sessions (patient_id, code, code_expires_at, share_conditions, share_recent_visits,
  share_full_timeline, share_care_team, share_mental_health, allow_notes, duration_kind)
  values ('00000000-0000-4000-8000-00000000000b', '1234', now() + interval '5 minutes',
          true, true, false, true, false, true, '30m');
insert into public.access_events (patient_id, actor, event)
  values ('00000000-0000-4000-8000-00000000000b', 'patient', 'code_generated');

-- A reads none of B's rows, in any table.
do $$
declare c_prof int; c_cond int; c_med int; c_ent int; c_ct int; c_vit int; c_ss int; c_ae int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  select count(*) into c_prof from public.profiles;
  select count(*) into c_cond from public.conditions;
  select count(*) into c_med from public.medications;
  select count(*) into c_ent from public.entries;
  select count(*) into c_ct from public.care_team;
  select count(*) into c_vit from public.vitals;
  select count(*) into c_ss from public.share_sessions;
  select count(*) into c_ae from public.access_events;
  perform pg_temp.logout();
  perform pg_temp.ok('A sees only their own profile', c_prof = 1, format('profiles=%s', c_prof));
  perform pg_temp.ok('A cannot read B''s rows in any record table',
    c_cond = 0 and c_med = 0 and c_ent = 0 and c_ct = 0 and c_vit = 0,
    format('conditions=%s medications=%s entries=%s care_team=%s vitals=%s', c_cond, c_med, c_ent, c_ct, c_vit));
  perform pg_temp.ok('A cannot read B''s share sessions or access events', c_ss = 0 and c_ae = 0,
    format('share_sessions=%s access_events=%s', c_ss, c_ae));
end $$;

-- A cannot change or delete B's rows (RLS filters them out: 0 rows affected).
do $$
declare n_upd int; n_del int; n_prof int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  update public.conditions set name = 'hacked' where user_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n_upd = row_count;
  delete from public.medications where user_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n_del = row_count;
  update public.profiles set first_name = 'hacked' where id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n_prof = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('A cannot update or delete B''s rows', n_upd = 0 and n_del = 0 and n_prof = 0,
    format('updated=%s deleted=%s profile_updated=%s', n_upd, n_del, n_prof));
end $$;

-- A cannot insert a row owned by B.
do $$
declare err text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  begin
    insert into public.conditions (user_id, name) values ('00000000-0000-4000-8000-00000000000b', 'planted');
    err := 'no error';
  exception when others then err := sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('A cannot insert a row into B''s record', err like '42501%', err);
end $$;

-- A can write their own rows; user_id defaults to the caller.
do $$
declare c int; mine boolean;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  insert into public.conditions (name) values ('A condition');
  insert into public.entries (kind, title, occurs_at) values ('note', 'A note', now());
  select count(*) into c from public.conditions;
  select bool_and(user_id = '00000000-0000-4000-8000-00000000000a') into mine from public.conditions;
  perform pg_temp.logout();
  perform pg_temp.ok('A can insert and read their own rows (user_id defaults to auth.uid())', c = 1 and mine,
    format('own conditions=%s', c));
end $$;

-- share_sessions and access_events are read-only even to their owner.
do $$
declare e1 text; e2 text; e3 text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000b');
  begin
    update public.share_sessions set status = 'active';
    e1 := 'no error';
  exception when others then e1 := sqlstate;
  end;
  begin
    insert into public.access_events (patient_id, actor, event)
      values ('00000000-0000-4000-8000-00000000000b', 'patient', 'approved');
    e2 := 'no error';
  exception when others then e2 := sqlstate;
  end;
  begin
    insert into public.share_sessions (patient_id, code, code_expires_at, share_conditions, share_recent_visits,
      share_full_timeline, share_care_team, share_mental_health, allow_notes, duration_kind)
    values ('00000000-0000-4000-8000-00000000000b', '9999', now(), true, true, true, true, true, true, 'manual');
    e3 := 'no error';
  exception when others then e3 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Owner cannot update share_sessions directly', e1 = '42501', e1);
  perform pg_temp.ok('Owner cannot insert access_events directly', e2 = '42501', e2);
  perform pg_temp.ok('Owner cannot insert share_sessions directly', e3 = '42501', e3);
end $$;

-- The browser cannot forge session notes or flip is_demo.
do $$
declare e1 text; e2 text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  begin
    insert into public.entries (kind, title, occurs_at, source) values ('session_notes', 'Fake', now(), 'clinician_session');
    e1 := 'no error';
  exception when others then e1 := sqlerrm;
  end;
  begin
    update public.profiles set is_demo = true where id = '00000000-0000-4000-8000-00000000000a';
    e2 := 'no error';
  exception when others then e2 := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Browser cannot insert a session_notes entry', e1 = 'session_notes_read_only', e1);
  perform pg_temp.ok('Browser cannot change profiles.is_demo', e2 = 'read_only_field', e2);
end $$;

-- The anon role (publishable key, no user) can read nothing.
do $$
declare t text; errs text := ''; denied int := 0;
begin
  foreach t in array array['profiles', 'conditions', 'medications', 'entries', 'care_team', 'vitals',
                           'share_sessions', 'access_events'] loop
    perform pg_temp.login_anon();
    begin
      execute format('select count(*) from public.%I', t);
      errs := errs || t || ':readable ';
    exception when insufficient_privilege then denied := denied + 1;
    end;
    perform pg_temp.logout();
  end loop;
  perform pg_temp.ok('anon has no access to any public table', denied = 8, coalesce(nullif(errs, ''), 'all 8 denied'));
end $$;

-- Neither API role can reach the private schema.
do $$
declare e1 text; e2 text;
begin
  perform pg_temp.login_anon();
  begin
    perform count(*) from private.allowed_emails;
    e1 := 'no error';
  exception when others then e1 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  begin
    perform count(*) from private.server_secrets;
    e2 := 'no error';
  exception when others then e2 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('anon and authenticated cannot read the private schema', e1 = '42501' and e2 = '42501',
    format('anon=%s authenticated=%s', e1, e2));
end $$;

-- export_my_data returns only the caller's rows.
do $$
declare j jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-00000000000a');
  j := public.export_my_data();
  perform pg_temp.logout();
  perform pg_temp.ok('export_my_data returns only the caller''s rows',
    jsonb_array_length(j -> 'conditions') = 1
    and j -> 'conditions' -> 0 ->> 'name' = 'A condition'
    and jsonb_array_length(j -> 'share_sessions') = 0
    and (j -> 'profile' ->> 'id') = '00000000-0000-4000-8000-00000000000a',
    format('conditions=%s entries=%s', jsonb_array_length(j -> 'conditions'), jsonb_array_length(j -> 'entries')));
end $$;

select n, test, pass, info from _results order by n;

rollback;
