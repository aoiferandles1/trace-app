-- Trace redesign (3 of 4): the portal side.
--
--   portal_status            its scope object gains family_history and
--                            medication_notes, and documents / insurance now
--                            say what the session granted (false for every
--                            session the old app creates, as before).
--   portal_get_record(server_secret, portal_token, section, version)
--                            new overload, version 2: the redesigned sections.
--                            The three-argument original is unchanged.
--   portal_get_document      one document file, while the session is active
--                            and Documents (and, for a flagged file, Mental
--                            health) was granted.

create or replace function private.portal_status_json(s public.share_sessions, p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', coalesce(s.status, 'none'),
    'server_time', now(),
    'clinician', case when s.id is null then null else jsonb_build_object(
                   'name', s.clinician_name, 'role', s.clinician_role, 'practice', s.clinician_practice) end,
    'request_expires_at', case when s.status = 'requested' then s.request_expires_at end,
    'duration_kind', case when s.status in ('active', 'paused', 'ended') then s.duration_kind end,
    'approved_at', case when s.status in ('active', 'paused', 'ended') then s.approved_at end,
    'expires_at', case when s.status = 'active' then s.expires_at end,
    'paused_at', case when s.status = 'paused' then s.paused_at end,
    'closes_at', case when s.status = 'paused' then s.paused_at + interval '30 minutes' end,
    'ended_at', case when s.status = 'ended' then s.ended_at end,
    'ended_by', case when s.status = 'ended' then s.ended_by end,
    'allow_notes', case when s.status in ('active', 'paused') then s.allow_notes end,
    'scope', case when s.status = 'active' then private.v2_scope_json(s) end,
    'notes', case when s.status = 'active' and s.allow_notes then jsonb_build_object(
               'chief_complaint', s.chief_complaint,
               'assessment', s.assessment,
               'plan', s.plan,
               'follow_up', s.follow_up,
               'updated_at', s.notes_updated_at) end,
    'notes_saved_to_record', case when s.status = 'ended' then s.notes_entry_id is not null end,
    'locked_until', private.token_locked_until(p_token_hash));
$$;

revoke all on function private.portal_status_json(public.share_sessions, text) from public;

-- ---------------------------------------------------------------------------
-- portal_get_record, version 2. The only place a doctor gets record data
-- (and portal_get_document for one file). Same gate as version 1: nothing
-- unless the token's session is active right now. A section the patient did
-- not grant comes back with shared = false and data = null; its tables are
-- not read and no view is logged.
-- ---------------------------------------------------------------------------

create or replace function public.portal_get_record(
  server_secret text, portal_token text, section text, version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  s public.share_sessions;
  r jsonb;
begin
  perform private.verify_server_secret(portal_get_record.server_secret);
  h := private.portal_token_hash(portal_get_record.portal_token);
  if portal_get_record.section is null or not (portal_get_record.section = any (private.v2_sections())) then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if portal_get_record.version is distinct from 2 then
    raise exception 'invalid_version' using errcode = '22023';
  end if;

  s := private.portal_session(h);
  if s.id is null or s.status <> 'active' or s.expires_at <= now() then
    return null;
  end if;

  r := private.record_v2_json(s.patient_id, portal_get_record.section, s);

  -- Log the view, at most once per section per 30 seconds; only what was shown.
  if (r ->> 'shared')::boolean
     and not exists (select 1 from public.access_events ev
                      where ev.session_id = s.id and ev.event = 'section_viewed'
                        and ev.detail ->> 'section' = portal_get_record.section
                        and ev.at > now() - interval '30 seconds') then
    perform private.log_event(s.id, s.patient_id, 'clinician', 'section_viewed',
                              jsonb_build_object('section', portal_get_record.section));
  end if;

  return r;
end;
$$;

create or replace function public.portal_get_document(server_secret text, portal_token text, document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  s public.share_sessions;
begin
  perform private.verify_server_secret(portal_get_document.server_secret);
  h := private.portal_token_hash(portal_get_document.portal_token);
  if portal_get_document.document_id is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  s := private.portal_session(h);
  if s.id is null or s.status <> 'active' or s.expires_at <= now() or not s.share_documents then
    return null;
  end if;

  if not exists (select 1 from public.documents d
                  where d.id = portal_get_document.document_id and d.user_id = s.patient_id
                    and (s.share_mental_health or not d.is_mental_health)) then
    return null;
  end if;

  if not exists (select 1 from public.access_events ev
                  where ev.session_id = s.id and ev.event = 'document_viewed'
                    and ev.detail ->> 'document_id' = portal_get_document.document_id::text
                    and ev.at > now() - interval '30 seconds') then
    perform private.log_event(s.id, s.patient_id, 'clinician', 'document_viewed',
                              jsonb_build_object('document_id', portal_get_document.document_id));
  end if;

  return private.document_file_json(portal_get_document.document_id);
end;
$$;

-- Same grants as the other portal functions: the server secret is the gate.
revoke all on function public.portal_get_record(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.portal_get_document(text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_get_record(text, text, text, integer) to anon, authenticated;
grant execute on function public.portal_get_document(text, text, uuid) to anon, authenticated;
