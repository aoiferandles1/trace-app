-- Test: who may call what.
-- * Patient functions cannot be called with the publishable key alone (anon).
-- * Portal functions refuse a missing or wrong server secret, whoever calls.
-- * With the right secret, the anon role (the Next.js server) can call them.
-- * Private helpers are not callable by the API roles.
--
-- The real server-secret hash is swapped for the hash of a throwaway test
-- secret inside the transaction, and restored by the rollback.

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

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret-for-sql-tests', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into auth.users (id, is_anonymous, aud, role)
values ('00000000-0000-4000-8000-0000000000c1', true, 'authenticated', 'authenticated');

-- Execute privileges as declared.
do $$
declare
  f text;
  patient_fns text[] := array[
    'public.create_share_code(boolean,boolean,boolean,boolean,boolean,boolean,text,uuid)',
    'public.respond_to_request(uuid,boolean)', 'public.extend_session(integer)',
    'public.end_session()', 'public.my_share_session()', 'public.seed_demo_record()',
    'public.delete_my_account()', 'public.export_my_data()'];
  portal_fns text[] := array[
    'public.portal_submit_code(text,text,text,text,text,text,text)', 'public.portal_status(text,text)',
    'public.portal_cancel_request(text,text)', 'public.portal_get_record(text,text,text)',
    'public.portal_save_notes(text,text,text,text,text,text)', 'public.portal_end_session(text,text)',
    'public.cleanup_demo_users(text)'];
  bad text := '';
begin
  foreach f in array patient_fns loop
    if has_function_privilege('anon', f, 'execute') then bad := bad || 'anon:' || f || ' '; end if;
    if not has_function_privilege('authenticated', f, 'execute') then bad := bad || 'auth-missing:' || f || ' '; end if;
  end loop;
  perform pg_temp.ok('Patient functions: authenticated only, never anon', bad = '', coalesce(nullif(bad, ''), 'ok'));

  bad := '';
  foreach f in array portal_fns loop
    if not has_function_privilege('anon', f, 'execute') then bad := bad || 'anon-missing:' || f || ' '; end if;
    if has_function_privilege('public', f, 'execute') then bad := bad || 'public:' || f || ' '; end if;
  end loop;
  perform pg_temp.ok('Portal functions: granted to anon and not to PUBLIC', bad = '', coalesce(nullif(bad, ''), 'ok'));
end $$;

-- A patient function called with the publishable key alone is refused.
do $$
declare e1 text; e2 text;
begin
  perform pg_temp.login_anon();
  begin
    perform public.create_share_code();
    e1 := 'no error';
  exception when others then e1 := sqlstate;
  end;
  begin
    perform public.seed_demo_record();
    e2 := 'no error';
  exception when others then e2 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('anon cannot call create_share_code or seed_demo_record', e1 = '42501' and e2 = '42501',
    format('create_share_code=%s seed_demo_record=%s', e1, e2));
end $$;

-- Portal functions refuse a wrong or missing server secret, for every caller.
do $$
declare
  tok text := 'portal-token-0123456789-abcdefghijklmnop';
  errs text[] := '{}';
  e text;
  r text;
  roles text[] := array['anon', 'authenticated'];
begin
  foreach r in array roles loop
    if r = 'anon' then perform pg_temp.login_anon(); else perform pg_temp.login('00000000-0000-4000-8000-0000000000c1'); end if;
    begin perform public.portal_status('wrong-secret', tok); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.portal_submit_code('wrong-secret', tok, '1234', 'Dr X', 'GP', 'Practice', 'iphash'); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.portal_get_record(null, tok, 'overview'); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.portal_cancel_request('', tok); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.portal_save_notes('test-secret-for-sql-tests ', tok, 'a', 'b', 'c', 'd'); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.portal_end_session('TEST-SECRET-FOR-SQL-TESTS', tok); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    begin perform public.cleanup_demo_users('wrong-secret'); e := 'no error';
    exception when others then e := sqlerrm; end; errs := errs || e;
    perform pg_temp.logout();
  end loop;
  perform pg_temp.ok('Every portal function raises invalid_server_secret for a wrong, empty, null or near-miss secret',
    (select bool_and(x = 'invalid_server_secret') from unnest(errs) x), array_to_string(errs, ', '));
end $$;

-- With the right secret, anon (the server) gets a status and nothing else.
do $$
declare j jsonb; e text;
begin
  perform pg_temp.login_anon();
  j := public.portal_status('test-secret-for-sql-tests', 'portal-token-0123456789-abcdefghijklmnop');
  begin
    perform public.portal_status('test-secret-for-sql-tests', 'short');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('anon with the right secret can call portal_status (status none)', j ->> 'status' = 'none', j::text);
  perform pg_temp.ok('A portal token shorter than 32 characters is refused', e = 'invalid_portal_token', e);
end $$;

-- Private helpers cannot be called by the API roles.
do $$
declare e1 text; e2 text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000c1');
  begin
    perform private.advance_session(gen_random_uuid());
    e1 := 'no error';
  exception when others then e1 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  begin
    perform private.verify_server_secret('x');
    e2 := 'no error';
  exception when others then e2 := sqlstate;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Private helpers are not callable by authenticated or anon', e1 = '42501' and e2 = '42501',
    format('authenticated=%s anon=%s', e1, e2));
end $$;

-- Every security definer function in public and private pins search_path to ''.
select pg_temp.ok('Every security definer function has search_path = ''''',
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not coalesce(p.proconfig @> array['search_path=""'], false)),
  (select string_agg(n.nspname || '.' || p.proname, ', ')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)));

select n, test, pass, info from _results order by n;

rollback;
