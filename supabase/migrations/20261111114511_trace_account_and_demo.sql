-- Trace: demo seed, account deletion, data export, demo cleanup, realtime.

-- ---------------------------------------------------------------------------
-- seed_demo_record(): fill the caller's own sandbox with Jane Doe's record.
-- Anonymous (demo) users only. Wipes the caller's data first, so calling it
-- again is "Reset demo". Dates are relative to today (Europe/Dublin).
-- Values are read from the final screen exports, with the corrections in
-- PLAN.md section 11 (drug classes, initials, UPCOMING).
-- ---------------------------------------------------------------------------

create or replace function public.seed_demo_record()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  d date := private.today_local();
  tz constant text := 'Europe/Dublin';
  appt_id uuid;
begin
  if not exists (select 1 from auth.users u where u.id = uid and u.is_anonymous) then
    raise exception 'not_anonymous' using errcode = '42501',
      detail = 'The demo record can only be created for an anonymous demo user.';
  end if;

  -- Reset: everything the caller owns, including any share session.
  delete from public.share_sessions where patient_id = uid;
  delete from public.access_events where patient_id = uid;
  delete from public.entries where user_id = uid;
  delete from public.conditions where user_id = uid;
  delete from public.medications where user_id = uid;
  delete from public.care_team where user_id = uid;
  delete from public.vitals where user_id = uid;

  insert into public.profiles (id, first_name, last_name, date_of_birth, sex, country, city,
                               address, phone, blood_type, allergies, implants, email_reminders,
                               terms_accepted_at, onboarding_step, is_demo)
  values (uid, 'Jane', 'Doe', date '1991-03-12', 'Female', 'Ireland', 'Dublin',
          'Rathmines, Dublin 6', '+353 86 123 4567', 'A+', array['Penicillin'], '{}',
          false, now(), 'done', true)
  on conflict (id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    date_of_birth = excluded.date_of_birth, sex = excluded.sex, country = excluded.country,
    city = excluded.city, address = excluded.address, phone = excluded.phone,
    blood_type = excluded.blood_type, allergies = excluded.allergies, implants = excluded.implants,
    email_reminders = excluded.email_reminders, terms_accepted_at = excluded.terms_accepted_at,
    onboarding_step = excluded.onboarding_step, is_demo = true;

  -- Conditions, in the order the record shows them.
  insert into public.conditions (user_id, name, status, clinician, specialty, diagnosed_year,
                                 diagnosed_note, is_mental_health, created_at, updated_at)
  values
    (uid, 'Atrial fibrillation', 'managed', 'Dr O''Mahony', 'Cardiology', 2019, null, false,
     now() - interval '3 seconds', now()),
    (uid, 'Hypothyroidism', 'ongoing', 'Dr Walsh', 'Endocrinology', 2022, null, false,
     now() - interval '2 seconds', now()),
    (uid, 'Mild asthma', 'managed', 'Dr Hennessy', 'GP', null, 'since childhood', false,
     now() - interval '1 second', now());

  -- Medications: three current, two expired in the last 12 months.
  -- Start dates carry only the year shown on the screens.
  insert into public.medications (user_id, name, dose, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on,
                                  created_at, updated_at)
  values
    (uid, 'Warfarin', '5mg', 'Tablet', 'once daily', 'evening', 'Anticoagulant',
     'Dr O''Mahony', 'Cardiology', 'Mater Private', 'Atrial fibrillation',
     date '2019-01-01', null,
     'Take at the same time each evening. Needs regular INR blood tests.', d + 8,
     now() - interval '5 seconds', now()),
    (uid, 'Levothyroxine', '50mcg', 'Tablet', 'once daily', 'morning', 'Thyroid',
     'Dr Walsh', 'Endocrinology', null, 'Hypothyroidism',
     date '2022-01-01', null,
     'Take on an empty stomach, 30 minutes before breakfast.', null,
     now() - interval '4 seconds', now()),
    (uid, 'Salbutamol', '100mcg', 'Inhaler', 'as needed', null, 'Bronchodilator',
     'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'Asthma',
     date '2015-01-01', null,
     'One to two puffs when wheezing or breathless.', null,
     now() - interval '3 seconds', now()),
    (uid, 'Clarithromycin', '500mg', 'Tablet', 'twice daily', null, 'Antibiotic',
     null, null, null, null,
     d - 130, d - 123, null, null,
     now() - interval '2 seconds', now()),
    (uid, 'Prednisolone', '5mg', 'Tablet', 'once daily', 'morning', 'Steroid',
     null, null, null, null,
     d - 200, d - 186, null, null,
     now() - interval '1 second', now());

  -- Timeline. Today's GP visit drives the share card.
  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, body,
                              is_mental_health, source, created_at, updated_at)
  values (uid, 'visit', 'GP visit', (d + time '09:30') at time zone tz, 'Dr Hennessy',
          'Rathmines Medical Centre', null, false, 'patient',
          least((d + time '09:30') at time zone tz, now()), now())
  returning id into appt_id;

  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, body,
                              is_mental_health, source, created_at, updated_at)
  select uid, v.kind, v.title, v.at, v.clinician, v.place, v.body, false, 'patient',
         least(v.at, now()), now()
    from (values
      ('result', 'Blood test, full blood count and INR', ((d - 9) + time '10:15') at time zone tz,
       'Dr Hennessy', 'Mater Hospital', null::text),
      ('note', 'Personal note added', ((d - 11) + time '20:00') at time zone tz,
       null, null, 'Fatigue symptoms'),
      ('prescription', 'Warfarin prescription renewed', ((d - 12) + time '11:00') at time zone tz,
       null, 'Boots, Rathmines', null),
      ('visit', 'Cardiology review', ((d - 43) + time '14:00') at time zone tz,
       'Dr O''Mahony', 'Mater Private', null),
      ('visit', 'INR blood test', ((d + 14) + time '09:30') at time zone tz,
       null, 'Rathmines Medical Centre', null),
      ('visit', 'Cardiology follow-up', ((d + 48) + time '14:00') at time zone tz,
       'Dr O''Mahony', 'Mater Private', null)
    ) as v(kind, title, at, clinician, place, body);

  insert into public.care_team (user_id, name, role, organisation, kind, created_at, updated_at)
  values
    (uid, 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'gp', now() - interval '4 seconds', now()),
    (uid, 'Dr O''Mahony', 'Cardiology', 'Mater Private', 'specialist', now() - interval '3 seconds', now()),
    (uid, 'Dr Walsh', 'Endocrinology', null, 'specialist', now() - interval '2 seconds', now()),
    (uid, 'Boots, Rathmines', 'Pharmacy', 'Boots', 'pharmacy', now() - interval '1 second', now());

  insert into public.vitals (user_id, recorded_on, systolic, diastolic, heart_rate, weight_kg, spo2)
  values (uid, d - 43, 128, 82, 74, 58, 98);

  return jsonb_build_object('ok', true, 'appointment_entry_id', appt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_account(): delete the caller's auth user; everything cascades.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  delete from auth.users where id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- export_my_data(): every row the caller owns, as one JSON document.
-- Security invoker: it reads through the caller's own row-level security.
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'user_id', uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at, c.id)
                              from public.conditions c where c.user_id = uid), '[]'::jsonb),
    'medications', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
                               from public.medications m where m.user_id = uid), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.occurs_at, e.id)
                           from public.entries e where e.user_id = uid), '[]'::jsonb),
    'care_team', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at, t.id)
                             from public.care_team t where t.user_id = uid), '[]'::jsonb),
    'vitals', coalesce((select jsonb_agg(to_jsonb(v) order by v.recorded_on, v.id)
                          from public.vitals v where v.user_id = uid), '[]'::jsonb),
    'share_sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'portal_token_hash' order by s.created_at, s.id)
                                  from public.share_sessions s where s.patient_id = uid), '[]'::jsonb),
    'access_events', coalesce((select jsonb_agg(to_jsonb(a) order by a.at, a.id)
                                 from public.access_events a where a.patient_id = uid), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- cleanup_demo_users(server_secret): the daily cron. Deletes anonymous users
-- older than 24 hours (their data cascades) and old portal attempts.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_demo_users(server_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_users integer;
  n_attempts integer;
  n_bindings integer;
begin
  perform private.verify_server_secret(cleanup_demo_users.server_secret);

  delete from auth.users where is_anonymous and created_at < now() - interval '24 hours';
  get diagnostics n_users = row_count;

  delete from private.portal_attempts where at < now() - interval '24 hours';
  get diagnostics n_attempts = row_count;

  delete from private.portal_bindings where updated_at < now() - interval '24 hours';
  get diagnostics n_bindings = row_count;

  return jsonb_build_object('deleted_users', n_users,
                            'deleted_attempts', n_attempts,
                            'deleted_bindings', n_bindings);
end;
$$;

revoke all on function public.seed_demo_record() from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;
revoke all on function public.export_my_data() from public, anon, authenticated;
revoke all on function public.cleanup_demo_users(text) from public, anon, authenticated;

grant execute on function public.seed_demo_record() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.cleanup_demo_users(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the patient's app listens for changes to its own share sessions
-- (RLS applies to what each subscriber receives).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.share_sessions;
