-- Trace redesign (4 of 4): the redesign's demo record.
--
-- seed_demo_record_v2() fills the caller's sandbox with Jane Doe's record as
-- the approved boards show it (docs/redesign/canvas). seed_demo_record() is
-- left exactly as it is for the old app.
--
-- Dates: relative to today (Europe/Dublin) where the boards tell today's
-- story (the GP visit today at 9:30, results 9 days ago, the warfarin refill
-- in 8 days, the INR test in 14, cardiology in 48); fixed where the boards
-- show history (strength periods, past medications, the timeline from 2018).
-- Penicillin allergy: every antibiotic here is a non-penicillin (doxycycline,
-- nitrofurantoin, clarithromycin).
-- No documents, no insurance connection and no mental health items: the
-- boards show none (Insurance starts at "choose a provider").

create or replace function public.seed_demo_record_v2()
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
  res_id uuid;
  m_con uuid; m_lev uuid; m_war uuid; m_sal uuid;
  m_dox uuid; m_pre uuid; m_nit uuid; m_cet uuid;
  p_lev25 uuid; p_war uuid; p_sal uuid; p_dox uuid; p_pre uuid; p_nit uuid; p_cet uuid;
  ev uuid;
  rel uuid;
begin
  if not exists (select 1 from auth.users u where u.id = uid and u.is_anonymous) then
    raise exception 'not_anonymous' using errcode = '42501',
      detail = 'The demo record can only be created for an anonymous demo user.';
  end if;

  -- Reset: everything the caller owns, including any share session.
  delete from public.share_sessions where patient_id = uid;
  delete from public.access_events where patient_id = uid;
  delete from public.entries where user_id = uid;            -- result_values cascade
  delete from public.health_events where user_id = uid;      -- prescriptions cascade
  delete from public.conditions where user_id = uid;
  delete from public.medications where user_id = uid;        -- periods cascade
  delete from public.care_team where user_id = uid;
  delete from public.vitals where user_id = uid;
  delete from public.relatives where user_id = uid;          -- their conditions cascade
  delete from public.insurance_connections where user_id = uid;
  delete from public.documents where user_id = uid;          -- files cascade

  -- Periods are written here by hand, not by the medications sync trigger.
  perform set_config('trace.periods_managed', 'on', true);

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

  -- Conditions (Record, Conditions tab).
  insert into public.conditions (user_id, name, status, clinician, specialty, diagnosed_year,
                                 diagnosed_note, is_mental_health, created_at, updated_at)
  values
    (uid, 'Atrial fibrillation', 'managed', 'Dr O''Mahony', 'Cardiology', 2019, null, false,
     now() - interval '3 seconds', now()),
    (uid, 'Hypothyroidism', 'ongoing', 'Dr Walsh', 'Endocrinology', 2022, null, false,
     now() - interval '2 seconds', now()),
    (uid, 'Mild asthma', 'managed', 'Dr Hennessy', 'GP', null, 'since childhood', false,
     now() - interval '1 second', now());

  -- Medications. Current: Concerta, Levothyroxine, Warfarin, Salbutamol.
  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Concerta', '36mg', 'mg', 'Tablet', 'once daily', 'morning', null,
          'Dr Hennessy', 'GP', 'Rathmines Medical Centre', null,
          date '2024-01-01', null, null, null)
  returning id into m_con;

  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Levothyroxine', '50mcg', 'mcg', 'Tablet', 'once daily', 'morning', 'Thyroid',
          'Dr Walsh', 'Endocrinology', null, 'Hypothyroidism',
          date '2022-03-01', null, 'Take on an empty stomach, 30 minutes before breakfast.', null)
  returning id into m_lev;

  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Warfarin', '5mg', 'mg', 'Tablet', 'once daily', 'evening', 'Anticoagulant',
          'Dr O''Mahony', 'Cardiology', 'Mater Private', 'Atrial fibrillation',
          date '2019-06-01', null, 'Take at the same time each evening. Needs regular INR blood tests.', d + 8)
  returning id into m_war;

  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Salbutamol', '100mcg', 'mcg', 'Inhaler', 'as needed', null, 'Bronchodilator',
          'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'Asthma',
          date '2015-01-01', null, 'One to two puffs when wheezing or breathless.', null)
  returning id into m_sal;

  -- Past, all Dr Hennessy.
  insert into public.medications (user_id, name, dose, unit, prescriber, prescriber_specialty, prescriber_org,
                                  indication, started_on, ended_on)
  values (uid, 'Doxycycline', '100mg', 'mg', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
          'Chest infection', date '2026-08-02', date '2026-08-09')
  returning id into m_dox;
  insert into public.medications (user_id, name, dose, unit, prescriber, prescriber_specialty, prescriber_org,
                                  indication, started_on, ended_on)
  values (uid, 'Prednisolone', '20mg', 'mg', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
          'Asthma flare', date '2026-02-09', date '2026-02-14')
  returning id into m_pre;
  insert into public.medications (user_id, name, dose, unit, prescriber, prescriber_specialty, prescriber_org,
                                  indication, started_on, ended_on)
  values (uid, 'Nitrofurantoin', '100mg', 'mg', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
          'Urinary tract infection', date '2025-09-12', date '2025-09-17')
  returning id into m_nit;
  insert into public.medications (user_id, name, dose, unit, prescriber, prescriber_specialty, prescriber_org,
                                  indication, started_on, ended_on)
  values (uid, 'Cetirizine', '10mg', 'mg', 'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
          'Hay fever', date '2024-04-01', date '2024-09-30')
  returning id into m_cet;

  -- Strength periods. Concerta's notes are shared, so they reach a doctor
  -- only when the Medication notes scope is granted (as on the portal board).
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values
    (m_con, uid, 18, date '2024-01-01', date '2024-03-01', 'month', 'Dr Hennessy',
     'Barely noticed it. A little more focus in the morning, gone by lunch.', true),
    (m_con, uid, 27, date '2024-03-01', date '2024-06-01', 'month', 'Dr Hennessy',
     'Better focus through the morning. Appetite dropped.', true),
    (m_con, uid, 36, date '2024-06-01', date '2024-10-01', 'month', 'Dr Hennessy',
     'Steady all day. Good for work.', true),
    (m_con, uid, 45, date '2024-10-01', date '2025-02-01', 'month', 'Dr Hennessy',
     'Too much. Racing heart and trouble sleeping.', true),
    (m_con, uid, 36, date '2025-02-01', null, 'month', 'Dr Hennessy',
     'Back on 36. Smoother and sleeping better.', true);

  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values (m_lev, uid, 25, date '2022-03-01', date '2022-09-01', 'month', 'Dr Walsh', null, false)
  returning id into p_lev25;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values (m_lev, uid, 50, date '2022-09-01', null, 'month', 'Dr Walsh', 'Energy back to normal.', true);

  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_war, uid, 5, date '2019-06-01', null, 'month', 'Dr O''Mahony')
  returning id into p_war;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_sal, uid, 100, date '2015-01-01', null, 'year', 'Dr Hennessy')
  returning id into p_sal;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_dox, uid, 100, date '2026-08-02', date '2026-08-09', 'day', 'Dr Hennessy')
  returning id into p_dox;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_pre, uid, 20, date '2026-02-09', date '2026-02-14', 'day', 'Dr Hennessy')
  returning id into p_pre;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_nit, uid, 100, date '2025-09-12', date '2025-09-17', 'day', 'Dr Hennessy')
  returning id into p_nit;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by)
  values (m_cet, uid, 10, date '2024-04-01', date '2024-09-30', 'day', 'Dr Hennessy')
  returning id into p_cet;

  -- Visits and results (Home, Record timeline, portal Recent visits).
  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, reason, assessment, plan,
                              created_at, updated_at)
  values (uid, 'visit', 'GP visit', (d + time '09:30') at time zone tz, 'Dr Hennessy',
          'Rathmines Medical Centre', 'Tired for three weeks',
          'Possibly low iron. Thyroid dose to be reviewed.',
          'Blood tests. Repeat INR on ' || to_char(d + 14, 'FMDD Mon') || '.',
          least((d + time '09:30') at time zone tz, now()), now())
  returning id into appt_id;

  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, created_at, updated_at)
  values (uid, 'result', 'Blood count and INR', ((d - 9) + time '10:15') at time zone tz,
          'Dr Hennessy', 'Mater Hospital', ((d - 9) + time '10:15') at time zone tz, now())
  returning id into res_id;

  insert into public.result_values (user_id, entry_id, position, name, value, unit, ref_low, ref_high)
  values
    (uid, res_id, 0, 'Haemoglobin', 128, 'g/L', 115, 160),
    (uid, res_id, 1, 'White cells', 6.2, 'x10⁹/L', 4, 11),
    (uid, res_id, 2, 'Platelets', 245, 'x10⁹/L', 150, 400),
    (uid, res_id, 3, 'INR', 2.4, null, 2, 3),
    (uid, res_id, 4, 'Ferritin', 18, 'µg/L', 30, 300);

  insert into public.entries (user_id, kind, title, occurs_at, created_at, updated_at)
  values (uid, 'note', 'Fatigue symptoms', ((d - 11) + time '20:00') at time zone tz,
          ((d - 11) + time '20:00') at time zone tz, now());

  insert into public.entries (user_id, kind, title, occurs_at, clinician, place,
                              rx_medication, rx_quantity, rx_pharmacy, created_at, updated_at)
  values (uid, 'prescription', 'Warfarin renewed', ((d - 12) + time '11:00') at time zone tz,
          'Dr O''Mahony', 'Boots, Rathmines', 'Warfarin 5mg, daily', '28 tablets', 'Boots, Rathmines',
          ((d - 12) + time '11:00') at time zone tz, now());

  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, created_at, updated_at)
  values
    (uid, 'visit', 'INR blood test', ((d + 14) + time '09:30') at time zone tz,
     null, 'Rathmines Medical Centre', now(), now()),
    (uid, 'visit', 'Cardiology follow-up', ((d + 48) + time '14:00') at time zone tz,
     'Dr O''Mahony', 'Mater Private', now(), now());

  -- Care team (portal Care team board).
  insert into public.care_team (user_id, name, role, organisation, kind, created_at, updated_at)
  values
    (uid, 'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'gp', now() - interval '4 seconds', now()),
    (uid, 'Dr O''Mahony', 'Cardiology', 'Mater Private', 'specialist', now() - interval '3 seconds', now()),
    (uid, 'Dr Walsh', 'Endocrinology', null, 'specialist', now() - interval '2 seconds', now()),
    (uid, 'Boots', 'Pharmacy', 'Rathmines', 'pharmacy', now() - interval '1 second', now());

  -- Vitals (portal Overview): 128/82, 74 bpm, 58 kg, 98%.
  insert into public.vitals (user_id, recorded_on, systolic, diastolic, heart_rate, weight_kg, spo2)
  values (uid, d - 43, 128, 82, 74, 58, 98);

  -- The full timeline: nine events, 2018 to 2026.
  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Chest infection', date '2026-08-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Cough and fever for five days. Chest clear at follow-up.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Doxycycline 100mg', '7 days, from 2 Aug', m_dox, p_dox);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'condition', 'Asthma flare', date '2026-02-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'settled', 'Wheeze after a cold. Peak flow improved on treatment.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Prednisolone 20mg', '5 days', m_pre, p_pre),
         (uid, ev, 1, 'Salbutamol 100mcg', 'As needed', m_sal, p_sal);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Urinary tract infection', date '2025-09-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Penicillin allergy noted, so a non-penicillin antibiotic was used.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Nitrofurantoin 100mg', '5 days', m_nit, p_nit);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'condition', 'Hay fever', date '2024-04-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'seasonal', 'Itchy eyes and sneezing each spring.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Cetirizine 10mg', 'April to September', m_cet, p_cet);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Tonsillitis', date '2023-11-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Sore throat and fever. Non-penicillin antibiotic because of the allergy.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail)
  values (uid, ev, 0, 'Clarithromycin 250mg', '7 days');

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'condition', 'Hypothyroidism diagnosed', date '2022-03-01', 'Dr Walsh', 'Endocrinology',
          'ongoing', 'Found on blood tests after months of tiredness.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Levothyroxine 25mcg', 'Raised to 50mcg in Sep 2022', m_lev, p_lev25);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Covid-19', date '2020-12-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Managed at home. No hospital stay.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail)
  values (uid, ev, 0, 'Nothing prescribed', 'Rest and fluids');

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'condition', 'Atrial fibrillation diagnosed', date '2019-06-01', 'Dr O''Mahony',
          'Cardiology, Mater Private', 'ongoing', 'Irregular heartbeat picked up on an ECG.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Warfarin 5mg', 'Daily, ongoing', m_war, p_war);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Glandular fever', date '2018-02-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Sore throat and exhaustion for several weeks.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail)
  values (uid, ev, 0, 'Nothing prescribed', 'Rest and fluids');

  -- Family history: seven relatives (Family tree board).
  insert into public.relatives (user_id, relation, created_at) values (uid, 'maternal_grandmother', now() - interval '7 seconds')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, category) values (uid, rel, 'Type 2 diabetes', 'diabetes');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'maternal_grandfather', now() - interval '6 seconds');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'paternal_grandmother', now() - interval '5 seconds')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, category) values (uid, rel, 'Asthma', 'asthma');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'paternal_grandfather', now() - interval '4 seconds')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, age_at_diagnosis, category)
  values (uid, rel, 'Heart attack', 61, 'heart');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'mother', now() - interval '3 seconds')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, category) values (uid, rel, 'Type 2 diabetes', 'diabetes');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'father', now() - interval '2 seconds')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, category) values (uid, rel, 'Atrial fibrillation', 'heart');

  insert into public.relatives (user_id, relation, created_at) values (uid, 'brother', now() - interval '1 second')
  returning id into rel;
  insert into public.relative_conditions (user_id, relative_id, name, category) values (uid, rel, 'Asthma', 'asthma');

  perform set_config('trace.periods_managed', '', true);

  return jsonb_build_object('ok', true, 'appointment_entry_id', appt_id);
end;
$$;

revoke all on function public.seed_demo_record_v2() from public, anon, authenticated;
grant execute on function public.seed_demo_record_v2() to authenticated;
