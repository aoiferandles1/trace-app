-- Test: documents (owner's decision: stored in the database).
-- * Upload accepts PDF, JPEG and PNG, checked by leading bytes; refuses a
--   wrong declared type, bytes of another type, bad base64, a file over 3 MB
--   and a file over the account's cap (bytes or count).
-- * The bytes table itself refuses bytes that do not match the declared type,
--   even when written directly as the database owner.
-- * The browser cannot insert documents, reach the bytes, or change a file's
--   type or size; one account cannot read or delete another's documents.
-- * portal_get_document returns one file only while the session is active
--   and Documents was granted (and Mental health, for a flagged file); it
--   returns nothing for another patient's file or after the session ends,
--   and logs document_viewed.
-- * Deleting a document deletes its bytes.
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
-- A file of n bytes that starts with the given magic bytes.
create function pg_temp.file(magic bytea, n int) returns text language sql as $$
  select encode(magic || decode(repeat('00', greatest(n - octet_length(magic), 0)), 'hex'), 'base64')
$$;
-- Upload as a user; returns the document json or the error message.
create function pg_temp.up(uid uuid, title text, ctype text, b64 text, mh boolean default false) returns text
language plpgsql as $$
declare r text;
begin
  perform pg_temp.login(uid);
  begin
    r := public.upload_document(title, ctype, b64, null, mh)::text;
  exception when others then r := sqlerrm;
  end;
  perform pg_temp.logout();
  return r;
end $$;

insert into private.server_secrets (name, sha256_hex)
values ('portal', encode(sha256(convert_to('test-secret', 'UTF8')), 'hex'))
on conflict (name) do update set sha256_hex = excluded.sha256_hex;

insert into auth.users (id, is_anonymous, aud, role) values
  ('00000000-0000-4000-8000-000000000901', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000902', true, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000903', true, 'authenticated', 'authenticated');

-- 1. Uploads that are accepted, and the file comes back byte for byte.
do $$
declare a text; b text; c text; f jsonb; pdf text := encode(convert_to('%PDF-1.7 a small letter', 'UTF8'), 'base64');
begin
  a := pg_temp.up('00000000-0000-4000-8000-000000000901', 'Discharge letter', 'application/pdf', pdf);
  b := pg_temp.up('00000000-0000-4000-8000-000000000901', 'Rash photo', 'image/jpeg', pg_temp.file('\xffd8ffe0'::bytea, 64));
  c := pg_temp.up('00000000-0000-4000-8000-000000000901', 'Therapy plan', 'image/png',
                  pg_temp.file('\x89504e470d0a1a0a'::bytea, 32), true);
  perform pg_temp.put('pdf', (a::jsonb) ->> 'id');
  perform pg_temp.put('mh', (c::jsonb) ->> 'id');
  perform pg_temp.login('00000000-0000-4000-8000-000000000901');
  f := public.my_document_file(((a::jsonb) ->> 'id')::uuid);
  perform pg_temp.logout();
  perform pg_temp.ok('PDF, JPEG and PNG uploads are accepted with their size',
    (a::jsonb) ->> 'content_type' = 'application/pdf' and (b::jsonb) ->> 'byte_size' = '64'
    and (c::jsonb) ->> 'is_mental_health' = 'true', a || ' / ' || b || ' / ' || c);
  perform pg_temp.ok('my_document_file returns the same bytes, base64 without line breaks',
    f ->> 'data_base64' = pdf and f ->> 'content_type' = 'application/pdf' and f ->> 'title' = 'Discharge letter',
    f::text);
end $$;

-- 2. Refusals.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000902'; e1 text; e2 text; e3 text; e4 text; e5 text; e6 text;
begin
  e1 := pg_temp.up(uid, 'Gif', 'image/gif', pg_temp.file('\x47494638'::bytea, 16));
  e2 := pg_temp.up(uid, 'Script', 'application/pdf', encode(convert_to('<html><script>', 'UTF8'), 'base64'));
  e3 := pg_temp.up(uid, 'Renamed', 'image/png', encode(convert_to('%PDF-1.4 x', 'UTF8'), 'base64'));
  e4 := pg_temp.up(uid, 'Bad', 'application/pdf', '***not base64***');
  e5 := pg_temp.up(uid, 'Huge', 'application/pdf', pg_temp.file('\x255044462d'::bytea, 3145729));
  e6 := pg_temp.up(uid, '', 'application/pdf', encode(convert_to('%PDF-1.4 x', 'UTF8'), 'base64'));
  perform pg_temp.ok('A type that is not PDF, JPEG or PNG is refused (invalid_type)', e1 = 'invalid_type', e1);
  perform pg_temp.ok('Bytes that are not a PDF, JPEG or PNG are refused whatever the declared type (invalid_type)',
    e2 = 'invalid_type', e2);
  perform pg_temp.ok('A PDF declared as a PNG is refused (type_mismatch)', e3 = 'type_mismatch', e3);
  perform pg_temp.ok('Data that is not base64 is refused (invalid_file)', e4 = 'invalid_file', e4);
  perform pg_temp.ok('A file over 3 MB is refused (file_too_large)', e5 = 'file_too_large', e5);
  perform pg_temp.ok('A document needs a title (invalid_title)', e6 = 'invalid_title', e6);
  perform pg_temp.ok('Nothing was stored by the refused uploads',
    not exists (select 1 from public.documents where user_id = uid)
    and not exists (select 1 from private.document_files where user_id = uid), 'ok');
end $$;

-- 3. The per-account cap (demo: 3 MB and 5 files).
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000903'; a text; b text; i int; r text;
begin
  a := pg_temp.up(uid, 'Two MB', 'application/pdf', pg_temp.file('\x255044462d'::bytea, 2097152));
  b := pg_temp.up(uid, 'Another 1.5 MB', 'application/pdf', pg_temp.file('\x255044462d'::bytea, 1572864));
  perform pg_temp.ok('A file that takes the account over its total is refused (quota_exceeded)',
    (a::jsonb) ->> 'byte_size' = '2097152' and b = 'quota_exceeded', b);
  delete from public.documents where user_id = uid;
  for i in 1..5 loop
    r := pg_temp.up(uid, 'Small ' || i, 'image/png', pg_temp.file('\x89504e470d0a1a0a'::bytea, 20));
  end loop;
  r := pg_temp.up(uid, 'Sixth', 'image/png', pg_temp.file('\x89504e470d0a1a0a'::bytea, 20));
  perform pg_temp.ok('A sixth file on a demo account is refused (quota_exceeded)', r = 'quota_exceeded', r);
end $$;

-- 4. The bytes table enforces the type itself.
do $$
declare did uuid := gen_random_uuid(); e text;
begin
  insert into public.documents (id, user_id, title, content_type, byte_size)
  values (did, '00000000-0000-4000-8000-000000000902', 'Forged', 'image/png', 10);
  begin
    insert into private.document_files (document_id, user_id, content_type, byte_size, bytes)
    values (did, '00000000-0000-4000-8000-000000000902', 'image/png', 10, convert_to('<script>xx', 'UTF8'));
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.ok('Even the database owner cannot store bytes that do not match the declared type',
    e like '%document_files_type_check%', e);
  begin
    insert into private.document_files (document_id, user_id, content_type, byte_size, bytes)
    values (did, '00000000-0000-4000-8000-000000000902', 'image/png', 10, '\x89504e470d0a1a0a00'::bytea);
    e := 'no error';
  exception when others then e := sqlerrm;
  end;
  perform pg_temp.ok('Nor bytes whose size differs from the document''s', e like '%document_files_size_check%', e);
end $$;

-- 5. What the browser may do.
do $$
declare e1 text; e2 text; e3 text; n_sel int; n_del int; e4 text; n_upd int;
  pdf uuid := pg_temp.get('pdf')::uuid;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000901');
  begin insert into public.documents (title, content_type, byte_size) values ('x', 'image/png', 1); e1 := 'no error';
  exception when others then e1 := sqlstate; end;
  begin perform count(*) from private.document_files; e2 := 'no error';
  exception when others then e2 := sqlstate; end;
  begin update public.documents set content_type = 'image/png' where id = pdf; e3 := 'no error';
  exception when others then e3 := sqlstate; end;
  update public.documents set title = 'Discharge letter, Mater' where id = pdf;
  get diagnostics n_upd = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('The browser cannot insert a document directly, read the bytes table or change a file''s type',
    e1 = '42501' and e2 = '42501' and e3 = '42501', format('%s %s %s', e1, e2, e3));
  perform pg_temp.ok('The owner can rename a document', n_upd = 1, n_upd::text);

  perform pg_temp.login('00000000-0000-4000-8000-000000000902');
  select count(*) into n_sel from public.documents where user_id = '00000000-0000-4000-8000-000000000901';
  delete from public.documents where id = pdf;
  get diagnostics n_del = row_count;
  begin perform public.my_document_file(pdf); e4 := 'no error';
  exception when others then e4 := sqlerrm; end;
  perform pg_temp.logout();
  perform pg_temp.ok('Another account cannot list, delete or fetch the file',
    n_sel = 0 and n_del = 0 and e4 = 'not_found', format('select=%s delete=%s fetch=%s', n_sel, n_del, e4));
end $$;

-- 6. The portal gets one file at a time, only while it may.
do $$
declare uid uuid := '00000000-0000-4000-8000-000000000901'; tok text := 'doc-token-a-0123456789abcdefghijklmnop';
  tok2 text := 'doc-token-b-0123456789abcdefghijklmnop';
  pdf uuid := pg_temp.get('pdf')::uuid; mh uuid := pg_temp.get('mh')::uuid; other uuid;
  j jsonb; f1 jsonb; f2 jsonb; f3 jsonb; f4 jsonb; f5 jsonb; n int;
begin
  -- Another patient's document.
  perform pg_temp.login('00000000-0000-4000-8000-000000000902');
  other := (public.upload_document('Theirs', 'image/png', pg_temp.file('\x89504e470d0a1a0a'::bytea, 20)) ->> 'id')::uuid;
  perform pg_temp.logout();

  -- Session A: Documents on, Mental health off.
  perform pg_temp.login(uid);
  j := public.create_share_code(share_documents => true, share_family_history => false,
                                share_insurance => false, share_medication_notes => false);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', tok, j ->> 'code', 'Dr Hennessy', null, null, 'doc-ip-a');
  f1 := public.portal_get_document('test-secret', tok, pdf);
  perform pg_temp.logout();
  perform pg_temp.ok('Nothing before Allow', f1 is null, coalesce(f1::text, 'null'));
  perform pg_temp.login(uid);
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  f1 := public.portal_get_document('test-secret', tok, pdf);
  perform public.portal_get_document('test-secret', tok, pdf);
  f2 := public.portal_get_document('test-secret', tok, mh);
  f3 := public.portal_get_document('test-secret', tok, other);
  perform pg_temp.logout();
  select count(*) into n from public.access_events where session_id = (j ->> 'id')::uuid and event = 'document_viewed';
  perform pg_temp.ok('Documents granted: the file comes back, its view logged once',
    f1 ->> 'content_type' = 'application/pdf' and f1 ->> 'data_base64' is not null and n = 1,
    format('%s views=%s', f1 ->> 'title', n));
  perform pg_temp.ok('A mental-health-flagged file needs the Mental health scope too', f2 is null, coalesce(f2::text, 'null'));
  perform pg_temp.ok('Another patient''s file is never returned', f3 is null, coalesce(f3::text, 'null'));
  perform pg_temp.login(uid);
  perform public.end_session();
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  f4 := public.portal_get_document('test-secret', tok, pdf);
  perform pg_temp.logout();
  perform pg_temp.ok('After the session ends the file function returns nothing', f4 is null, coalesce(f4::text, 'null'));

  -- Session B: Documents off.
  perform pg_temp.login(uid);
  j := public.create_share_code(share_documents => false, share_family_history => false,
                                share_insurance => false, share_medication_notes => false, share_mental_health => true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  perform public.portal_submit_code('test-secret', tok2, j ->> 'code', 'Dr Hennessy', null, null, 'doc-ip-b');
  perform pg_temp.logout();
  perform pg_temp.login(uid);
  perform public.respond_to_request((j ->> 'id')::uuid, true);
  perform pg_temp.logout();
  perform pg_temp.login_anon();
  f5 := public.portal_get_document('test-secret', tok2, pdf);
  perform pg_temp.logout();
  perform pg_temp.ok('Documents not granted: nothing, even with Mental health on', f5 is null, coalesce(f5::text, 'null'));
end $$;

-- 7. Deleting a document deletes its bytes.
do $$
declare pdf uuid := pg_temp.get('pdf')::uuid; n int;
begin
  perform pg_temp.login('00000000-0000-4000-8000-000000000901');
  delete from public.documents where id = pdf;
  get diagnostics n = row_count;
  perform pg_temp.logout();
  perform pg_temp.ok('The owner deletes a document and its bytes go with it',
    n = 1 and not exists (select 1 from private.document_files where document_id = pdf), n::text);
end $$;

select n, test, pass, info from _results order by n;

rollback;
