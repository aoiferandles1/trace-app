-- Test: invite-only sign-up, the demo seed, account deletion and the daily cleanup.
--
-- Runs inside a transaction that rolls back. The test emails are on
-- example.com and only exist inside this transaction.

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
create function pg_temp.seed(uid uuid) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login(uid);
  j := public.seed_demo_record();
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.counts(uid uuid) returns text language sql as $$
  select format('conditions=%s medications=%s entries=%s care_team=%s vitals=%s sessions=%s events=%s',
    (select count(*) from public.conditions where user_id = uid),
    (select count(*) from public.medications where user_id = uid),
    (select count(*) from public.entries where user_id = uid),
    (select count(*) from public.care_team where user_id = uid),
    (select count(*) from public.vitals where user_id = uid),
    (select count(*) from public.share_sessions where patient_id = uid),
    (select count(*) from public.access_events where patient_id = uid))
$$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into private.allowed_emails (email) values ('invited@example.com');

-- 1. The invite trigger.
do $$
declare e text; demo boolean;
begin
  begin
    insert into auth.users (id, email, aud, role)
    values ('00000000-0000-4000-8000-000000000101', 'stranger@example.com', 'authenticated', 'authenticated');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.ok('The invite trigger refuses an uninvited email (invite_only)', e = 'invite_only', e);

  begin
    insert into auth.users (id, aud, role)
    values ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.ok('The invite trigger refuses a user with no email who is not anonymous', e = 'invite_only', e);

  insert into auth.users (id, email, aud, role)
  values ('00000000-0000-4000-8000-000000000103', 'Invited@Example.com', 'authenticated', 'authenticated');
  select is_demo into demo from public.profiles where id = '00000000-0000-4000-8000-000000000103';
  perform pg_temp.ok('An invited email is allowed (case-insensitive) and gets a profile with is_demo false',
    demo = false, format('is_demo=%s', demo));

  insert into auth.users (id, is_anonymous, aud, role)
  values ('00000000-0000-4000-8000-000000000104', true, 'authenticated', 'authenticated');
  select is_demo into demo from public.profiles where id = '00000000-0000-4000-8000-000000000104';
  perform pg_temp.ok('An anonymous user is allowed and gets a profile with is_demo true', demo = true,
    format('is_demo=%s', demo));
end $$;

-- 2. The demo cannot be turned into an uninvited permanent account.
do $$
declare e1 text; e2 text;
begin
  begin
    update auth.users set email = 'stranger@example.com', is_anonymous = false
     where id = '00000000-0000-4000-8000-000000000104';
    e1 := 'no error';
  exception when others then e1 := sqlerrm;
  end;
  begin
    update auth.users set email = 'stranger@example.com' where id = '00000000-0000-4000-8000-000000000103';
    e2 := 'no error';
  exception when others then e2 := sqlerrm;
  end;
  perform pg_temp.ok('Converting an anonymous user to an uninvited email is refused', e1 = 'invite_only', e1);
  perform pg_temp.ok('Changing a permanent account to an uninvited email is refused', e2 = 'invite_only', e2);
end $$;

-- 3. The seed refuses a non-anonymous caller and an unsigned caller.
do $$
declare e1 text; e2 text; c text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000103');
  begin
    perform public.seed_demo_record();
    e1 := 'no error';
  exception when others then e1 := sqlerrm;
  end;
  perform pg_temp.logout();
  c := pg_temp.counts('00000000-0000-4000-8000-000000000103');
  perform pg_temp.ok('seed_demo_record refuses a signed-in, non-anonymous user and writes nothing',
    e1 = 'not_anonymous' and c = 'conditions=0 medications=0 entries=0 care_team=0 vitals=0 sessions=0 events=0',
    e1 || ' / ' || c);
  perform pg_temp.login('00000000-0000-4000-8000-000000000103');
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.seed_demo_record();
    e2 := 'no error';
  exception when others then e2 := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('seed_demo_record refuses a call with no user id', e2 = 'not_signed_in', e2);
end $$;

-- 4. The seed fills Jane's record with dates relative to today.
do $$
declare j jsonb := pg_temp.seed('00000000-0000-4000-8000-000000000104');
        uid uuid := '00000000-0000-4000-8000-000000000104';
        d date := (now() at time zone 'Europe/Dublin')::date;
        p public.profiles; c text;
begin
  select * into p from public.profiles where id = uid;
  c := pg_temp.counts(uid);
  perform pg_temp.ok('Seed: the expected number of rows',
    c = 'conditions=3 medications=5 entries=7 care_team=4 vitals=1 sessions=0 events=0', c);
  perform pg_temp.ok('Seed: Jane Doe, born 12 March 1991, A+, Penicillin, onboarding done, demo',
    p.first_name = 'Jane' and p.last_name = 'Doe' and p.date_of_birth = '1991-03-12' and p.blood_type = 'A+'
    and p.allergies = array['Penicillin'] and p.onboarding_step = 'done' and p.is_demo,
    row_to_json(p)::text);
  perform pg_temp.ok('Seed: GP visit with Dr Hennessy today at 9:30 Irish time, returned as appointment_entry_id',
    exists (select 1 from public.entries e where e.id = (j ->> 'appointment_entry_id')::uuid and e.user_id = uid
              and e.kind = 'visit' and e.clinician = 'Dr Hennessy' and e.place = 'Rathmines Medical Centre'
              and e.occurs_at = ((d + time '09:30') at time zone 'Europe/Dublin')), j::text);
  perform pg_temp.ok('Seed: blood test 9 days ago, note 11, Warfarin renewal 12, cardiology review 43; two upcoming',
    (select string_agg(kind || '@' || ((occurs_at at time zone 'Europe/Dublin')::date - d), ',' order by occurs_at)
       from public.entries where user_id = uid)
      = 'visit@-43,prescription@-12,note@-11,result@-9,visit@0,visit@14,visit@48',
    (select string_agg(kind || '@' || ((occurs_at at time zone 'Europe/Dublin')::date - d), ',' order by occurs_at)
       from public.entries where user_id = uid));
  perform pg_temp.ok('Seed: corrected drug classes (Anticoagulant, Thyroid, Bronchodilator), 3 current, 2 expired',
    (select string_agg(name || ':' || drug_class, ',' order by created_at) from public.medications
      where user_id = uid and ended_on is null) = 'Warfarin:Anticoagulant,Levothyroxine:Thyroid,Salbutamol:Bronchodilator'
    and (select count(*) from public.medications where user_id = uid and ended_on < d and ended_on > d - 365) = 2,
    (select string_agg(name || ':' || drug_class, ',' order by created_at) from public.medications where user_id = uid));
  perform pg_temp.ok('Seed: Warfarin refill due in 8 days',
    (select refill_due_on - d from public.medications where user_id = uid and name = 'Warfarin') = 8, null);
end $$;

-- 5. Calling the seed again resets: same rows, and any live share is gone.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000104'; j jsonb; st jsonb; c text;
begin
  perform pg_temp.login(uid);
  insert into public.conditions (name) values ('Added by the visitor');
  j := public.create_share_code();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', 'reset-token-0123456789abcdefghijklmnop', j ->> 'code',
                                    'Dr Hennessy', 'GP', null, 'reset-ip');
  perform pg_temp.logout();
  perform pg_temp.seed(uid);
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'reset-token-0123456789abcdefghijklmnop');
  perform pg_temp.logout();
  c := pg_temp.counts(uid);
  perform pg_temp.ok('Reset demo: the record is back to the seed and the pending share is gone',
    c = 'conditions=3 medications=5 entries=7 care_team=4 vitals=1 sessions=0 events=0' and st ->> 'status' = 'none',
    c || ' / portal=' || (st ->> 'status'));
end $$;

-- 6. Two demo visitors get separate records.
do $$
declare a int; b int;
begin
  insert into auth.users (id, is_anonymous, aud, role)
  values ('00000000-0000-4000-8000-000000000105', true, 'authenticated', 'authenticated');
  perform pg_temp.seed('00000000-0000-4000-8000-000000000105');
  perform pg_temp.login('00000000-0000-4000-8000-000000000104');
  select count(*) into a from public.entries;
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-000000000105');
  select count(*) into b from public.entries;
  delete from public.entries;
  perform pg_temp.logout();
  perform pg_temp.ok('Two demo visitors each see only their own copy of Jane',
    a = 7 and b = 7 and (select count(*) from public.entries where user_id = '00000000-0000-4000-8000-000000000104') = 7,
    format('a=%s b=%s', a, b));
end $$;

-- 7. delete_my_account removes the user and everything they own.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000105'; c text;
begin
  perform pg_temp.seed(uid);
  perform pg_temp.login(uid);
  perform public.delete_my_account();
  perform pg_temp.logout();
  c := pg_temp.counts(uid);
  perform pg_temp.ok('delete_my_account deletes the auth user, profile and every row',
    not exists (select 1 from auth.users where id = uid) and not exists (select 1 from public.profiles where id = uid)
    and c = 'conditions=0 medications=0 entries=0 care_team=0 vitals=0 sessions=0 events=0', c);
end $$;

-- 8. cleanup_demo_users deletes anonymous users older than 24 hours, and nothing else.
do $$
declare r jsonb;
begin
  insert into auth.users (id, is_anonymous, aud, role, created_at) values
    ('00000000-0000-4000-8000-000000000106', true, 'authenticated', 'authenticated', now() - interval '25 hours');
  update auth.users set created_at = now() - interval '25 hours' where id = '00000000-0000-4000-8000-000000000103';
  perform pg_temp.seed('00000000-0000-4000-8000-000000000106');
  insert into private.portal_attempts (portal_token_hash, ip_hash, ok, result, at)
  values ('old', 'old', false, 'wrong', now() - interval '2 days');
  perform pg_temp.login_anon();
  r := public.cleanup_demo_users('test-secret');
  perform pg_temp.logout();
  perform pg_temp.ok('cleanup_demo_users deletes old anonymous users with their data, keeps recent and real ones',
    not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000106')
    and not exists (select 1 from public.entries where user_id = '00000000-0000-4000-8000-000000000106')
    and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000104')
    and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000103')
    and not exists (select 1 from private.portal_attempts where portal_token_hash = 'old')
    and (r ->> 'deleted_users')::int >= 1, r::text);
end $$;

-- 9. export_my_data has every part.
do $$
declare j jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000104');
  j := public.export_my_data();
  perform pg_temp.logout();
  perform pg_temp.ok('export_my_data returns every table the user owns',
    (select array_agg(k order by k) from jsonb_object_keys(j) k) =
      array['access_events', 'care_team', 'conditions', 'entries', 'exported_at', 'medications', 'profile',
            'share_sessions', 'user_id', 'vitals']
    and jsonb_array_length(j -> 'entries') = 7 and j -> 'profile' ->> 'first_name' = 'Jane',
    (select string_agg(k, ',') from jsonb_object_keys(j) k));
end $$;

select n, test, pass, info from _results order by n;

rollback;
