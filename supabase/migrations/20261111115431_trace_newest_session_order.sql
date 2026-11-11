-- Trace: make "the patient's newest session" unambiguous.
--
-- Two sessions created in one transaction shared the same now(), so ordering
-- by created_at alone could pick either. Sessions now take clock_timestamp(),
-- and the live session (there is at most one) always wins.

alter table public.share_sessions alter column created_at set default clock_timestamp();

create or replace function private.newest_session_for(p_uid uuid)
returns public.share_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select id into sid from public.share_sessions
   where patient_id = p_uid
   order by (status in ('code_issued', 'requested', 'active', 'paused')) desc, created_at desc, id desc
   limit 1;
  if sid is null then
    return null;
  end if;
  return private.advance_session(sid);
end;
$$;

revoke all on function private.newest_session_for(uuid) from public;
