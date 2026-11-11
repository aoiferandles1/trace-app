-- Test: time moves a session through expired, paused and ended.
-- Time is simulated by moving the session's timestamps into the past (as
-- postgres), never by waiting. Transitions are lazy: the next function call
-- from either side applies them.
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

-- Patient helpers (each switches to the patient and back).
create function pg_temp.p_create(uid uuid, dur text default '30m') returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login(uid);
  perform public.end_session();
  j := public.create_share_code(duration_kind => dur);
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.p_call(uid uuid, what text, arg int default null) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login(uid);
  if what = 'status' then j := public.my_share_session();
  elsif what = 'extend' then j := public.extend_session(arg);
  elsif what = 'end' then j := public.end_session();
  end if;
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.p_allow(uid uuid, sid uuid) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login(uid);
  j := public.respond_to_request(sid, true);
  perform pg_temp.logout();
  return j;
end $$;
-- Portal helpers.
create function pg_temp.d_submit(tok text, code text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login_anon();
  j := public.portal_submit_code('test-secret', tok, code, 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'time-ip');
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.d_status(tok text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login_anon();
  j := public.portal_status('test-secret', tok);
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.d_record(tok text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login_anon();
  j := public.portal_get_record('test-secret', tok, 'overview');
  perform pg_temp.logout();
  return j;
end $$;
create function pg_temp.d_notes(tok text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.login_anon();
  j := public.portal_save_notes('test-secret', tok, 'Fatigue', 'Stable', 'Bloods', '2 weeks');
  perform pg_temp.logout();
  return j;
end $$;
-- Open an active session for a fresh portal token; returns the session id.
create function pg_temp.open_active(uid uuid, tok text, dur text default '30m') returns uuid language plpgsql as $$
declare j jsonb;
begin
  j := pg_temp.p_create(uid, dur);
  perform pg_temp.d_submit(tok, j ->> 'code');
  perform pg_temp.p_allow(uid, (j ->> 'id')::uuid);
  return (j ->> 'id')::uuid;
end $$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into auth.users (id, is_anonymous, aud, role)
values ('00000000-0000-4000-8000-0000000000f1', true, 'authenticated', 'authenticated');

do $$
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000f1');
  perform public.seed_demo_record();
  perform pg_temp.logout();
end $$;

-- 1. code_issued -> expired after 5 minutes.
do $$
declare j jsonb := pg_temp.p_create('00000000-0000-4000-8000-0000000000f1'); s jsonb; ev int;
begin
  update public.share_sessions set code_expires_at = now() - interval '1 second' where id = (j ->> 'id')::uuid;
  s := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'status');
  select count(*) into ev from public.access_events where session_id = (j ->> 'id')::uuid and event = 'expired';
  perform pg_temp.ok('An unused code expires after 5 minutes (seen on the patient''s next call, logged)',
    s ->> 'status' = 'expired' and ev = 1, format('%s events=%s', s ->> 'status', ev));
end $$;

-- 2. requested -> expired after 5 minutes with no answer.
do $$
declare j jsonb := pg_temp.p_create('00000000-0000-4000-8000-0000000000f1'); st jsonb; e text;
begin
  perform pg_temp.d_submit('time-token-req-0123456789abcdefghijkl', j ->> 'code');
  update public.share_sessions set request_expires_at = now() - interval '1 second' where id = (j ->> 'id')::uuid;
  st := pg_temp.d_status('time-token-req-0123456789abcdefghijkl');
  begin
    perform pg_temp.p_allow('00000000-0000-4000-8000-0000000000f1', (j ->> 'id')::uuid);
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('An unanswered request expires after 5 minutes: the portal sees expired',
    st ->> 'status' = 'expired' and st -> 'request_expires_at' = 'null'::jsonb, st::text);
  perform pg_temp.ok('Allowing an expired request raises not_requested', e = 'not_requested', e);
end $$;

-- 3. active -> paused when the timer runs out; the record closes.
do $$
declare sid uuid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-pause-0123456789abcdefghij');
        st jsonb; rec jsonb; p jsonb; saved jsonb;
begin
  perform pg_temp.d_notes('time-token-pause-0123456789abcdefghij');
  update public.share_sessions set expires_at = now() - interval '1 second' where id = sid;
  st := pg_temp.d_status('time-token-pause-0123456789abcdefghij');
  rec := pg_temp.d_record('time-token-pause-0123456789abcdefghij');
  p := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'status');
  saved := pg_temp.d_notes('time-token-pause-0123456789abcdefghij');
  perform pg_temp.ok('When expires_at passes the portal sees paused, with closes_at 30 minutes after',
    st ->> 'status' = 'paused' and (st ->> 'closes_at')::timestamptz = (st ->> 'paused_at')::timestamptz + interval '30 minutes'
    and st -> 'scope' = 'null'::jsonb and st -> 'notes' = 'null'::jsonb, st::text);
  perform pg_temp.ok('portal_get_record returns null while paused', rec is null, coalesce(rec::text, 'null'));
  perform pg_temp.ok('The patient sees paused with closes_at', p ->> 'status' = 'paused' and p -> 'closes_at' <> 'null'::jsonb,
    p ->> 'status');
  perform pg_temp.ok('The doctor can still save notes while paused', saved ? 'saved_at', saved::text);

  -- 4. paused -> active when the patient adds 15 minutes.
  p := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'extend', 15);
  st := pg_temp.d_status('time-token-pause-0123456789abcdefghij');
  rec := pg_temp.d_record('time-token-pause-0123456789abcdefghij');
  perform pg_temp.ok('Adding 15 minutes from paused reactivates for 15 minutes and the record comes back',
    p ->> 'status' = 'active'
    and (p ->> 'expires_at')::timestamptz between now() + interval '14 minutes 59 seconds' and now() + interval '15 minutes 1 second'
    and st ->> 'status' = 'active' and rec -> 'patient' ->> 'first_name' = 'Jane', p ->> 'expires_at');

  -- 5. Extending while active adds to the current expiry.
  update public.share_sessions set expires_at = now() + interval '10 minutes' where id = sid;
  p := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'extend', 30);
  perform pg_temp.ok('Adding 30 minutes while active extends the current expiry',
    (p ->> 'expires_at')::timestamptz between now() + interval '39 minutes 59 seconds' and now() + interval '40 minutes 1 second',
    p ->> 'expires_at');

  -- 6. paused -> ended after 30 minutes with no decision; notes still reach the record.
  update public.share_sessions set expires_at = now() - interval '31 minutes' where id = sid;
  st := pg_temp.d_status('time-token-pause-0123456789abcdefghij');
  rec := pg_temp.d_record('time-token-pause-0123456789abcdefghij');
  perform pg_temp.ok('Paused for 30 minutes with no decision ends the session (ended_by timeout), notes saved',
    st ->> 'status' = 'ended' and st ->> 'ended_by' = 'timeout' and st ->> 'notes_saved_to_record' = 'true'
    and (st ->> 'ended_at')::timestamptz = now() - interval '1 minute' and rec is null, st::text);
  perform pg_temp.ok('The timed-out session logged paused, then notes_saved and ended',
    (select string_agg(event, ',' order by id) from public.access_events
      where session_id = sid and event in ('paused', 'extended', 'notes_saved', 'ended'))
      = 'paused,extended,extended,paused,notes_saved,ended',
    (select string_agg(event, ',' order by id) from public.access_events where session_id = sid));
end $$;

-- 7. Patient taps Save and end while paused.
do $$
declare sid uuid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-saveend-0123456789abcdefgh');
        e jsonb; st jsonb;
begin
  update public.share_sessions set expires_at = now() - interval '1 minute' where id = sid;
  e := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'end');
  st := pg_temp.d_status('time-token-saveend-0123456789abcdefgh');
  perform pg_temp.ok('Save and end from paused: ended by patient on both sides',
    e ->> 'status' = 'ended' and e ->> 'ended_by' = 'patient' and st ->> 'status' = 'ended' and st ->> 'ended_by' = 'patient',
    st::text);
end $$;

-- 8. Durations.
do $$
declare sid uuid; s record;
begin
  sid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-1h-0123456789abcdefghijklm', '1h');
  select expires_at, approved_at into s from public.share_sessions where id = sid;
  perform pg_temp.ok('1h: expires an hour after Allow', s.expires_at = s.approved_at + interval '1 hour', s.expires_at::text);
  perform pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'end');

  sid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-day-0123456789abcdefghijkl', 'all_day');
  select expires_at into s from public.share_sessions where id = sid;
  perform pg_temp.ok('all_day: expires at 23:59 today, Irish time',
    s.expires_at = (((now() at time zone 'Europe/Dublin')::date + time '23:59') at time zone 'Europe/Dublin'),
    s.expires_at::text);
  perform pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'end');

  sid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-man-0123456789abcdefghijkl', 'manual');
  select expires_at, approved_at into s from public.share_sessions where id = sid;
  perform pg_temp.ok('manual: capped at 12 hours after Allow', s.expires_at = s.approved_at + interval '12 hours',
    s.expires_at::text);
  perform pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'end');
end $$;

-- 9. The 12-hour cap applies to extensions too.
do $$
declare sid uuid := pg_temp.open_active('00000000-0000-4000-8000-0000000000f1', 'time-token-cap-0123456789abcdefghijkl');
        p jsonb; e text; ap timestamptz;
begin
  update public.share_sessions set approved_at = now() - interval '11 hours 50 minutes', expires_at = now() + interval '5 minutes'
   where id = sid;
  p := pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'extend', 30);
  select approved_at into ap from public.share_sessions where id = sid;
  perform pg_temp.ok('An extension never runs past 12 hours after Allow',
    (p ->> 'expires_at')::timestamptz = ap + interval '12 hours', p ->> 'expires_at');
  update public.share_sessions set approved_at = now() - interval '12 hours 5 minutes', expires_at = now() - interval '5 minutes'
   where id = sid;
  begin
    perform pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'extend', 15);
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Past 12 hours, extending raises session_limit_reached', e = 'session_limit_reached', e);
  begin
    perform pg_temp.p_call('00000000-0000-4000-8000-0000000000f1', 'extend', 20);
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('Only 15 or 30 minutes can be added', e = 'invalid_minutes', e);
end $$;

select n, test, pass, info from _results order by n;

rollback;
