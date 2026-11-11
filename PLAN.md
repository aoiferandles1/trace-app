# Trace MVP: build plan

This is the handoff plan for building Trace as a working web app. It was written after inspecting the Figma file, the portfolio case study, and the GitHub, Vercel and Supabase accounts. Read it top to bottom once before starting. Section 12 lists the build phases in order.

## 1. What Trace is, and what this MVP is for

Trace is Aoife Randles's Master's project: a health record that an Irish patient owns and shares with a doctor only when they say so. The design is finished in Figma (30 patient screens, 12 clinician portal screens) and written up at `/trace/` on her portfolio. Until now it has only existed as Figma prototypes.

The MVP has two jobs:

1. **Personal use.** Aoife keeps her own real record in it and can share it with a real GP during an appointment.
2. **Portfolio demos.** A visitor (a recruiter, a hiring manager) can try the whole thing in under two minutes with sample data, and never sees Aoife's data.

The heart of the product is one loop, shown on the case study as "One GP visit, from both sides of the desk": the patient generates a 4-digit code, the doctor types it into a web page, the patient sees who is asking and taps Allow, the doctor reads a scoped, read-only record with a timer running, and either side can end it. If that loop works end to end on two real devices, the MVP has succeeded. Everything else supports it.

### Decisions Aoife has already made

- **Scope:** the share loop plus the record. Sign up, home, record and timeline, medications, profile, adding notes, appointments and medications by hand, the full share flow on both sides, the access log, and the doctor's notes saved back to the record. Document upload, scanning and automatic reading are a later phase.
- **Accounts:** a private account for Aoife (email code sign-in, invite-only so strangers cannot create accounts), plus a demo with a seeded Jane Doe record.
- **Doctor side:** no doctor login. The doctor types their name and practice, then the code. The patient sees that name on the access request. In the demo it is pre-filled as Dr Hennessy, Rathmines Medical Centre.
- **Hosting:** Vercel for the app, Supabase for the database and auth.

## 2. Sources of truth

| Source | Where | Use it for |
|---|---|---|
| Figma file `Final-Design-Project-Aoife_Randles` | file key `FIaa9qCUZYAlCpxIs5hC4H` | Every screen's layout, copy, tokens and components. Pages: **Final Screens** (`403:22286`), **Design System** (`451:26`), **Foundations** (`2:2`). Ignore "Archive · old versions" and the Assignment pages. |
| Portfolio case study | `aoiferandles1/aoife-portfolio`, `src/trace.jsx` | The reasoning behind each design decision. When the Figma and a behaviour question disagree, the case study says what was intended. |
| Screen exports | `aoife-portfolio/public/img/trace/*.webp` | 2x exports of every final screen, named exactly like the Figma frames (`p-*` patient, `c-*` clinician). Handy for visual comparison without a Figma call. |
| Portfolio `CLAUDE.md`, "Trace" section | `aoife-portfolio/CLAUDE.md` | Known mistakes in the Figma file (section 11 here repeats them). |

When implementing a screen, pull it from Figma with `get_design_context` (load the `figma-design-to-code` skill first). Treat the returned code as a reference to adapt to this project's components and tokens, not as code to paste.

### Design decisions that must survive into the build

These come from user research and testing, and they are the reason the project is in her portfolio. Do not trade them away for convenience.

- **Consent is asked each time, at the moment of sharing.** "Confirm preferences" is a step in every share, not a settings page. Mental health history is off unless the patient turns it on for this share.
- **Nothing opens until the patient taps Allow.** The code alone grants nothing. Deny sits directly under Allow with equal weight.
- **Critical safety information is always shared and always first.** Allergies and blood type sit in a red strip above everything else, on the patient's record and in the portal. It cannot be toggled off.
- **Medications always travel.** The mental health toggle hides diagnoses, notes and history flagged as mental health. It never hides a medication.
- **The share card only appears on the day of an appointment.** On other days the home screen shows the upcoming visit, not a share button.
- **The patient can always see and stop access.** A timer and "End sharing now" on the session screen, and a banner on home while a session is live.
- **The portal is read-only**, works in any browser with nothing to install, and shows only what the patient chose.
- **The patient gets a log** of what was viewed, and the doctor's notes go back to their record.

## 3. State of the accounts (checked 11 Nov 2026)

- **GitHub `aoiferandles1/trace-app`:** empty apart from this plan. This plan was pushed on `claude/charming-goodall-sivzpd`, which makes that the default branch for now. First build step: create `main` from it and ask Aoife to set `main` as the default branch in the repo settings.
- **Supabase:** one organisation on the free plan, no projects. Create a project named `trace` in **eu-west-1 (Ireland)**. It should quote at $0; the create call handles cost confirmation with Aoife.
- **Vercel:** one Hobby team with one project, `personal-website` (the portfolio). Create a second project for this repo. The connection needed a one-off team authorisation, which Aoife has approved; if a call returns 403, call `authorize_team_access` and show her the link again. Vercel's GitHub app has restricted repository access, so check it can see `trace-app` and, if not, ask Aoife to add the repo to the app's allowed list.
- **Figma:** full access to the file. Variables, components and all frames are readable.

Do not write Aoife's email address, any key, or any real health data into the repo. The invite allowlist lives in the database (section 6).

## 4. Stack

- **Next.js** (current stable, App Router) with **TypeScript**, deployed on Vercel. The portal needs server-side code that holds a secret and checks every request, which is why this is not a static Vite app like the portfolio.
- **Supabase**: Postgres with row-level security, Auth (email one-time code, plus anonymous sign-in for the demo), Realtime (the patient's phone hears about an access request the moment it happens). Use `@supabase/ssr` for cookie-based sessions.
- **Tailwind CSS** with the Figma variables mapped to CSS custom properties (section 5). No component library: the UI kit in Figma is small and specific, so build its components directly.
- **Fonts:** Sora and DM Sans through `next/font/google`.
- **Icons:** the Figma icons look like Lucide (file-plus, camera, calendar, pill, syringe, users, receipt, bell). Confirm against the Design System page and use `lucide-react` if they match.
- **Tests:** Playwright for the end-to-end loop, plus SQL tests for the access rules.

Schema changes go through migration files in `supabase/migrations/` and are applied with the Supabase migration tool, never as ad-hoc SQL, so the repo always describes the database.

## 5. Design tokens

Read from Figma variables on the final screens. Mirror these names in CSS so a Figma value can be traced to code. Pull the complete set from **Foundations** (`2:2`: Colour `16:2`, Typography `7:31`, Spacing & Radius `7:63`, Shadows `7:128`) before building components; this table is what was confirmed during planning.

| Token | Value |
|---|---|
| Brand/Indigo | `#5B7AE8` |
| Indigo/Accessible (buttons with white text) | `#5469CF` |
| Indigo/Text, indigo/600 | `#4258CB` |
| Indigo/Surface-Dark (full-bleed indigo screens) | `#3A4EBF` |
| indigo/700 | `#2E40A0` |
| Brand/Indigo Tint, Status/Info Tint | `#F2F5FE` |
| Brand/Navy | `#1A2D4F` |
| Brand/Teal, teal/700, Teal Tint | `#00A896`, `#00665B`, `#E5F5F3` |
| Brand/Peach, peach/700, Peach Tint | `#E8906B`, `#8E5439`, `#FEF0E7` |
| Status/Danger, red/700 | `#D85A4A`, `#832E22` |
| Text/Primary, Secondary, Tertiary | `#0C1927`, `#8A94A3`, `#5C677A` |
| Surface/Page, Card, Sunken | `#F8F7FB`, `#FFFFFF`, `#EFEDF5` |
| Border/Default, Strong | `#E1E4EA`, `#C8CED8` |
| Radius | XS 6, SM 10, Card Tight 14, Card 16, Pill 24 (Tight 22, Loose 26) |
| Spacing | 8, 12, 16, 20, 24, 32, 48 |
| Shadow/Card | `0 4px 20px rgba(91,122,232,.06)` |
| Shadow/LG | `0 12px 40px rgba(60,40,30,.10)` |
| Display/SM | Sora Light 32, tracking -1 |
| H3 / H4 | DM Sans Medium 20, tracking -0.5 / DM Sans Bold 16, tracking -0.5 |
| Body/Small / Body/Tiny | DM Sans Regular 14, line-height 1.5 / 12, line-height 1.4 |
| Label | DM Sans Medium 12, tracking 2, uppercase |
| Button/Medium / Small | DM Sans Medium 14 / 13 |

`Text/Secondary` (`#8A94A3`) on white is about 3:1, which fails WCAG AA for body text. See section 10.

## 6. Architecture

### Routes

Patient app (phone-first, designed at 390 wide):

| Route | Figma frame | Notes |
|---|---|---|
| `/` | `p-splash`, `p-login` | Welcome. "Create your record", "I already have an account", and a "Try the demo" entry (new, see section 9). |
| `/signup/*` | `p-create`, `p-verify`, `p-about`, `p-medical`, `p-privacy`, `p-profiles`, `p-welcome` | The seven steps, one route each, with the progress bar. Resumable: store the step reached. |
| `/login` | reuse `p-create` and `p-verify` | Email, then code. No Figma frame of its own. |
| `/home` | `p-home`, `p-apptday`, `p-home-live` | One screen, three states (section 7). |
| `/record` | `p-record` | The "Timeline" tab. Critical strip, ongoing conditions, timeline by year. |
| `/record/[id]` | none | Entry detail. See gaps. |
| `/meds` | `p-meds`, `p-meds-expired` | Current and Expired tabs, expandable cards. |
| `/add`, `/add/note`, `/add/appointment`, `/add/medication` | `p-add` (tiles only) | Forms have no Figma frames. See gaps. |
| `/profile` | `p-profile` | Details, care team, edit, sign out, export, delete. |
| `/share` | `p-prefs` | Confirm preferences. |
| `/share/code` | `p-code` | The code and its 5-minute countdown. |
| (overlay) | `p-request` | Bottom sheet over whatever screen is open when a request arrives. |
| `/session` | `p-active`, `p-paused` | Live session, and "Time's up". |
| `/session/ended` | `p-ended` | Summary. |
| `/access-log` | none | See gaps. |

Clinician portal (desktop-first, designed at 1728 wide), all under `/view` because the patient's screen tells the doctor to go to `trace.health/view`:

| Route | Figma frame |
|---|---|
| `/view` | `c-loading`, then the name step (new), then `c-code` with `c-code-error`, `c-code-locked`, `c-code-expired`, then `c-waiting`, `c-denied`, `c-opening` |
| `/view/session` | `c-overview` (use `1482:24077`, the one with the critical strip), `c-timeline`, `c-meds`, a care team view (new), and `c-end` |

The "First time using Trace?" accordion under the code card has real content in the Design System page (`How it works` `140:5817`, `What you'll see` `140:5858`, `For your practice` `140:5653`, `Privacy and security` `140:5774`). Build it as static content.

Demo: `/demo` shows the patient app in a phone frame beside the portal in a laptop frame, on one screen, so a visitor can play both sides (section 9).

### Layout rules

- Patient app: full width up to about 480px. Wider than that, centre a 390 to 430px column on `Surface/Page`. Do not draw a fake iOS status bar (the 9:41 row in the Figma frames is device chrome, not design).
- Portal: fluid from 1024px up, matching the Figma proportions (256 sidebar, 330 notes panel). Below 1024px, stack: the sidebar becomes a row of tabs and the notes panel moves under the record. A GP may well open it on a tablet.

### Data model

All tables live in `public` with row-level security on. Patient-owned tables carry `user_id uuid references auth.users on delete cascade` and one policy family: a user can read and write only their own rows.

- **`profiles`** (`id` = auth user id): `first_name`, `last_name`, `date_of_birth`, `sex`, `country`, `city`, `address`, `phone`, `blood_type`, `allergies text[]`, `implants text[]`, `email_reminders`, `terms_accepted_at`, `onboarding_step`, `is_demo`, timestamps. Check `p-about` for the full field list (the frame scrolls past Country).
- **`conditions`**: `name`, `status` (`managed`, `ongoing`, `resolved`), `clinician`, `specialty`, `diagnosed_year`, `diagnosed_note` (for "since childhood"), `is_mental_health`.
- **`medications`**: `name`, `dose`, `form`, `frequency`, `timing`, `drug_class`, `prescriber`, `prescriber_org`, `indication`, `started_on`, `ended_on`, `instructions`, `refill_due_on`. Current means `ended_on` is null or in the future. No mental health flag, on purpose.
- **`entries`** (the timeline, and appointments): `kind` (`visit`, `result`, `prescription`, `note`, `letter`, `imaging`, `vaccination`, `session_notes`), `title`, `occurs_at timestamptz`, `clinician`, `place`, `body`, `is_mental_health`, `source` (`patient`, `clinician_session`), `session_id` nullable. A `visit` with `occurs_at` in the future is an upcoming appointment; one dated today drives the share card.
- **`care_team`**: `name`, `role`, `organisation`, `kind` (`gp`, `specialist`, `pharmacy`).
- **`vitals`**: `recorded_on`, `systolic`, `diastolic`, `heart_rate`, `weight_kg`, `spo2`. Seeded for the demo so the portal's "Last recorded vitals" matches Figma. There is no patient screen for entering vitals, so for a real account the portal hides that block when the table is empty.
- **`share_sessions`**: one row per share attempt. `patient_id`, `status`, `code`, `code_expires_at`, the preferences chosen (`share_conditions`, `share_recent_visits`, `share_full_timeline`, `share_care_team`, `share_mental_health`, `allow_notes`), `duration_kind` (`30m`, `1h`, `all_day`, `manual`), `clinician_name`, `clinician_role`, `clinician_practice`, `portal_token_hash`, `requested_at`, `request_expires_at`, `approved_at`, `expires_at`, `ended_at`, `ended_by` (`patient`, `clinician`, `timeout`), `appointment_entry_id`, and the notes draft (`chief_complaint`, `assessment`, `plan`, `follow_up`).
- **`access_events`**: `session_id`, `patient_id`, `at`, `actor` (`patient`, `clinician`, `system`), `event`, `detail jsonb`. Events: `code_generated`, `requested`, `approved`, `denied`, `section_viewed` (with the section name), `notes_saved`, `extended`, `paused`, `ended`. This is the patient's access log. Insert-only; the patient can read their own.
- **`portal_attempts`**: `portal_token_hash`, `ip_hash`, `at`, `ok`. For rate limiting code guesses. No policies (server only).
- **`allowed_emails`**: `email`. The invite list. No policies (server only). Aoife's address is inserted at setup, not committed.

### The share session state machine

All transitions happen inside Postgres functions, so the rules live in one place and cannot be skipped by a client.

```
code_issued ── correct code typed in the portal, within 5 min ──▶ requested
code_issued ── 5 min pass ──▶ expired
requested ── patient taps Allow ──▶ active        (expires_at set from the chosen duration)
requested ── patient taps Deny ──▶ denied
requested ── doctor cancels ──▶ code_issued       (Figma: "The patient keeps their code and can still share later")
requested ── 5 min with no answer ──▶ expired
active ── expires_at passes ──▶ paused            ("Time's up": the record is hidden until the patient decides)
paused ── patient adds 15 or 30 min ──▶ active
paused ── patient taps Save and end, or 30 min pass ──▶ ended
active ── patient taps End sharing now, or doctor ends session ──▶ ended
```

- Time-based transitions are evaluated lazily: every function that reads a session first moves it to the right state for the current time. No background job is needed.
- A patient has at most one live session. Generating a new code cancels the old one ("Regenerate").
- A code is four random digits, unique among live codes (partial unique index on `code` where `status = 'code_issued'`; retry on conflict).
- On `ended`: if `allow_notes` is on and any note field has text, write one `entries` row of kind `session_notes` carrying the four fields and the clinician's name, then log the event.
- `duration_kind`: `30m` and `1h` are literal, `all_day` ends at 23:59 local time, `manual` has no timer but is capped at 12 hours.

### Who can call what

Patient side, called from the browser as the signed-in user (functions check `auth.uid()`):
`create_share_code(prefs)`, `respond_to_request(session_id, allow)`, `extend_session(minutes)`, `end_session()`, `seed_demo_record()` (anonymous users only, for themselves).

Portal side, callable **only by the server** with the secret key (revoke execute from `anon` and `authenticated`):
`portal_submit_code(code, clinician_name, clinician_role, clinician_practice, portal_token_hash, ip_hash)`, `portal_cancel_request`, `portal_status`, `portal_get_record(portal_token_hash, section)`, `portal_save_notes`, `portal_end_session`.

`portal_get_record` is the single place that decides what a doctor sees. It returns nothing unless the session is `active` right now, and it applies the scope:

| Section | Returned when |
|---|---|
| Critical safety (allergies, blood type, implants), patient name, age, sex | always |
| Medications (current and expired) | always |
| Conditions | `share_conditions`, minus `is_mental_health` rows unless `share_mental_health` |
| Timeline | the 3 most recent past entries if `share_recent_visits`; all of them if `share_full_timeline`; minus `is_mental_health` rows unless `share_mental_health`; never kind `note` |
| Upcoming visits | with the timeline |
| Care team | `share_care_team` |
| Documents, Insurance | never in the MVP. The portal sidebar shows them locked with "Not shared", as in Figma |

Every call logs a `section_viewed` event.

### How the portal talks to the database

The doctor has no account, so the portal's browser never talks to Supabase directly.

1. On first load the server sets an httpOnly, Secure, SameSite=Lax cookie holding a random 256-bit portal token. Only its SHA-256 hash is ever stored.
2. Route handlers under `/api/portal/*` read the cookie, hash it, and call the portal functions with the Supabase secret key. The secret key exists only in Vercel's server environment.
3. The portal polls `portal_status` every 2 seconds while waiting for approval and every 5 seconds during a live session, so a patient ending the session closes the portal within seconds. Polling is enough here; do not add Realtime to the portal.

Guessing codes: a correct guess only produces an access request on the patient's phone, showing the name the guesser typed. It never opens a record. On top of that, lock a portal token after 5 wrong codes for 15 minutes (`c-code-locked`) and cap attempts per IP hash at 20 an hour. To tell "expired" from "wrong", check whether the code matches a session that expired in the last 30 minutes (`c-code-expired`); anything else is `c-code-error`.

### How the patient app talks to the database

- Reads and writes of the patient's own rows go straight from the browser through Supabase with the publishable key, guarded by row-level security.
- The app layout subscribes to Realtime changes on the user's own `share_sessions` row (add the table to the realtime publication). When status becomes `requested`, the access request sheet opens over the current screen. Also poll every 3 seconds while `/share/code` is open, as a fallback.
- Timers on screen count down from `expires_at` and `code_expires_at`. The database decides what is true; the screen only displays it.

### Auth

- **Real accounts:** email one-time code with `signInWithOtp`. Edit the email template to send the code (`{{ .Token }}`), not a magic link. **Supabase codes are 6 to 10 digits, so the verify screen needs six boxes, not the four in `p-verify`.** This is the one place the build cannot match Figma.
- **Invite-only:** sign-ups must stay enabled (the demo depends on anonymous sign-in), so block uninvited emails with a Before User Created auth hook: a Postgres function that allows anonymous users and any email found in `allowed_emails`, and rejects the rest. If that hook is not available on the free plan, do the check in a server route before calling the admin API to create the user, and have the client call `signInWithOtp` with `shouldCreateUser: false`.
- **Email delivery:** Supabase's built-in sender is heavily rate limited and only delivers to the organisation's own members. That covers Aoife. If she ever invites someone else, set up custom SMTP first.
- **Demo:** `signInAnonymously()`, then `seed_demo_record()` (section 9).
- **Session length:** keep Supabase's defaults. Add a visible Sign out in Profile.

## 7. Screen behaviour that the frames do not spell out

**Home, three states.** Normal (`p-home`): an "Upcoming" card for the next visit with days to go. Appointment day (`p-apptday`): the indigo card with "Share your record now", shown when a `visit` entry falls on today's date in the browser's time zone and no session for it has ended. Live (`p-home-live`): a banner across the top and a "Sharing in progress" card, both with the time left, both leading to `/session`. The stat tiles are real counts: entries added this calendar month, current medications, days until the nearest `refill_due_on` (hide that tile when there is none). The greeting follows the local hour and the date is today's.

**Share flow.** `/share` opens from the appointment-day card with the GP visit defaults: Critical safety and Medications locked on, Active conditions on, Recent visits (last 3) on, Full timeline off, Care team on, Mental health off, 30 min, Doctor can add session notes on. "Generate share code" calls `create_share_code` and moves to `/share/code`. When the doctor submits the code, the request sheet shows the name, role and practice they typed, the duration, and exactly which sections they will see, built from this session's preferences. Allow goes to `/session`; Deny returns home.

**Record.** Conditions and timeline entries open a detail view. Timeline grouped by year, newest first, with the dot colour and tag by kind as in Figma.

**Portal.** After approval, `c-opening` plays briefly while the first sections load, then the overview. The header shows the name, role and practice the doctor entered. The LIVE banner shows the patient's name, the profile ("GP visit profile") and the time left. The notes panel is present only when `allow_notes` is on; it autosaves the draft a moment after typing stops, and "Save notes" saves at once. "End session" leads to `c-end` (duration, start time, sections shared, the notes to review), and its "End session" button closes access on both sides.

## 8. Gaps: things the MVP needs that Figma does not have

Build each of these from the existing UI kit (Design System page: `02 · Actions & Forms` `829:3727`, `03 · Navigation` `838:3390`, `04 · Status & Feedback` `841:3165`, `05 · Records & Data` `842:2944`, `06 · Cards & Containers` `843:2523`, `07 · Patterns & Screens` `844:1749`, including "Document Detail Recipes" `69:2095` for detail views). Match the nearest existing screen's structure. Keep new copy short and plain, in the voice of the existing screens, with no em dashes.

**List every new screen and every new string in `docs/REVIEW.md`** so Aoife can check the design and rewrite the words. She is the designer; these are stand-ins until she has seen them.

Patient app:
1. Sign in (email, then code).
2. Add note, Log appointment, Add medication forms. The note and appointment forms each have an "About mental health" switch that sets `is_mental_health`. The medication form does not, because medications are always shared.
3. Add and edit a condition, reached from "Ongoing conditions" on the record. Also has the mental health switch.
4. Entry detail, condition detail, with edit and delete.
5. Edit profile, including the critical safety fields.
6. Care team: add, edit, remove, from Profile.
7. Access log: sessions newest first, each with who, when, how long, what was shared, and the events inside it.
8. Session notes view (from "Session notes · View" on the ended screen, and as a timeline entry).
9. Sign out, Export my data (a JSON download of every row the user owns), Delete my account (confirm, then delete the auth user so everything cascades). The sign-up privacy screen promises all three, so they are part of the MVP.
10. Empty states for a brand-new record: home, record, meds.

Portal:
11. The name step: name, role, practice, before the code. Remember them in the browser for next time.
12. Care team view.
13. Access paused (the patient's timer ran out and they have not decided yet).
14. Session ended by the patient. Any saved notes still go to the record.
15. Request timed out (the patient did not answer in 5 minutes).
16. Layout below 1024px.

Demo:
17. The "Try the demo" entry on the welcome screen, the `/demo` two-device page, the "Demo · sample data" marker, and "Reset demo".

## 9. Demo mode

- "Try the demo" signs the visitor in anonymously and calls `seed_demo_record()`, which fills their own private copy of Jane Doe's record. Each visitor gets a separate sandbox, so two people demoing at once cannot collide, and nobody can see or change anyone else's data.
- The seed is Jane Doe exactly as the final screens show her, with dates relative to today so the story always works: a GP visit with Dr Hennessy at Rathmines Medical Centre **today at 9:30** (so the share card is showing), a blood test 9 days ago, a personal note 11 days ago, a Warfarin renewal 12 days ago, a cardiology review about 6 weeks ago, two upcoming visits, three conditions, three current and two expired medications, the care team, one set of vitals, Penicillin allergy and blood type A+. Read the exact names, doses and wording from the frames. Use the corrected values from section 11, not the mistakes.
- Demo sessions show a small "Demo · sample data" marker, and the sign-up steps are skipped.
- `/demo` puts the patient app in a phone frame and the portal in a laptop frame side by side (two same-origin iframes), with one line of guidance: start on the phone, share the record, then type the code into the portal. The portal's name step is pre-filled with Dr Hennessy, GP, Rathmines Medical Centre. Below about 1100px wide, show the patient app alone with a link that opens the portal in a new tab.
- "Reset demo" re-runs the seed.
- A daily Vercel cron route (protected by `CRON_SECRET`) deletes anonymous users older than 24 hours. It also touches the database every day, which matters: **free Supabase projects pause after a week without activity**, and a paused database would break the portfolio demo. Hobby cron jobs can run once a day, which is all this needs.

## 10. Accessibility

Aoife is an accessibility specialist, and the case study says plainly that this project predates that and needs an audit of "text sizes, tap targets and button contrast". The build should not ship the problems she already knows about. Target WCAG 2.2 AA.

- Check every text and background pair against the tokens. Known problem: `Text/Secondary` `#8A94A3` on white. Use `Text/Tertiary` `#5C677A` for any text that carries meaning, and record each substitution in `docs/REVIEW.md`. Use `Indigo/Accessible` for filled buttons with white text.
- Tap targets at least 44 by 44px, including the timeline chevrons, the tab bar and the code boxes.
- Real form labels, error messages tied to their fields, and errors that say what is wrong in words, not only in red.
- Code inputs (sign-in and the portal's 4 boxes): one logical field for assistive tech, paste support, `inputmode="numeric"`, `autocomplete="one-time-code"` for the email code.
- The access request sheet is a modal dialog: focus moves in, is trapped, and returns on close. Allow and Deny are both real buttons with clear names.
- Timers: do not announce every second. Announce the session starting, 5 minutes left, 1 minute left, and ended, through a polite live region.
- Status is never colour alone (the LIVE pill, condition status tags, the critical strip all have text).
- Visible focus rings everywhere, `prefers-reduced-motion` respected, zoom to 200% and reflow at 320px without loss.
- Run axe in the Playwright suite on every main screen and fail the build on violations.

## 11. Honesty: Figma mistakes and claims the MVP cannot yet back up

Known mistakes in the Figma file. The app is data-driven, so most disappear, but the seed and any static text must use the right values:
- Portal sidebar placeholders "Patient Name / Age · Sex · DOB" should be the real patient. Initials for Jane Doe are "JD", not "MO". Session notes that say "Maria" mean Jane.
- Drug class tags: Warfarin is an Anticoagulant, Levothyroxine is Thyroid, Salbutamol is a Bronchodilator. Ignore "Stimulant" on Apixaban and "Thyroid" on Salbutamol.
- "UPCOMMING" is "UPCOMING".
- Leave out the portal's Documents screen (`c-documents-specialist`).
- Use `c-overview` `1482:24077`, not `c-overview-no-strip`.

Claims in the design that are not true of this MVP. Each needs a truthful stand-in, listed in `docs/REVIEW.md` for Aoife:
- Portal footer "End-to-end encrypted · Access audited": the MVP encrypts in transit and at rest and logs access, but it is not end-to-end encrypted. Use "Encrypted in transit · Access logged".
- Privacy step "Trace staff cannot access your health record": whoever runs the database can. Fine while the only real user is Aoife herself, but reword before anyone else is invited.
- The "Verified" badge on the profile: nothing verifies identity. Leave it out.
- PPS number on the profile: do not collect it.
- "Request repeat prescription": there is no pharmacy to send it to. Leave the button out.
- The doctor's identity is typed, not verified. The request sheet should not imply otherwise. (The case study lists clinician verification as the first thing to build next.)
- Add one line on the welcome screen and in the portal footer saying Trace is a portfolio project by Aoife Randles and not a medical service, linking to the case study. "Read full terms" opens a short plain page saying the same and what is stored.

Things in the design that are out of scope: hide them rather than leave dead controls. The Add tiles for Upload document, Scan or photograph, Record a vaccination, Family history and Upload a receipt; the "Upload doc" quick action; the Documents and Insurance switches on Confirm preferences; the notification bell; "Or scan their QR code instead"; "Add Emergency and Specialist profiles later"; the lock-screen states (`p-lock-active`, `p-lock-ended`), which a web app cannot draw.

## 12. Build phases

Work in this order. Each phase ends with something that can be checked, and the app should be deployable at the end of every phase.

**Phase 0: Foundations.** Scaffold Next.js and Tailwind. Create the Supabase project (eu-west-1) and the Vercel project linked to this repo, with `main` as the production branch. Environment variables in Vercel and `.env.example` in the repo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `CRON_SECRET`, `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`. Write a short `CLAUDE.md` and README for the repo. *Done when:* a placeholder page is live on the Vercel URL and reads one row from Supabase.

**Phase 1: Tokens and UI kit.** Map the Figma variables to CSS. Build the shared components from the Design System page: buttons, inputs, switches, chips and tags, cards, the tab bar, headers, the bottom sheet, the critical strip, the timeline item, the medication card, the portal sidebar, header and notes panel. *Done when:* a `/kit` page (development only) shows every component in every state and passes axe.

**Phase 2: Database and access rules.** All tables, policies, the state machine functions and the portal functions, as migrations. SQL tests proving: a user cannot read another user's rows; portal functions cannot be called with the publishable key; `portal_get_record` returns nothing unless the session is active; each preference switch hides exactly what it should; mental health rows stay hidden when the switch is off while medications still come through; time moves a session through `expired`, `paused` and `ended` correctly. Run Supabase's security advisors and fix what they report. *Done when:* the tests pass and the advisors are clean.

**Phase 3: Auth and onboarding.** Email code sign-in, the invite hook, the seven sign-up steps writing to `profiles`, sign out. *Done when:* an allowlisted email can sign up and land on an empty home, and any other email is refused with a clear message.

**Phase 4: The record.** Home (normal state), record and timeline, medications, profile, and the add and edit forms from section 8. *Done when:* starting from an empty account, a person can enter the whole of Jane Doe's record by hand and every screen matches its frame.

**Phase 5: The share loop, patient side.** Appointment-day home, Confirm preferences, the code screen, the request sheet with Realtime, the live session, Time's up, ended, the live home state, the access log. *Done when:* the loop can be driven end to end by calling the portal functions by hand.

**Phase 6: The portal.** The name step, code entry and all its states, waiting, denied, opening, overview, timeline, medications, care team, notes, end session, and the new states from section 8. *Done when:* the full loop works across a phone and a laptop on the deployed site, and ending on either side closes the other within 5 seconds.

**Phase 7: Demo mode.** Anonymous sign-in, the seed, the marker, reset, `/demo`, and the daily cleanup cron. *Done when:* a first-time visitor can go from the welcome screen to a doctor reading Jane's record in under two minutes without typing anything but the code.

**Phase 8: Hardening.** The Playwright suite (below), the axe pass, export and delete, error and offline states, a review on real phones (iOS Safari and Android Chrome), and `docs/REVIEW.md` complete. *Done when:* everything in section 13 is true.

**Phase 9: Launch.** Hand `docs/REVIEW.md` to Aoife. Custom domain if she wants one (suggestion: `trace.aoiferandles.com`, which needs a DNS record on her domain; the copy on the code screen should show whatever the real portal address is). Linking the live app from the portfolio's `/trace/` page is a change to her case study copy, so it waits for her words and her go-ahead; do not edit the portfolio repo before then.

### End-to-end tests (Playwright, two browser contexts: patient and doctor)

1. Happy path: share, type the code, Allow, the doctor sees the overview, writes notes, ends the session, and the notes appear on the patient's timeline and in the access log.
2. Deny: the portal shows "Your patient chose not to share their record".
3. Wrong code, then too many attempts, then an expired code.
4. Scope: with Active conditions off, the portal shows no conditions. With a mental-health condition and the switch off, it is absent, and every medication is still there.
5. The patient ends early: the portal loses access within 5 seconds, and a direct request for record data after that returns nothing.
6. Time's up: the portal loses the record, the patient adds 15 minutes, and the portal gets it back.
7. A second signed-in user cannot read the first user's data by any route.
8. Demo: two anonymous visitors get separate records.

## 13. Definition of done

- Aoife can sign in with her own email, build her real record, log an appointment for today, and share it with a GP's browser. Nobody else can create a real account.
- A visitor can run the whole loop in the demo, alone on one laptop or across a phone and a laptop.
- A doctor's browser can never read anything outside an active, approved session, or outside what the patient switched on. This is proven by tests, not assumed.
- Both sides see the session end within seconds of either ending it, and when the timer runs out.
- The patient has an access log, and the doctor's notes reach the record.
- Every screen that has a Figma frame matches it at 390 wide (patient) and 1440 to 1728 wide (portal), apart from the differences this plan calls for.
- WCAG 2.2 AA holds on every screen, with axe in CI.
- No secret, no real email address and no real health data is in the repo. The secret key is only in Vercel's server environment.
- `docs/REVIEW.md` lists every new screen, every new string and every contrast substitution for Aoife.

## 14. Later, not now

In rough order of value: document upload and review (`p-upload`, `p-review`, `p-saved`), then scanning and automatic reading (`p-reading`), which means sending documents to an AI service and needs its own privacy decision; clinician verification against the Medical Council, CORU or NMBI registers; an emergency card and next-of-kin approval; Emergency and Specialist share profiles; vaccinations, family history, receipts and insurance; QR sharing; lock-screen controls through a PWA and web push; repeat prescription requests.

## 15. Open questions for Aoife

None of these block the build. Each has a default the builder should use until she says otherwise.

| Question | Default |
|---|---|
| The email code has to be 6 digits (a Supabase limit). OK to show six boxes where Figma shows four? | Six boxes, same style. |
| Sharing only starts from the appointment-day card. For personal use, is logging an appointment for today (two taps) an acceptable way in, or should there be a second route from Profile? | Appointment-day card only, as designed. |
| Are personal notes ever shared with a doctor? The portal frames leave them out. | Never shared in the MVP. |
| Out-of-scope features: hidden, or shown as "coming later"? | Hidden. |
| Wording for the claims in section 11, and all new copy. | The stand-ins in `docs/REVIEW.md`. |
| How long can "Time's up" wait before the session closes itself, and how long can a Manual session run? | 30 minutes, and 12 hours. |
| Custom domain? | The Vercel URL until she chooses. |
| When, and in what words, the portfolio links to the live app. | No change to the portfolio. |
