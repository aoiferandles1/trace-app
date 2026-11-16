-- Home's "Today's medicines" ticks (owner's decision, 16 Nov 2026).
--
-- * medication_doses: one row per dose the patient marks as taken, for one
--   medication, one day (Irish time, worked out by the app) and one time of
--   day. Unticking deletes the row. Owner only: no portal function reads it,
--   so a doctor never sees it, whatever a share's switches say.
-- * The row belongs to the same user as its medication (composite foreign
--   key, as medication_periods), and goes with the medication or the account.
-- * export_my_data(version 2) gains "medication_doses"; the original
--   export_my_data() is unchanged.

create table public.medication_doses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medication_id  uuid not null,
  taken_on       date not null,
  slot           text not null check (slot in ('morning', 'midday', 'evening', 'bedtime', 'other')),
  taken_at       timestamptz not null default now(),
  constraint medication_doses_medication_fkey foreign key (medication_id, user_id)
    references public.medications (id, user_id) on delete cascade,
  constraint medication_doses_one_per_slot unique (medication_id, taken_on, slot)
);

create index medication_doses_user_day_idx on public.medication_doses (user_id, taken_on);

alter table public.medication_doses enable row level security;

revoke all on public.medication_doses from public, anon, authenticated;
grant select, insert, delete on public.medication_doses to authenticated;

create policy medication_doses_select_own on public.medication_doses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_doses_insert_own on public.medication_doses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medication_doses_delete_own on public.medication_doses
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.export_my_data(version integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  if export_my_data.version is distinct from 2 then
    raise exception 'invalid_version' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'version', 2,
    'exported_at', now(),
    'user_id', uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at, c.id)
                              from public.conditions c where c.user_id = uid), '[]'::jsonb),
    'medications', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
                               from public.medications m where m.user_id = uid), '[]'::jsonb),
    'medication_periods', coalesce((select jsonb_agg(to_jsonb(x) order by x.medication_id, x.start_date, x.id)
                               from public.medication_periods x where x.user_id = uid), '[]'::jsonb),
    'medication_doses', coalesce((select jsonb_agg(to_jsonb(x) order by x.taken_on, x.medication_id, x.slot)
                               from public.medication_doses x where x.user_id = uid), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.occurs_at, e.id)
                           from public.entries e where e.user_id = uid), '[]'::jsonb),
    'result_values', coalesce((select jsonb_agg(to_jsonb(r) order by r.entry_id, r.position, r.id)
                           from public.result_values r where r.user_id = uid), '[]'::jsonb),
    'health_events', coalesce((select jsonb_agg(to_jsonb(h) order by h.occurred_on, h.id)
                           from public.health_events h where h.user_id = uid), '[]'::jsonb),
    'health_event_prescriptions', coalesce((select jsonb_agg(to_jsonb(x) order by x.event_id, x.position, x.id)
                           from public.health_event_prescriptions x where x.user_id = uid), '[]'::jsonb),
    'care_team', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at, t.id)
                             from public.care_team t where t.user_id = uid), '[]'::jsonb),
    'vitals', coalesce((select jsonb_agg(to_jsonb(v) order by v.recorded_on, v.id)
                          from public.vitals v where v.user_id = uid), '[]'::jsonb),
    'relatives', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at, r.id)
                          from public.relatives r where r.user_id = uid), '[]'::jsonb),
    'relative_conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.relative_id, c.created_at, c.id)
                          from public.relative_conditions c where c.user_id = uid), '[]'::jsonb),
    'insurance_connections', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
                          from public.insurance_connections i where i.user_id = uid), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
                                     'data_base64', translate(encode(f.bytes, 'base64'), E'\n', ''))
                                   order by d.created_at, d.id)
                             from public.documents d
                             join private.document_files f on f.document_id = d.id
                            where d.user_id = uid), '[]'::jsonb),
    'share_sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'portal_token_hash' order by s.created_at, s.id)
                                  from public.share_sessions s where s.patient_id = uid), '[]'::jsonb),
    'access_events', coalesce((select jsonb_agg(to_jsonb(a) order by a.at, a.id)
                                 from public.access_events a where a.patient_id = uid), '[]'::jsonb));
end;
$$;
