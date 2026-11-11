# Trace database: the contract

This is everything the app needs to know about the database. It describes what each table lets the browser do, and what every function takes, returns and raises. If something here disagrees with the SQL in `migrations/`, the SQL wins and this file has a bug.

Supabase project: `trace` (`tpqzmwtcgfgjhursxpsf`, eu-west-1). Generated types: `types/database.types.ts`. Pass them as the client generic (`createBrowserClient<Database>(...)`). Every function returns `Json` in the types; the shapes below are what is inside.

## Contents

1. [Ground rules](#1-ground-rules)
2. [Tables: what the browser may read and write](#2-tables-what-the-browser-may-read-and-write)
3. [The share session](#3-the-share-session)
4. [Patient functions](#4-patient-functions)
5. [Portal functions](#5-portal-functions)
6. [Account and demo functions](#6-account-and-demo-functions)
7. [Sign-up and the invite list](#7-sign-up-and-the-invite-list)
8. [Worked example: one GP visit](#8-worked-example-one-gp-visit)
9. [Operations: secrets, invites, tests](#9-operations-secrets-invites-tests)

---

## 1. Ground rules

**Who calls what**

| Caller | Supabase client | May use |
|---|---|---|
| Patient browser (signed in, including anonymous demo users) | `createClient()` from `@/lib/supabase/client`, publishable key + the user's session | Own rows in the tables below (through RLS), the patient functions, `seed_demo_record`, `delete_my_account`, `export_my_data` |
| Next.js server, portal routes `/api/portal/*` | Publishable key; with or without a user session (both work) | The `portal_*` functions, always with `server_secret` first |
| Next.js server, cron route | Publishable key | `cleanup_demo_users(server_secret)` |
| Doctor's browser | None. It never talks to Supabase | Nothing |
| Not signed in, publishable key only | | Nothing. Every table refuses (`permission denied`); every patient function refuses |

**Errors.** Every error this database raises on purpose has a short machine code as its `message`, for example `session_live`. With supabase-js that is `error.message`. Branch on `error.message`, never on the HTTP status: PostgREST maps the codes to different statuses (401, 403, 400 and 500 all occur). Some errors also carry a human `details` (the SQL `DETAIL`) or `hint`. Any other message (a constraint name, `permission denied for ...`) means a bug or an attack, not a state the screens should design for.

**Time.** All timestamps are `timestamptz`, returned as ISO strings in UTC. The database decides every time-based state. Screens count down from the timestamps they are given, and must not decide on their own that something has expired. "Today" and "23:59" mean Irish time (`Europe/Dublin`).

**Lazy transitions.** Nothing runs on a timer. Every function that reads a session first moves it to the state the clock says it is in (an unused code expires, a request times out, an active session pauses, a paused session ends). So the portal's polling (`portal_status`) and the patient's `my_share_session()` are what move time forward. A realtime update follows each such change.

**Never in the repo:** the server secret, any real email address, any real health data.

---

## 2. Tables: what the browser may read and write

All tables are in `public` with row-level security on. The browser can only ever see or change rows that belong to the signed-in user. `user_id` defaults to the caller, so inserts can leave it out.

| Table | Browser may | Notes |
|---|---|---|
| `profiles` | select, update own row (`id = user id`) | Created automatically when the auth user is created; never insert. Deleted with the user. `id`, `is_demo` and `created_at` cannot be changed (raises `read_only_field`). |
| `conditions` | select, insert, update, delete own | |
| `medications` | select, insert, update, delete own | No mental health flag, on purpose. |
| `entries` | select, insert, update, delete own | The browser can only write `source = 'patient'` entries, never `kind = 'session_notes'`, never `session_id` or `detail` (raises `session_notes_read_only`). Session notes written by a doctor can be read and deleted; only their `is_mental_health` can be changed. |
| `care_team` | select, insert, update, delete own | |
| `vitals` | select, insert, update, delete own | No patient screen writes these yet; the demo seeds one row. |
| `share_sessions` | **select only**, own (`patient_id`) | Every change goes through a function. In the realtime publication. |
| `access_events` | **select only**, own (`patient_id`) | The access log. Written only by functions. |

There is no view and no other table the app needs. The `private` schema (invite list, server-secret hash, portal attempts, portal token bindings) is not reachable through the API at all.

### Columns and allowed values

**`profiles`**: `id uuid`, `first_name`, `last_name` (text, up to 100), `date_of_birth date`, `sex` (text, up to 40), `country`, `city` (up to 100), `address` (up to 300), `phone` (up to 40), `blood_type` (one of `A+ A- B+ B- AB+ AB- O+ O-`, or null for "not known"), `allergies text[]` (default `{}`), `implants text[]` (default `{}`), `email_reminders boolean` (default false), `terms_accepted_at timestamptz`, `onboarding_step` (one of `about`, `medical`, `privacy`, `profiles`, `welcome`, `done`; default `about`; the sign-up steps after the code), `is_demo boolean` (true for anonymous users; read-only), `created_at`, `updated_at`.

**`conditions`**: `id`, `user_id`, `name` (required, up to 200), `status` (`managed`, `ongoing`, `resolved`; default `ongoing`), `clinician`, `specialty` (up to 200), `diagnosed_year integer` (1900 to 2200), `diagnosed_note` (up to 200, for "since childhood"), `is_mental_health boolean` (default false), `created_at`, `updated_at`.

**`medications`**: `id`, `user_id`, `name` (required, for example `Warfarin`), `dose` (`5mg`), `form` (`Tablet`), `frequency` (`once daily`), `timing` (`evening`), `drug_class` (`Anticoagulant`), `prescriber` (`Dr O'Mahony`), `prescriber_specialty` (`Cardiology`), `prescriber_org` (`Mater Private`), `indication`, `started_on date`, `ended_on date`, `instructions` (up to 2000), `refill_due_on date`, `created_at`, `updated_at`. **Current** means `ended_on` is null or today or later; **expired** means `ended_on` is before today.

**`entries`** (the timeline and appointments): `id`, `user_id`, `kind` (`visit`, `result`, `prescription`, `note`, `letter`, `imaging`, `vaccination`, `session_notes`), `title` (required, up to 300), `occurs_at timestamptz` (required), `clinician`, `place` (up to 200), `body` (up to 20000), `is_mental_health boolean`, `source` (`patient` or `clinician_session`), `session_id uuid` (session notes only), `detail jsonb` (session notes only, see below), `created_at`, `updated_at`.
- A `visit` with `occurs_at` in the future is an upcoming appointment. One dated today (Irish time) drives the appointment-day card.
- `note` entries are personal and are **never** returned to a doctor.
- A `session_notes` entry has `title` "Session notes", `occurs_at` = when the session ended, `clinician` = the doctor's typed name, `place` = their typed practice, `body` = the non-empty fields as plain text ("Chief complaint: ...\n\nAssessment: ..."), and `detail`:
  `{ "chief_complaint": string|null, "assessment": string|null, "plan": string|null, "follow_up": string|null, "clinician_name": string|null, "clinician_role": string|null, "clinician_practice": string|null }`.

**`care_team`**: `id`, `user_id`, `name` (required), `role` (for example `GP`, `Cardiology`, `Pharmacy`), `organisation`, `kind` (`gp`, `specialist`, `pharmacy`; default `gp`), `created_at`, `updated_at`.

**`vitals`**: `id`, `user_id`, `recorded_on date` (required), `systolic`, `diastolic`, `heart_rate`, `spo2` (integers), `weight_kg numeric`, `created_at`, `updated_at`. For a real account the portal should hide "Last recorded vitals" when there are none.

**`share_sessions`**: see [section 3](#3-the-share-session).

**`access_events`**: `id bigint`, `session_id uuid` (null never happens today, but allow it), `patient_id`, `at timestamptz`, `actor` (`patient`, `clinician`, `system`), `event`, `detail jsonb`. Events and their `detail`:

| event | actor | detail |
|---|---|---|
| `code_generated` | patient | the preferences: `share_conditions`, `share_recent_visits`, `share_full_timeline`, `share_care_team`, `share_mental_health`, `allow_notes`, `duration_kind`, `appointment_entry_id` |
| `requested` | clinician | `clinician_name`, `clinician_role`, `clinician_practice` (as typed) |
| `request_cancelled` | clinician | `{}` (the doctor backed out; the code is live again) |
| `approved` | patient | `expires_at`, `duration_kind` |
| `denied` | patient | `{}` |
| `expired` | system | `stage`: `"code"` (nobody typed the code within 5 minutes) or `"request"` (the patient did not answer within 5 minutes) |
| `cancelled` | patient | `reason`: `"regenerated"` (a new code replaced it) or `"patient"` (patient cancelled) |
| `section_viewed` | clinician | `section`: `overview`, `conditions`, `timeline`, `medications` or `care_team`. Repeat views of the same section within 30 seconds are not logged again. |
| `paused` | system | `reason: "timer"` |
| `extended` | patient | `minutes` (15 or 30), `from` (`active` or `paused`), `expires_at` |
| `notes_saved` | clinician | `entry_id` (the `session_notes` entry written to the record when the session ended) |
| `ended` | patient, clinician or system | `by`: `patient`, `clinician` or `timeout` |

Draft saves of the notes are not logged; `notes_saved` marks the notes reaching the record.

---

## 3. The share session

One row in `share_sessions` per share attempt.

```
code_issued ── correct code typed in the portal ─────────▶ requested
code_issued ── 5 min pass ───────────────────────────────▶ expired
code_issued / requested ── patient regenerates or ends ──▶ cancelled
requested ── patient taps Allow ─────────────────────────▶ active
requested ── patient taps Deny ──────────────────────────▶ denied
requested ── doctor cancels ─────────────────────────────▶ code_issued   (same code, same code_expires_at)
requested ── 5 min with no answer ───────────────────────▶ expired
active ── expires_at passes ─────────────────────────────▶ paused        ("Time's up": record hidden)
paused ── patient adds 15 or 30 min ─────────────────────▶ active
paused ── patient ends, or 30 min pass ──────────────────▶ ended
active ── patient or doctor ends ────────────────────────▶ ended
```

- **Live** means `code_issued`, `requested`, `active` or `paused`. A patient has at most one live session (the database enforces it). `denied`, `expired`, `cancelled` and `ended` are final.
- A code is 4 random digits, unique among `code_issued` and `requested` sessions.
- `30m` and `1h` run from Allow. `all_day` ends at 23:59 Irish time today. `manual` has no timer on screen but ends 12 hours after Allow. No session, however extended, runs more than 12 hours after Allow.
- When a session ends (any way), if `allow_notes` is on and any note field has text, one `session_notes` entry is written to the patient's record and `notes_entry_id` points at it.

### The session row (what the patient's browser sees)

The patient reads the table directly (and receives it over realtime), and every patient function returns the same object. Fields:

| Field | Type | Meaning |
|---|---|---|
| `id` | uuid | |
| `patient_id` | uuid | |
| `status` | text | One of the eight states above |
| `code` | text | 4 digits, as a string (keep leading zeros) |
| `code_expires_at` | timestamptz | When the code stops working if nobody types it (5 min after generating) |
| `share_conditions`, `share_recent_visits`, `share_full_timeline`, `share_care_team`, `share_mental_health`, `allow_notes` | boolean | The preferences chosen for this share |
| `duration_kind` | text | `30m`, `1h`, `all_day`, `manual` |
| `appointment_entry_id` | uuid or null | The visit the share was started from; null when started from Profile |
| `clinician_name`, `clinician_role`, `clinician_practice` | text or null | What the doctor typed (set while `requested` and after). Role and practice may be null. Show it as typed: it is not verified. |
| `requested_at`, `request_expires_at` | timestamptz or null | When the doctor typed the code, and when the request times out (5 min later) |
| `approved_at` | timestamptz or null | When the patient tapped Allow ("Started") |
| `expires_at` | timestamptz or null | When access pauses (the countdown) |
| `paused_at` | timestamptz or null | When the timer ran out (only while `paused`) |
| `ended_at`, `ended_by` | timestamptz / text or null | `ended_by`: `patient`, `clinician`, `timeout` |
| `chief_complaint`, `assessment`, `plan`, `follow_up`, `notes_updated_at` | text / timestamptz or null | The doctor's draft notes, as last saved |
| `notes_entry_id` | uuid or null | The `session_notes` entry written at the end, if any |
| `portal_token_hash` | text or null | Ignore. (Present in table reads and realtime payloads; left out of function results.) |
| `created_at`, `updated_at` | timestamptz | |
| `closes_at` | timestamptz or null | **Function results only, not in table reads or realtime.** While `paused`: when the session ends on its own (`paused_at + 30 min`). Compute it the same way from realtime payloads. |

### Realtime

```ts
supabase
  .channel("my-share")
  .on("postgres_changes",
      { event: "*", schema: "public", table: "share_sessions", filter: `patient_id=eq.${userId}` },
      (payload) => { /* payload.new is the row above (without closes_at) */ })
  .subscribe();
```

RLS applies, so a user only ever receives their own rows. Open the request sheet when `payload.new.status === 'requested'`. Changes made lazily (a request timing out, a pause) are only written when someone calls a function, so while `/share/code` or `/session` is open also call `my_share_session()` every few seconds (the plan says 3).

---

## 4. Patient functions

Called from the patient's browser as the signed-in user: `supabase.rpc(name, args)`. All of them raise `not_signed_in` if there is no user. Anonymous demo users can call all of them.

### `create_share_code(...)`

Starts a share: issues a new code with the preferences chosen on Confirm preferences.

Arguments (all optional; defaults are the GP visit profile):

| Name | Type | Default |
|---|---|---|
| `share_conditions` | boolean | `true` |
| `share_recent_visits` | boolean | `true` |
| `share_full_timeline` | boolean | `false` |
| `share_care_team` | boolean | `true` |
| `share_mental_health` | boolean | `false` |
| `allow_notes` | boolean | `true` |
| `duration_kind` | `'30m' \| '1h' \| 'all_day' \| 'manual'` | `'30m'` |
| `appointment_entry_id` | uuid or null | `null` (pass the visit's id when started from the appointment-day card) |

Critical safety information and medications have no switch: they are always shared.

Returns: the session object, `status: 'code_issued'`, with `code` and `code_expires_at`.

Transitions: if a code or request is already live, that session becomes `cancelled` ("Regenerate"); then a new `code_issued` session.

Raises:
- `session_live`: an `active` or `paused` session exists. End it first. (Hide "Share my record" while live.)
- `invalid_duration`, `invalid_preferences` (a null switch), `invalid_appointment` (not one of the caller's `visit` entries).
- `no_code_available`: could not find a free code (practically impossible).

### `respond_to_request(session_id uuid, allow boolean)`

Allow or Deny on the request sheet.

Returns: the session object. Allow: `status: 'active'` with `approved_at` and `expires_at`. Deny: `status: 'denied'`.

Raises:
- `not_found`: no such session for this user.
- `not_requested`: the session is no longer waiting for an answer. `details` holds its current status, usually `expired` (5 minutes passed), `cancelled` or `code_issued` (the doctor cancelled). Close the sheet.
- `invalid_input`: `allow` was null.

### `extend_session(minutes integer)`

"Add 15 min" / "Add 30 min", on the live session or on Time's up.

Arguments: `minutes`, 15 or 30.

Returns: the session object, `status: 'active'`. From `paused`: `expires_at = now + minutes`. From `active`: `expires_at` moves on by `minutes`. Never beyond 12 hours after Allow (it is capped silently).

Raises: `invalid_minutes`, `no_live_session` (nothing active or paused), `session_limit_reached` (12 hours since Allow have passed; offer Save and end).

### `end_session()`

"End sharing now", "Save and end", and also cancelling a code that has not been used.

Returns: the session object after the change, or `null` if nothing was live.
- `active` or `paused` becomes `ended` (`ended_by: 'patient'`), and notes are written to the record if allowed and present.
- `code_issued` or `requested` becomes `cancelled`. A doctor who had typed the code sees `cancelled`.

Raises: nothing besides `not_signed_in`. Safe to call twice.

### `my_share_session()`

The patient's current share. Applies any time-based change first.

Returns: the session object of the live session if there is one, otherwise of the most recent session (any status), or `null` if the user has never shared. Use it on load of `/home`, `/share/code` and `/session`, and as the polling fallback.

---

## 5. Portal functions

Called **only by the Next.js server**, with the publishable key and `portalServerSecret()` as `server_secret`. The doctor's browser holds a random portal token in an httpOnly cookie; pass that raw cookie value as `portal_token`. The database stores only its SHA-256, so pass the token itself, not a hash.

Every portal function first checks both:
- `server_secret` is the configured secret, otherwise it raises `invalid_server_secret` (a missing, wrong or near-miss secret, from any caller).
- `portal_token` is 32 to 512 characters, otherwise `invalid_portal_token`. Use at least 32 random bytes, base64url (43 characters).

**What the portal can learn, by state.** No portal function returns anything from the patient's record (not even the name) unless the session is `active` at that moment, and only `portal_get_record` returns it. A correct code only creates a request the patient sees.

### `portal_submit_code(server_secret, portal_token, code, clinician_name, clinician_role, clinician_practice, ip_hash)`

The doctor typed the 4 digits.

| Argument | Notes |
|---|---|
| `code` | text. Anything that is not exactly 4 digits counts as a wrong code. |
| `clinician_name` | required, trimmed, up to 100 characters |
| `clinician_role` | optional (null or empty), up to 60 |
| `clinician_practice` | optional, up to 120 |
| `ip_hash` | required. The server's salted hash of the caller's IP (`IP_HASH_SALT`). If the IP is unknown pass a fixed value such as the hash of `"unknown"`. |

Returns, always with these four keys:

```json
{ "result": "requested" | "wrong" | "expired" | "locked",
  "request_expires_at": "timestamptz" | null,
  "attempts_left": 0-5 | null,
  "locked_until": "timestamptz" | null }
```

| `result` | Screen | Meaning |
|---|---|---|
| `requested` | `c-waiting` | The code was right. The patient now sees the request. `request_expires_at` is 5 minutes away. Start polling `portal_status` every 2 seconds. |
| `wrong` | `c-code-error` | No live code matches. `attempts_left` is how many more wrong codes before the lock. If it is 0, `locked_until` is set: show `c-code-locked` instead. |
| `expired` | `c-code-expired` | The code matches a share that expired in the last 30 minutes. Counts as a failed attempt, like `wrong`, with the same `attempts_left` / `locked_until`. |
| `locked` | `c-code-locked` | Too many attempts. `locked_until` says when to try again. Nothing was checked; even the right code is refused. |

Limits: 5 wrong (or expired) codes on one portal token within 15 minutes lock that token for 15 minutes from the fifth. A correct code resets the count. Separately, one `ip_hash` may make 20 attempts (right or wrong) per rolling hour; the 21st is `locked` with `locked_until` when the oldest drops out of the hour.

A code that another portal has already turned into a request is `wrong` to everyone else.

Transitions: `code_issued` to `requested`, and binds this portal token to the session.

Raises: `invalid_server_secret`, `invalid_portal_token`, `invalid_clinician`, `invalid_ip_hash`, `portal_busy` (this portal token already has a session that is `requested`, `active` or `paused`; cancel or end it first).

### `portal_status(server_secret, portal_token)`

Poll every 2 seconds while waiting, every 5 seconds during a session. Applies time-based changes first, so the first call after the timer runs out returns `paused`, and the first call after the patient ends returns `ended`.

Returns an object with **all** of these keys every time (null when they do not apply):

| Key | Set when | Meaning |
|---|---|---|
| `status` | always | `none` (no session: show the code step), `requested` (waiting), `active`, `paused`, `ended`, `denied` (`c-denied`), `expired` (the patient did not answer in 5 minutes), `cancelled` (the patient withdrew the code) |
| `server_time` | always | The database's now, to correct the browser clock |
| `clinician` | any session | `{ "name", "role", "practice" }` as the doctor typed them |
| `request_expires_at` | `requested` | |
| `duration_kind` | `active`, `paused`, `ended` | |
| `approved_at` | `active`, `paused`, `ended` | Start time, for `c-end` |
| `expires_at` | `active` | The countdown ("Access expires in") |
| `paused_at`, `closes_at` | `paused` | `closes_at`: when the session ends if the patient does nothing |
| `ended_at`, `ended_by` | `ended` | `ended_by`: `patient`, `clinician`, `timeout` |
| `allow_notes` | `active`, `paused` | Show the notes panel only when true |
| `scope` | `active` | `{ "critical_safety": true, "medications": true, "conditions", "recent_visits", "full_timeline", "care_team", "mental_health", "documents": false, "insurance": false }` (booleans). For "Shared for this visit / Not included" and the locked sidebar items. |
| `notes` | `active` and `allow_notes` | `{ "chief_complaint", "assessment", "plan", "follow_up", "updated_at" }`: the draft as last saved |
| `notes_saved_to_record` | `ended` | true if a `session_notes` entry was written |
| `locked_until` | when this token is locked | Show `c-code-locked` on reload |

`status` is about the latest session this portal token submitted a code for. After `ended`, `denied`, `expired` or `cancelled` it stays that way until the doctor submits another code. After `portal_cancel_request` it is `none`.

Raises: `invalid_server_secret`, `invalid_portal_token`.

### `portal_get_record(server_secret, portal_token, section)`

The only place that returns patient data. `section`: `overview`, `conditions`, `timeline`, `medications` or `care_team`.

Returns `null` unless the token's session is `active` at that moment (time-based changes are applied first). Treat `null` as "access closed": call `portal_status` to find out why. Otherwise it returns an object with every key below. A key is `null` when this section does not include it **or** the patient did not share it; an empty array means shared but empty.

| Key | In sections | Shared when | Shape |
|---|---|---|---|
| `section` | all | | the section asked for |
| `patient` | all | always | `{ "first_name", "last_name", "date_of_birth" ("YYYY-MM-DD"), "age" (integer), "sex", "city" }` (any may be null for an unfinished profile) |
| `critical` | all | always | `{ "blood_type": string\|null, "allergies": string[], "implants": string[] }` |
| `scope` | all | always | as in `portal_status` |
| `conditions` | overview, conditions | `share_conditions` | array of `{ "id", "name", "status", "clinician", "specialty", "diagnosed_year", "diagnosed_note", "is_mental_health" }`, unresolved first, then in the order the patient added them. Mental health conditions only with `share_mental_health`. |
| `medications` | overview, medications | always | `{ "current": [...], "expired": [...] }`, each `{ "id", "name", "dose", "form", "frequency", "timing", "drug_class", "prescriber", "prescriber_specialty", "prescriber_org", "indication", "started_on", "ended_on", "instructions", "refill_due_on" }`. Current newest-started first; expired most recently ended first. All of them, always: the mental health switch never hides a medication. |
| `timeline` | overview, timeline | `share_recent_visits` or `share_full_timeline` | array of entries `{ "id", "kind", "title", "occurs_at", "clinician", "place", "body", "is_mental_health", "source", "detail" }`, newest first. Past entries only (`occurs_at` now or earlier). The 3 most recent, or all of them with `share_full_timeline`. Never `kind = 'note'`. Mental health entries only with `share_mental_health`. Never the appointment the share was started from (the doctor is in that visit). Includes earlier `session_notes`. |
| `upcoming` | overview, timeline | same as `timeline` | entries after now, soonest first, same filters |
| `vitals` | overview, timeline | same as `timeline` | the latest row `{ "recorded_on", "systolic", "diastolic", "heart_rate", "weight_kg", "spo2" }`, or null if none |
| `care_team` | care_team | `share_care_team` | array of `{ "id", "name", "role", "organisation", "kind" }`, GP first, then specialists, then pharmacies |

Documents and insurance are never returned; show them locked with "Not shared".

Each call logs `section_viewed` for the patient's access log (once per section per 30 seconds).

Raises: `invalid_server_secret`, `invalid_portal_token`, `invalid_section`.

### `portal_cancel_request(server_secret, portal_token)`

"Cancel" on `c-waiting`. If the token's session is `requested`, it goes back to `code_issued` (the patient keeps the code and its original expiry; if that has passed it becomes `expired`), the typed name is cleared from it, and the portal is unbound.

Returns: the `portal_status` object (normally `status: 'none'`). Does nothing in any other state. Safe to call twice.

Raises: `invalid_server_secret`, `invalid_portal_token`.

### `portal_save_notes(server_secret, portal_token, chief_complaint, assessment, plan, follow_up)`

Autosave and "Save notes". Pass all four fields every time (null or empty for blank); they replace the draft.

Returns: `{ "saved_at": timestamptz }`.

Allowed while the session is `active` or `paused` (the doctor may finish writing during Time's up). The notes reach the patient's record when the session ends, however it ends.

Raises: `session_not_active` (`details` holds the status, for example `ended`), `notes_not_allowed` (the patient switched notes off), `notes_too_long` (a field over 5000 characters), `invalid_server_secret`, `invalid_portal_token`.

### `portal_end_session(server_secret, portal_token)`

"End session" on `c-end`. If the session is `active` or `paused` it becomes `ended` (`ended_by: 'clinician'`) and the notes are written to the record.

Returns: the `portal_status` object (`status: 'ended'`, `notes_saved_to_record`). Does nothing in other states. Safe to call twice.

Raises: `invalid_server_secret`, `invalid_portal_token`.

---

## 6. Account and demo functions

### `seed_demo_record()` (patient browser, anonymous users only)

Fills the caller's own sandbox with Jane Doe's record, dated relative to today. Calling it again is "Reset demo": it first deletes everything the caller owns, including any share session (a portal looking at it sees `none`).

Returns: `{ "ok": true, "appointment_entry_id": uuid }`, the id of today's GP visit, ready for `create_share_code`.

Raises: `not_signed_in`, `not_anonymous` (the caller is a real account; real data is never touched).

What it creates (from the final screen exports, with the corrections in PLAN.md section 11):
- Profile: Jane Doe, born 12 March 1991, Female, Rathmines, Dublin 6, Dublin, Ireland, +353 86 123 4567, blood type A+, allergy Penicillin, no implants, onboarding `done`.
- Conditions: Atrial fibrillation (managed, Dr O'Mahony, Cardiology, 2019); Hypothyroidism (ongoing, Dr Walsh, Endocrinology, 2022); Mild asthma (managed, Dr Hennessy, GP, "since childhood").
- Current medications: Warfarin 5mg (Tablet, once daily, evening, Anticoagulant, Dr O'Mahony, Cardiology, Mater Private, for Atrial fibrillation, since 2019, refill due in 8 days, "Take at the same time each evening. Needs regular INR blood tests."); Levothyroxine 50mcg (Tablet, once daily, morning, Thyroid, Dr Walsh, Endocrinology, for Hypothyroidism, since 2022, "Take on an empty stomach, 30 minutes before breakfast."); Salbutamol 100mcg (Inhaler, as needed, Bronchodilator, Dr Hennessy, GP, Rathmines Medical Centre, for Asthma, since 2015, "One to two puffs when wheezing or breathless.").
- Expired medications: Clarithromycin 500mg (Tablet, twice daily, Antibiotic; ended 123 days ago); Prednisolone 5mg (Tablet, once daily, morning, Steroid; ended 186 days ago).
- Entries: GP visit with Dr Hennessy at Rathmines Medical Centre **today at 9:30**; "Blood test, full blood count and INR" (result, Mater Hospital, ordered by Dr Hennessy) 9 days ago; "Personal note added" (note, body "Fatigue symptoms") 11 days ago; "Warfarin prescription renewed" (prescription, Boots, Rathmines) 12 days ago; "Cardiology review" (visit, Dr O'Mahony, Mater Private) 43 days ago; upcoming "INR blood test" (Rathmines Medical Centre) in 14 days and "Cardiology follow-up" (Dr O'Mahony, Mater Private) in 48 days.
- Care team: Dr Hennessy (GP, Rathmines Medical Centre, `gp`); Dr O'Mahony (Cardiology, Mater Private, `specialist`); Dr Walsh (Endocrinology, `specialist`); Boots, Rathmines (Pharmacy, `pharmacy`).
- Vitals, 43 days ago: 128/82, heart rate 74, 58 kg, SpO2 98.

### `delete_my_account()` (patient browser)

Deletes the caller's auth user; every row they own goes with it. Returns nothing. Sign the user out locally afterwards. Raises: `not_signed_in`.

### `export_my_data()` (patient browser)

Returns one JSON document for "Export my data": `{ "exported_at", "user_id", "profile": {...} | null, "conditions": [...], "medications": [...], "entries": [...], "care_team": [...], "vitals": [...], "share_sessions": [...], "access_events": [...] }`. Every array holds whole table rows (share sessions without `portal_token_hash`). It reads through the caller's own row-level security. Raises: `not_signed_in`.

### `cleanup_demo_users(server_secret)` (cron route only)

Deletes anonymous users created more than 24 hours ago (their data cascades), portal attempts older than 24 hours, and portal token bindings untouched for 24 hours. Returns `{ "deleted_users", "deleted_attempts", "deleted_bindings" }` (integers). Raises: `invalid_server_secret`. It also keeps the free project from pausing.

---

## 7. Sign-up and the invite list

A trigger on `auth.users` refuses any new user that is not anonymous and whose email (lower-cased) is not in the private invite list. The same check runs when an account's email changes, and when an anonymous user is converted to a permanent one, so the demo cannot be used to get round the list.

What the app sees: Supabase Auth answers the sign-up (`signInWithOtp` for a new email) with **HTTP 500, `error.message` "Database error saving new user"** (error code `unexpected_failure`). Treat that response from sign-up as "Trace is invite-only for now." An invited email gets the normal email.

A new user, real or anonymous, gets an empty `profiles` row immediately (`onboarding_step: 'about'`, `is_demo` true for anonymous users).

Anonymous sign-in is currently switched on in this project (checked 11 Nov 2026: `signInAnonymously()` returned a session).

---

## 8. Worked example: one GP visit

Patient's phone (P) and the portal's server routes (S). The doctor's browser only talks to S.

```ts
// P: demo only
await supabase.auth.signInAnonymously();
const { data: seed } = await supabase.rpc("seed_demo_record");
// seed = { ok: true, appointment_entry_id: "..." }

// P: Confirm preferences -> Generate share code
const { data: s1 } = await supabase.rpc("create_share_code", {
  appointment_entry_id: seed.appointment_entry_id,   // null when started from Profile
  // other switches default to the GP visit profile
});
// s1.status = "code_issued", s1.code = "4821", s1.code_expires_at = now + 5 min
// P subscribes to share_sessions (realtime) and polls my_share_session() every 3 s.

// S: doctor typed name, role, practice, then the code
const { data: r } = await server.rpc("portal_submit_code", {
  server_secret, portal_token: cookie, code: "4821",
  clinician_name: "Dr Hennessy", clinician_role: "GP",
  clinician_practice: "Rathmines Medical Centre", ip_hash,
});
// r = { result: "requested", request_expires_at: ..., attempts_left: null, locked_until: null }
// S polls portal_status every 2 s: { status: "requested", clinician: {...}, request_expires_at, ...nulls }
// portal_get_record(...) returns null here.

// P: realtime row arrives with status "requested", clinician_name "Dr Hennessy" -> request sheet
await supabase.rpc("respond_to_request", { session_id: s1.id, allow: true });
// -> status "active", expires_at = now + 30 min

// S: next poll -> { status: "active", expires_at, scope: {...}, allow_notes: true, notes: {...} }
const { data: overview } = await server.rpc("portal_get_record", {
  server_secret, portal_token: cookie, section: "overview",
});
// overview.patient.first_name = "Jane", overview.critical.allergies = ["Penicillin"],
// overview.timeline = 3 recent entries (no notes, not today's visit), overview.care_team = null
// (ask for section "care_team" to get it)

// S: notes panel autosave
await server.rpc("portal_save_notes", { server_secret, portal_token: cookie,
  chief_complaint: "Ongoing fatigue", assessment: null, plan: "Repeat INR", follow_up: "2 weeks" });

// Either side ends it:
//   P: await supabase.rpc("end_session")            -> ended, ended_by "patient"
//   S: await server.rpc("portal_end_session", {...}) -> ended, ended_by "clinician"
// The other side learns on its next poll / realtime event. portal_get_record now returns null.
// One session_notes entry is on Jane's timeline; access_events reads:
// code_generated, requested, approved, section_viewed, notes_saved, ended
```

Time's up instead: when `expires_at` passes, the next `portal_status` returns `paused` (record null) and the patient's row turns `paused`. `extend_session({ minutes: 15 })` makes it `active` again. With no decision for 30 minutes it becomes `ended` with `ended_by: 'timeout'`.

---

## 9. Operations: secrets, invites, tests

**The portal server secret.** Only its SHA-256 (lowercase hex of the UTF-8 string) is stored, in `private.server_secrets` under the name `portal`. It was inserted by hand, not in a migration. To rotate: generate a new `PORTAL_SERVER_SECRET`, compute its hash locally, then run (SQL editor or MCP `execute_sql`, never a migration):

```sql
update private.server_secrets set sha256_hex = '<new sha256 hex>' where name = 'portal';
```

**Invite someone.** Run by hand, never in a migration:

```sql
insert into private.allowed_emails (email) values (lower('<their email>'));
```

**Migrations.** Every file in `migrations/` is applied to the project with the same SQL. Add changes as new files and apply them with the Supabase migration tool.

**Tests.** `tests/*.sql`, one file per area. Each runs in a transaction and ends with `rollback`, so nothing persists. Run a file's whole contents through the Supabase MCP `execute_sql` tool (or `psql` as `postgres`); the final `select` lists every check with `pass` true or false. They create their own users and a throwaway server secret inside the transaction.

| File | Covers |
|---|---|
| `01_rls_isolation.sql` | One user cannot read, change, delete or plant rows in another's record; sessions and access events are read-only; no direct session-notes forging or `is_demo` change; the anon role reads no table; the private schema is unreachable; export returns only own rows |
| `02_function_privileges.sql` | Execute grants; patient functions refused with the publishable key alone; every portal function refuses a wrong, empty, null or near-miss secret from anon and signed-in callers; short portal tokens refused; private helpers unreachable; every security definer function pins `search_path` |
| `03_share_loop.sql` | The whole loop; no patient data before Allow; nothing from `portal_get_record` unless active; deny, doctor cancel, regenerate, patient end, doctor end; notes to the record; the access log; wrong, expired and locked codes; the per-IP cap |
| `04_record_scope.sql` | Each preference switch; mental health hidden while medications still come through; personal notes never returned, even with full timeline and mental health on; today's visit not repeated; section contents |
| `05_time_transitions.sql` | Code and request expiry; active to paused; paused to active by extension; paused to ended after 30 minutes (notes still saved); durations; the 12-hour cap |
| `06_auth_demo_account.sql` | The invite trigger (uninvited refused, invited allowed case-insensitively, anonymous allowed, email change guarded); the seed (refuses non-anonymous callers, contents, dates, reset, separate sandboxes); account deletion; the daily cleanup; export |
