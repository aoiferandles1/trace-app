-- Test: the share loop from both sides, and what the portal learns in each state.
-- * A correct code only creates a request; no portal response carries any
--   patient data until the patient taps Allow.
-- * portal_get_record returns nothing unless the session is active.
-- * Allow, Deny, doctor cancel, patient regenerate, patient end, doctor end.
-- * Wrong / expired / locked codes, and the per-IP cap.
--
-- Runs inside a transaction that rolls back. The server-secret hash is swapped
-- for a throwaway test secret's hash, restored by the rollback.

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
-- True if a JSON value mentions anything from Jane's record.
create function pg_temp.leaks(j jsonb) returns boolean language sql as $$
  select coalesce(j::text, '') ~* '(jane|doe|penicillin|"A\+"|1991|warfarin|fibrillation|rathmines, dublin)'
$$;
-- A 4-digit code that no session uses.
create function pg_temp.unused_code() returns text language sql as $$
  select c from (select lpad(i::text, 4, '0') c from generate_series(0, 9999) i) x
   where c not in (select code from public.share_sessions) order by c limit 1
$$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

-- Patient P (anonymous demo user, seeded as Jane) and a second user Q.
insert into auth.users (id, is_anonymous, aud, role) values
  ('00000000-0000-4000-8000-0000000000d1', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', true, 'authenticated', 'authenticated');

do $$
declare j jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.seed_demo_record();
  perform pg_temp.logout();
  perform pg_temp.put('appt', j ->> 'appointment_entry_id');
end $$;

-- 1. Patient generates a code.
do $$
declare j jsonb; appt uuid := pg_temp.get('appt')::uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.create_share_code(appointment_entry_id => appt);
  perform pg_temp.logout();
  perform pg_temp.put('s1', j ->> 'id');
  perform pg_temp.put('code1', j ->> 'code');
  perform pg_temp.ok('create_share_code returns a code_issued session with a 4-digit code and a 5-minute expiry',
    j ->> 'status' = 'code_issued' and j ->> 'code' ~ '^[0-9]{4}$'
    and (j ->> 'code_expires_at')::timestamptz between now() + interval '4 minutes 59 seconds' and now() + interval '5 minutes 1 second'
    and not (j ? 'portal_token_hash') and j ->> 'share_mental_health' = 'false',
    j::text);
end $$;

-- 2. A portal with no session gets nothing.
do $$
declare r jsonb;
begin
  perform pg_temp.login_anon();
  r := public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform pg_temp.logout();
  perform pg_temp.ok('portal_get_record with no session returns null', r is null, coalesce(r::text, 'null'));
end $$;

-- 3. A wrong code.
do $$
declare r jsonb; wrong text := pg_temp.unused_code();
begin
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-one-0123456789abcdefghij', wrong,
                                 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ip-hash-1');
  perform pg_temp.logout();
  perform pg_temp.ok('A wrong code returns result wrong with 4 attempts left',
    r ->> 'result' = 'wrong' and (r ->> 'attempts_left')::int = 4 and r -> 'locked_until' = 'null'::jsonb, r::text);
end $$;

-- 4. The correct code creates a request and returns no patient data.
do $$
declare r jsonb; st jsonb; rec jsonb; code1 text := pg_temp.get('code1');
begin
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-one-0123456789abcdefghij', code1,
                                 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ip-hash-1');
  st := public.portal_status('test-secret', 'doctor-token-one-0123456789abcdefghij');
  rec := public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform pg_temp.logout();
  perform pg_temp.ok('The correct code returns result requested and only the four documented keys',
    r ->> 'result' = 'requested'
    and (select array_agg(k order by k) from jsonb_object_keys(r) k)
        = array['attempts_left', 'locked_until', 'request_expires_at', 'result'],
    r::text);
  perform pg_temp.ok('No patient data in the submit response or in portal_status while requested',
    not pg_temp.leaks(r) and not pg_temp.leaks(st) and st ->> 'status' = 'requested'
    and st -> 'scope' = 'null'::jsonb and st -> 'notes' = 'null'::jsonb, st::text);
  perform pg_temp.ok('portal_get_record returns null while the request waits for the patient', rec is null,
    coalesce(rec::text, 'null'));
end $$;

-- 5. The patient sees who is asking (through RLS on their own row).
do $$
declare s1 uuid := pg_temp.get('s1')::uuid; st text; nm text; pr text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  select status, clinician_name, clinician_practice into st, nm, pr from public.share_sessions where id = s1;
  perform pg_temp.logout();
  perform pg_temp.ok('The patient reads the request: status requested, the typed name and practice',
    st = 'requested' and nm = 'Dr Hennessy' and pr = 'Rathmines Medical Centre', format('%s %s %s', st, nm, pr));
end $$;

-- 6. Another portal typing the same code gets "wrong"; the first portal cannot submit again.
do $$
declare r jsonb; e text; code1 text := pg_temp.get('code1');
begin
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-two-0123456789abcdefghij', code1,
                                 'Dr Other', null, null, 'ip-hash-2');
  begin
    perform public.portal_submit_code('test-secret', 'doctor-token-one-0123456789abcdefghij', '0000',
                                      'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ip-hash-1');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('A code already requested is "wrong" to a second portal', r ->> 'result' = 'wrong', r::text);
  perform pg_temp.ok('A portal with a pending request cannot submit another code (portal_busy)', e = 'portal_busy', e);
end $$;

-- 7. Another user cannot answer P's request.
do $$
declare e text; s1 uuid := pg_temp.get('s1')::uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d2');
  begin
    perform public.respond_to_request(s1, true);
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('respond_to_request on someone else''s session raises not_found', e = 'not_found', e);
end $$;

-- 8. Allow: the session becomes active and the record opens.
do $$
declare j jsonb; st jsonb; rec jsonb; s1 uuid := pg_temp.get('s1')::uuid; n_views int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.respond_to_request(s1, true);
  perform pg_temp.logout();
  perform pg_temp.ok('Allow makes the session active for 30 minutes',
    j ->> 'status' = 'active'
    and (j ->> 'expires_at')::timestamptz between now() + interval '29 minutes 59 seconds' and now() + interval '30 minutes 1 second',
    j::text);

  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'doctor-token-one-0123456789abcdefghij');
  rec := public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform pg_temp.logout();
  perform pg_temp.ok('portal_status while active: expires_at, scope and allow_notes, still no record data',
    st ->> 'status' = 'active' and st -> 'expires_at' <> 'null'::jsonb and st -> 'scope' ->> 'conditions' = 'true'
    and st ->> 'allow_notes' = 'true' and not pg_temp.leaks(st), st::text);
  perform pg_temp.ok('portal_get_record returns the record once active',
    rec -> 'patient' ->> 'first_name' = 'Jane' and rec -> 'critical' ->> 'blood_type' = 'A+'
    and rec -> 'critical' -> 'allergies' = '["Penicillin"]'::jsonb, (rec -> 'patient')::text);
  select count(*) into n_views from public.access_events
   where session_id = s1 and event = 'section_viewed' and detail ->> 'section' = 'overview';
  perform pg_temp.ok('Viewing a section logs one section_viewed event (repeat views within 30s are not re-logged)',
    n_views = 1, format('section_viewed overview=%s', n_views));
end $$;

-- 9. The patient cannot start a second share while one is live.
do $$
declare e text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  begin
    perform public.create_share_code();
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.logout();
  perform pg_temp.ok('create_share_code while a session is active raises session_live', e = 'session_live', e);
end $$;

-- 10. Doctor saves notes and ends the session: notes reach the record, access closes.
do $$
declare sv jsonb; st jsonb; rec jsonb; s1 uuid := pg_temp.get('s1')::uuid; ent record; evs text;
begin
  perform pg_temp.login_anon();
  sv := public.portal_save_notes('test-secret', 'doctor-token-one-0123456789abcdefghij',
                                 'Annual review. Ongoing fatigue.', 'Stable AF.', 'Repeat INR.', '2 weeks');
  st := public.portal_end_session('test-secret', 'doctor-token-one-0123456789abcdefghij');
  rec := public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform pg_temp.logout();
  perform pg_temp.ok('portal_save_notes returns saved_at', sv ? 'saved_at' and sv -> 'saved_at' <> 'null'::jsonb, sv::text);
  perform pg_temp.ok('portal_end_session returns status ended, ended_by clinician, notes saved to record',
    st ->> 'status' = 'ended' and st ->> 'ended_by' = 'clinician' and st ->> 'notes_saved_to_record' = 'true'
    and not pg_temp.leaks(st), st::text);
  perform pg_temp.ok('portal_get_record returns null after the doctor ends', rec is null, coalesce(rec::text, 'null'));

  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  select kind, source, clinician, detail into ent from public.entries where session_id = s1;
  select string_agg(event, ',' order by id) into evs from public.access_events where session_id = s1;
  perform pg_temp.logout();
  perform pg_temp.ok('The notes are one session_notes entry on the patient''s record, with the clinician',
    ent.kind = 'session_notes' and ent.source = 'clinician_session' and ent.clinician = 'Dr Hennessy'
    and ent.detail ->> 'plan' = 'Repeat INR.', row_to_json(ent)::text);
  perform pg_temp.ok('The access log has the whole story in order',
    evs = 'code_generated,requested,approved,section_viewed,notes_saved,ended', evs);
end $$;

-- 11. Deny: the portal learns "denied" and gets nothing.
do $$
declare j jsonb; r jsonb; st jsonb; rec jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.create_share_code();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-one-0123456789abcdefghij', j ->> 'code',
                                 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ip-hash-1');
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  perform public.respond_to_request((j ->> 'id')::uuid, false);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'doctor-token-one-0123456789abcdefghij');
  rec := public.portal_get_record('test-secret', 'doctor-token-one-0123456789abcdefghij', 'overview');
  perform pg_temp.logout();
  perform pg_temp.ok('Deny: portal_status says denied and portal_get_record returns null',
    r ->> 'result' = 'requested' and st ->> 'status' = 'denied' and rec is null and not pg_temp.leaks(st), st::text);
end $$;

-- 12. Doctor cancels: the patient keeps the code, and it still works.
do $$
declare j jsonb; c jsonb; st_after text; nm text; r2 jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.create_share_code();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', 'doctor-token-one-0123456789abcdefghij', j ->> 'code',
                                    'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ip-hash-1');
  c := public.portal_cancel_request('test-secret', 'doctor-token-one-0123456789abcdefghij');
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  select status, clinician_name into st_after, nm from public.share_sessions where id = (j ->> 'id')::uuid;
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  r2 := public.portal_submit_code('test-secret', 'doctor-token-two-0123456789abcdefghij', j ->> 'code',
                                  'Dr Second', null, null, 'ip-hash-2');
  perform pg_temp.logout();
  perform pg_temp.ok('Doctor cancel: portal goes back to none; session back to code_issued with the name cleared',
    c ->> 'status' = 'none' and st_after = 'code_issued' and nm is null, format('%s %s %s', c ->> 'status', st_after, nm));
  perform pg_temp.ok('After a cancel the same code still works for a portal', r2 ->> 'result' = 'requested', r2::text);
  perform pg_temp.put('s_cancel', j ->> 'id');
end $$;

-- 13. Patient regenerates while a request waits: the old session is cancelled.
do $$
declare j jsonb; st jsonb; old_status text; s_cancel uuid := pg_temp.get('s_cancel')::uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  perform public.create_share_code();
  select status into old_status from public.share_sessions where id = s_cancel;
  j := public.my_share_session();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'doctor-token-two-0123456789abcdefghij');
  perform pg_temp.logout();
  perform pg_temp.ok('Regenerating cancels the waiting request; that portal sees cancelled',
    old_status = 'cancelled' and st ->> 'status' = 'cancelled' and j ->> 'status' = 'code_issued',
    format('old=%s portal=%s new=%s', old_status, st ->> 'status', j ->> 'status'));
  perform pg_temp.put('code_live', j ->> 'code');
end $$;

-- 14. Patient ends early: the portal sees ended on its next status call and loses the record.
do $$
declare r jsonb; st jsonb; rec_before jsonb; rec_after jsonb; e jsonb; s uuid; live text := pg_temp.get('code_live');
begin
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-three-0123456789abcdefgh', live,
                                 'Dr Three', 'GP', null, 'ip-hash-3');
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  s := (public.my_share_session() ->> 'id')::uuid;
  perform public.respond_to_request(s, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  rec_before := public.portal_get_record('test-secret', 'doctor-token-three-0123456789abcdefgh', 'medications');
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  e := public.end_session();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'doctor-token-three-0123456789abcdefgh');
  rec_after := public.portal_get_record('test-secret', 'doctor-token-three-0123456789abcdefgh', 'medications');
  perform pg_temp.logout();
  perform pg_temp.ok('Patient ends early: status ended by patient, record null on the next call',
    rec_before is not null and e ->> 'status' = 'ended' and st ->> 'status' = 'ended'
    and st ->> 'ended_by' = 'patient' and rec_after is null and st ->> 'notes_saved_to_record' = 'false',
    st::text);
end $$;

-- 15. Expired code: "expired", not "wrong".
do $$
declare j jsonb; r jsonb;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.create_share_code();
  perform pg_temp.logout();
  update public.share_sessions set code_expires_at = now() - interval '1 minute' where id = (j ->> 'id')::uuid;
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-four-0123456789abcdefghi', j ->> 'code',
                                 'Dr Four', null, null, 'ip-hash-4');
  perform pg_temp.logout();
  perform pg_temp.ok('A code that expired in the last 30 minutes returns result expired', r ->> 'result' = 'expired', r::text);
  update public.share_sessions set code_expires_at = now() - interval '31 minutes' where id = (j ->> 'id')::uuid;
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-four-0123456789abcdefghi', j ->> 'code',
                                 'Dr Four', null, null, 'ip-hash-4');
  perform pg_temp.logout();
  perform pg_temp.ok('A code that expired more than 30 minutes ago returns wrong', r ->> 'result' = 'wrong', r::text);
end $$;

-- 16. Five wrong codes lock the portal token for 15 minutes; even the right code is refused.
do $$
declare r jsonb; i int; j jsonb; last_wrong jsonb; st text; c text;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d1');
  j := public.create_share_code();
  perform pg_temp.logout();
  for i in 1..5 loop
    c := pg_temp.unused_code();
    perform pg_temp.login_anon();
    last_wrong := public.portal_submit_code('test-secret', 'doctor-token-five-0123456789abcdefghi', c,
                                            'Dr Five', null, null, 'ip-hash-5');
    perform pg_temp.logout();
  end loop;
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-five-0123456789abcdefghi', j ->> 'code',
                                 'Dr Five', null, null, 'ip-hash-5');
  perform pg_temp.logout();
  select status into st from public.share_sessions where id = (j ->> 'id')::uuid;
  perform pg_temp.ok('The fifth wrong code returns attempts_left 0 and locked_until about 15 minutes ahead',
    last_wrong ->> 'result' = 'wrong' and (last_wrong ->> 'attempts_left')::int = 0
    and (last_wrong ->> 'locked_until')::timestamptz between now() + interval '14 minutes 59 seconds' and now() + interval '15 minutes 1 second',
    last_wrong::text);
  perform pg_temp.ok('While locked, even the correct code returns locked and creates no request',
    r ->> 'result' = 'locked' and st = 'code_issued', format('%s session=%s', r::text, st));
  -- Move the attempts 16 minutes into the past: the lock lifts.
  update private.portal_attempts set at = at - interval '16 minutes'
   where portal_token_hash = encode(sha256(convert_to('doctor-token-five-0123456789abcdefghi', 'UTF8')), 'hex');
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'doctor-token-five-0123456789abcdefghi', j ->> 'code',
                                 'Dr Five', null, null, 'ip-hash-5');
  perform pg_temp.logout();
  perform pg_temp.ok('After 15 minutes the lock lifts and the correct code works', r ->> 'result' = 'requested', r::text);
end $$;

-- 17. One IP hash may make 20 attempts an hour, across any number of tokens.
do $$
declare r jsonb; i int; c text;
begin
  for i in 1..20 loop
    c := pg_temp.unused_code();
    perform pg_temp.login_anon();
    perform public.portal_submit_code('test-secret', 'ip-cap-token-' || lpad(i::text, 3, '0') || '-0123456789abcdefghijk',
                                      c, 'Dr Cap', null, null, 'ip-hash-cap');
    perform pg_temp.logout();
  end loop;
  perform pg_temp.login_anon();
  r := public.portal_submit_code('test-secret', 'ip-cap-token-new-0123456789abcdefghijklm', '0000',
                                 'Dr Cap', null, null, 'ip-hash-cap');
  perform pg_temp.logout();
  perform pg_temp.ok('The 21st attempt from one IP hash within an hour is locked',
    r ->> 'result' = 'locked' and r -> 'locked_until' <> 'null'::jsonb, r::text);
end $$;

-- 18. Notes are refused when the patient did not allow them, and nothing is written.
do $$
declare j jsonb; e text; st jsonb; n int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d2');
  perform public.end_session();
  j := public.create_share_code(allow_notes => false);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', 'doctor-token-six-0123456789abcdefghijk', j ->> 'code',
                                    'Dr Six', null, null, 'ip-hash-6');
  perform pg_temp.logout();
  perform pg_temp.login('00000000-0000-4000-8000-0000000000d2');
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  st := public.portal_status('test-secret', 'doctor-token-six-0123456789abcdefghijk');
  begin
    perform public.portal_save_notes('test-secret', 'doctor-token-six-0123456789abcdefghijk', 'x', 'x', 'x', 'x');
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform public.portal_end_session('test-secret', 'doctor-token-six-0123456789abcdefghijk');
  perform pg_temp.logout();
  select count(*) into n from public.entries where session_id = (j ->> 'id')::uuid;
  perform pg_temp.ok('With notes off: status has allow_notes false and notes null; saving raises notes_not_allowed',
    st ->> 'allow_notes' = 'false' and st -> 'notes' = 'null'::jsonb and e = 'notes_not_allowed' and n = 0,
    format('%s, entries=%s', e, n));
end $$;

select n, test, pass, info from _results order by n;

rollback;
