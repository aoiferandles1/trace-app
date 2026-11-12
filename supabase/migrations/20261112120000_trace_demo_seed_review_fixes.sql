-- Trace review fixes: a corrected demo story for seed_demo_record_v2().
--
-- Applied to the hosted project on 12 November 2026 (the owner's decision),
-- recorded there as "trace_demo_seed_review_fixes". Nothing else changes: same signature, same grants,
-- same reset of everything the caller owns. It replaces the function from
-- 20261111163442_trace_redesign_demo_seed.sql, which stays as it was.
--
-- What changes, and why (the UX review's sample-data items E1 to E9):
--
-- E1  Concerta now has a reason: ADHD (Dr Byrne, Psychiatry, 2023), flagged
--     as mental health, with its timeline event and the assessment letter.
--     Strengths are real Concerta tablets (18, 27, 36, 54mg; 45mg is not
--     one). The 54mg note no longer reads as a heart symptom beside atrial
--     fibrillation and warfarin, and the record says the cardiologist was
--     asked first. Medication row: drug class Stimulant, for ADHD.
-- E2  Today's 9:30 GP visit has only its reason ("Go through the blood
--     results"): nothing is assessed before the doctor sees her. The story
--     runs in order: a visit for tiredness 16 days ago (shared with Dr
--     Hennessy, whose notes planned the bloods), the note 11 days ago, the
--     results 9 days ago (low ferritin; TSH added, since the plan asked for
--     thyroid function), then today.
-- E3  Two sample documents (one PDF letter from cardiology, and the ADHD
--     assessment summary flagged as mental health), so Documents, Mental
--     health and the "Private by default" tile have something in them. The
--     files are tiny PDFs (about 1 KB each) that say they are samples.
-- E4  "Fatigue symptoms" has text.
-- E5  "Warfarin renewed" is 20 days ago: 28 daily tablets, refill due in 8
--     days, which adds up.
-- E6  No "Nothing prescribed" medicine: Covid-19 and Glandular fever have no
--     prescriptions.
-- E7  Vitals are dated the day of the tiredness visit (16 days ago).
-- E8  "Jane Doe" stays (boards, tests and docs use it).
-- E9  One past share: Dr Hennessy at the tiredness visit, ended by the
--     doctor, with the session notes entry and the access events a real
--     share writes, so Share history is not empty at the start.
--
-- Unchanged: the profile, the other conditions, Levothyroxine, Warfarin,
-- Salbutamol and the past medications, care team, relatives, the upcoming
-- INR test (in 14 days) and cardiology follow-up (in 48), the other
-- events. Penicillin allergy: still no penicillin antibiotic anywhere.

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
  tired_id uuid;
  res_id uuid;
  notes_id uuid;
  share_id uuid;
  doc_id uuid;
  file bytea;
  m_con uuid; m_lev uuid; m_war uuid; m_sal uuid;
  m_dox uuid; m_pre uuid; m_nit uuid; m_cet uuid;
  p_con18 uuid; p_lev25 uuid; p_war uuid; p_sal uuid; p_dox uuid; p_pre uuid; p_nit uuid; p_cet uuid;
  ev uuid;
  rel uuid;
  t_visit timestamptz;
  t_code timestamptz;
  t_approved timestamptz;
  t_ended timestamptz;
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

  -- Conditions. ADHD is new (E1) and flagged as mental health, so a doctor
  -- sees it only when the patient shares Mental health.
  insert into public.conditions (user_id, name, status, clinician, specialty, diagnosed_year,
                                 diagnosed_note, is_mental_health, created_at, updated_at)
  values
    (uid, 'Atrial fibrillation', 'managed', 'Dr O''Mahony', 'Cardiology', 2019, null, false,
     now() - interval '4 seconds', now()),
    (uid, 'Hypothyroidism', 'ongoing', 'Dr Walsh', 'Endocrinology', 2022, null, false,
     now() - interval '3 seconds', now()),
    (uid, 'Mild asthma', 'managed', 'Dr Hennessy', 'GP', null, 'since childhood', false,
     now() - interval '2 seconds', now()),
    (uid, 'ADHD', 'managed', 'Dr Byrne', 'Psychiatry', 2023, null, true,
     now() - interval '1 second', now());

  -- Medications. Current: Concerta, Levothyroxine, Warfarin, Salbutamol.
  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Concerta', '36mg', 'mg', 'Tablet', 'once daily', 'morning', 'Stimulant',
          'Dr Hennessy', 'GP', 'Rathmines Medical Centre', 'ADHD',
          date '2024-01-01', null, 'Swallow whole in the morning.', null)
  returning id into m_con;

  insert into public.medications (user_id, name, dose, unit, form, frequency, timing, drug_class,
                                  prescriber, prescriber_specialty, prescriber_org, indication,
                                  started_on, ended_on, instructions, refill_due_on)
  values (uid, 'Levothyroxine', '50mcg', 'mcg', 'Tablet', 'once daily', 'morning', 'Thyroid',
          'Dr Walsh', 'Endocrinology', null, 'Hypothyroidism',
          date '2022-03-01', null, 'Take on an empty stomach, 30 minutes before breakfast.', null)
  returning id into m_lev;

  -- Refill in 8 days: 28 daily tablets from the renewal 20 days ago (E5).
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

  -- Concerta's strengths: real tablets (18, 27, 36, 54mg), up slowly, one
  -- step too far, then back (E1). The notes are shared, so they reach a
  -- doctor only when the Medication notes scope is granted.
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values (m_con, uid, 18, date '2024-01-01', date '2024-03-01', 'month', 'Dr Hennessy',
          'Barely noticed it. A little more focus in the morning, gone by lunch.', true)
  returning id into p_con18;
  insert into public.medication_periods (medication_id, user_id, strength, start_date, end_date,
                                         date_precision, prescribed_by, note, note_shared)
  values
    (m_con, uid, 27, date '2024-03-01', date '2024-06-01', 'month', 'Dr Hennessy',
     'Better focus through the morning. Appetite dropped.', true),
    (m_con, uid, 36, date '2024-06-01', date '2024-10-01', 'month', 'Dr Hennessy',
     'Steady all day. Good for work.', true),
    (m_con, uid, 54, date '2024-10-01', date '2025-02-01', 'month', 'Dr Hennessy',
     'Too strong. Felt on edge in the evenings and slept badly.', true),
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

  -- The tiredness story, in order (E2).
  -- 20 days ago: warfarin renewed, 28 tablets (refill due in 8 days, E5).
  insert into public.entries (user_id, kind, title, occurs_at, clinician, place,
                              rx_medication, rx_quantity, rx_pharmacy, created_at, updated_at)
  values (uid, 'prescription', 'Warfarin renewed', ((d - 20) + time '11:00') at time zone tz,
          'Dr O''Mahony', 'Boots, Rathmines', 'Warfarin 5mg, daily', '28 tablets', 'Boots, Rathmines',
          ((d - 20) + time '11:00') at time zone tz, now());

  -- 16 days ago: the visit Jane logged (her reason only); Dr Hennessy's
  -- assessment and plan are in the session notes of the share below.
  t_visit := ((d - 16) + time '09:30') at time zone tz;
  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, reason, created_at, updated_at)
  values (uid, 'visit', 'GP visit for tiredness', t_visit, 'Dr Hennessy', 'Rathmines Medical Centre',
          'Tired for three weeks', t_visit - interval '2 days', now())
  returning id into tired_id;

  -- 11 days ago: her own note (personal, never shared with a doctor).
  insert into public.entries (user_id, kind, title, occurs_at, body, created_at, updated_at)
  values (uid, 'note', 'Fatigue symptoms', ((d - 11) + time '20:00') at time zone tz,
          'Still tired by mid-afternoon most days, even after a full night''s sleep. Blood test booked for next week.',
          ((d - 11) + time '20:00') at time zone tz, now());

  -- 9 days ago: the bloods the plan asked for. Ferritin low; TSH normal.
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
    (uid, res_id, 4, 'Ferritin', 18, 'µg/L', 30, 300),
    (uid, res_id, 5, 'TSH', 2.1, 'mIU/L', 0.4, 4);

  -- Today at 9:30: to go through the results. Nothing assessed yet.
  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, reason, created_at, updated_at)
  values (uid, 'visit', 'GP visit', (d + time '09:30') at time zone tz, 'Dr Hennessy',
          'Rathmines Medical Centre', 'Go through the blood results',
          least((d + time '09:30') at time zone tz, now()), now())
  returning id into appt_id;

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

  -- Vitals, taken at the tiredness visit (E7): 128/82, 74 bpm, 58 kg, 98%.
  insert into public.vitals (user_id, recorded_on, systolic, diastolic, heart_rate, weight_kg, spo2)
  values (uid, d - 16, 128, 82, 74, 58, 98);

  -- One past share (E9): Dr Hennessy at the tiredness visit, 30 minutes,
  -- the patient app's defaults (Full timeline and Medication notes on,
  -- Mental health, Documents and Insurance off), ended by the doctor after
  -- 18 minutes with notes. Written as the share functions would write it.
  t_code := t_visit + interval '1 minute';
  t_approved := t_visit + interval '4 minutes';
  t_ended := t_visit + interval '22 minutes';
  insert into public.share_sessions (patient_id, status, code, code_expires_at,
                                     share_conditions, share_recent_visits, share_full_timeline,
                                     share_care_team, share_mental_health, share_documents,
                                     share_family_history, share_insurance, share_medication_notes,
                                     allow_notes, duration_kind,
                                     clinician_name, clinician_role, clinician_practice,
                                     requested_at, request_expires_at, approved_at, expires_at,
                                     ended_at, ended_by, appointment_entry_id,
                                     chief_complaint, assessment, plan, follow_up, notes_updated_at,
                                     created_at, updated_at)
  values (uid, 'ended', '5308', t_code + interval '5 minutes',
          true, true, true, true, false, false, true, false, true,
          true, '30m',
          'Dr Hennessy', 'GP', 'Rathmines Medical Centre',
          t_code + interval '2 minutes', t_code + interval '7 minutes', t_approved, t_approved + interval '30 minutes',
          t_ended, 'clinician', tired_id,
          'Tired for three weeks. Sleeping well. No bleeding or bruising.',
          'Possibly low iron, or the thyroid dose needs a change. Heart rate regular.',
          'Full blood count, ferritin, thyroid function and INR.',
          'Come back to go through the results.',
          t_ended - interval '1 minute', t_code, t_ended)
  returning id into share_id;

  insert into public.entries (user_id, kind, title, occurs_at, clinician, place, body,
                              is_mental_health, source, session_id, detail, created_at, updated_at)
  values (uid, 'session_notes', 'Session notes', t_ended, 'Dr Hennessy', 'Rathmines Medical Centre',
          concat_ws(E'\n\n',
            'Chief complaint: Tired for three weeks. Sleeping well. No bleeding or bruising.',
            'Assessment: Possibly low iron, or the thyroid dose needs a change. Heart rate regular.',
            'Plan: Full blood count, ferritin, thyroid function and INR.',
            'Follow-up: Come back to go through the results.'),
          false, 'clinician_session', share_id,
          jsonb_build_object(
            'chief_complaint', 'Tired for three weeks. Sleeping well. No bleeding or bruising.',
            'assessment', 'Possibly low iron, or the thyroid dose needs a change. Heart rate regular.',
            'plan', 'Full blood count, ferritin, thyroid function and INR.',
            'follow_up', 'Come back to go through the results.',
            'clinician_name', 'Dr Hennessy',
            'clinician_role', 'GP',
            'clinician_practice', 'Rathmines Medical Centre'),
          t_ended, t_ended)
  returning id into notes_id;

  update public.share_sessions set notes_entry_id = notes_id where id = share_id;

  insert into public.access_events (session_id, patient_id, at, actor, event, detail)
  values
    (share_id, uid, t_code, 'patient', 'code_generated', jsonb_build_object(
       'share_conditions', true, 'share_recent_visits', true, 'share_full_timeline', true,
       'share_care_team', true, 'share_mental_health', false, 'share_documents', false,
       'share_family_history', true, 'share_insurance', false, 'share_medication_notes', true,
       'allow_notes', true, 'duration_kind', '30m', 'appointment_entry_id', tired_id)),
    (share_id, uid, t_code + interval '2 minutes', 'clinician', 'requested', jsonb_build_object(
       'clinician_name', 'Dr Hennessy', 'clinician_role', 'GP', 'clinician_practice', 'Rathmines Medical Centre')),
    (share_id, uid, t_approved, 'patient', 'approved', jsonb_build_object(
       'expires_at', t_approved + interval '30 minutes', 'duration_kind', '30m')),
    (share_id, uid, t_approved + interval '10 seconds', 'clinician', 'section_viewed', '{"section":"overview"}'::jsonb),
    (share_id, uid, t_approved + interval '3 minutes', 'clinician', 'section_viewed', '{"section":"medications"}'::jsonb),
    (share_id, uid, t_approved + interval '6 minutes', 'clinician', 'section_viewed', '{"section":"recent_visits"}'::jsonb),
    (share_id, uid, t_ended, 'clinician', 'notes_saved', jsonb_build_object('entry_id', notes_id)),
    (share_id, uid, t_ended, 'clinician', 'ended', '{"by":"clinician"}'::jsonb);

  -- Documents (E3): two sample letters, tiny PDFs that say they are samples.
  -- Bytes go in private.document_files, as upload_document() stores them.
  file := convert_to($pdf$%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 467 >>
stream
BT /F1 12 Tf 72 760 Td 16 TL
(Sample document for the Trace demo. Not a real patient.) Tj T*
() Tj T*
(Mater Private, Cardiology) Tj T*
(15 June 2026) Tj T*
() Tj T*
(Re: Jane Doe, born 12 March 1991) Tj T*
() Tj T*
(Annual review of atrial fibrillation. Rhythm well controlled.) Tj T*
(INR stable between 2 and 3 on warfarin 5mg each evening.) Tj T*
(No change to treatment. Review again in 12 months.) Tj T*
() Tj T*
(Dr O'Mahony, Consultant Cardiologist) Tj T*
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
828
%%EOF
$pdf$, 'UTF8');
  insert into public.documents (user_id, title, content_type, byte_size, document_date, is_mental_health, created_at)
  values (uid, 'Cardiology review letter', 'application/pdf', octet_length(file), date '2026-06-15', false,
          now() - interval '2 seconds')
  returning id into doc_id;
  insert into private.document_files (document_id, user_id, content_type, byte_size, bytes)
  values (doc_id, uid, 'application/pdf', octet_length(file), file);

  file := convert_to($pdf$%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 537 >>
stream
BT /F1 12 Tf 72 760 Td 16 TL
(Sample document for the Trace demo. Not a real patient.) Tj T*
() Tj T*
(ADHD assessment summary) Tj T*
(20 November 2023) Tj T*
() Tj T*
(Re: Jane Doe, born 12 March 1991) Tj T*
() Tj T*
(The assessment supports a diagnosis of ADHD, inattentive type.) Tj T*
(Plan: methylphenidate XL, Concerta, starting at 18mg each morning) Tj T*
(and increased slowly. Dr O'Mahony confirmed first that her heart) Tj T*
(rhythm is well controlled on warfarin.) Tj T*
() Tj T*
(Dr Byrne, Consultant Psychiatrist) Tj T*
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
898
%%EOF
$pdf$, 'UTF8');
  insert into public.documents (user_id, title, content_type, byte_size, document_date, is_mental_health, created_at)
  values (uid, 'ADHD assessment summary', 'application/pdf', octet_length(file), date '2023-11-20', true,
          now() - interval '1 second')
  returning id into doc_id;
  insert into private.document_files (document_id, user_id, content_type, byte_size, bytes)
  values (doc_id, uid, 'application/pdf', octet_length(file), file);

  -- The full timeline: ten events, 2018 to 2026 (ADHD is new, flagged).
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

  -- Same month as Tonsillitis: an earlier created_at puts it first among
  -- equal dates (the timeline breaks ties by created_at, then by id, which
  -- is random), so the order is the same on every reset.
  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes, is_mental_health,
                                    created_at)
  values (uid, 'condition', 'ADHD diagnosed', date '2023-11-01', 'Dr Byrne', 'Psychiatry, Mater Private',
          'managed', 'Assessed over two appointments. Concerta started at a low dose once Dr O''Mahony confirmed the heart rhythm was well controlled.',
          true, now() - interval '1 second')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Concerta 18mg', 'Each morning, from Jan 2024', m_con, p_con18);

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

  -- No prescription row for "nothing prescribed" (E6): the notes say so.
  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Covid-19', date '2020-12-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Managed at home with rest and fluids. No hospital stay.');

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'condition', 'Atrial fibrillation diagnosed', date '2019-06-01', 'Dr O''Mahony',
          'Cardiology, Mater Private', 'ongoing', 'Irregular heartbeat picked up on an ECG.')
  returning id into ev;
  insert into public.health_event_prescriptions (user_id, event_id, position, name, detail, medication_id, medication_period_id)
  values (uid, ev, 0, 'Warfarin 5mg', 'Daily, ongoing', m_war, p_war);

  insert into public.health_events (user_id, kind, title, occurred_on, clinician, place, outcome, notes)
  values (uid, 'infection', 'Glandular fever', date '2018-02-01', 'Dr Hennessy', 'Rathmines Medical Centre',
          'resolved', 'Sore throat and exhaustion for several weeks. Rest and fluids.');

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
