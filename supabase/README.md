# Trace database: the contract

This is everything the app needs to know about the database. It describes what each table lets the browser do, and what every function takes, returns and raises. If something here disagrees with the SQL in `migrations/`, the SQL wins and this file has a bug.

Supabase project: `trace` (`tpqzmwtcgfgjhursxpsf`, eu-west-1). Generated types: `types/database.types.ts` (copied to `src/lib/supabase/database.types.ts`). Pass them as the client generic (`createBrowserClient<Database>(...)`). Every function returns `Json` in the types; the shapes below are what is inside.

### The redesign (November 2026)

The redesign's data (strength periods, the full timeline, visit detail, family history, insurance, documents, the new share scopes) was added without changing anything the current app uses: the live site keeps running the old code against this database until the redesign ships. Three markers are used below:

- **[new]**: added for the redesign. The redesigned app uses it.
- **[old app]**: kept only so the current app keeps working. The redesigned app calls the replacement named next to it. Listed for removal in [section 12](#12-after-the-redesign-ships-what-to-remove).
- No marker: used by both, unchanged.

What the redesigned app calls instead of the old functions:

| Old app calls | Redesigned app calls |
|---|---|
| `create_share_code({ share_conditions, ... })` | the same name with the four new scopes named: `create_share_code({ share_documents, share_family_history, share_insurance, share_medication_notes, share_conditions, ... })` ([4](#create_share_code-new-overload-new)) |
| `portal_get_record({ server_secret, portal_token, section })` | `portal_get_record({ server_secret, portal_token, section, version: 2 })` ([5](#portal_get_recordserver_secret-portal_token-section-version-new)) |
| `seed_demo_record()` | `seed_demo_record_v2()` ([6](#seed_demo_record_v2-new-patient-browser-anonymous-users-only)) |
| `export_my_data()` | `export_my_data({ version: 2 })` ([6](#export_my_dataversion-new-patient-browser)) |
| reading `medications`, `entries` and so on and shaping them in the browser | `my_record({ section })`, the same shapes the portal gets ([4](#my_recordsection-text-new), [10](#10-the-redesigned-record-sections-and-shapes)) |

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
10. [The redesigned record: sections and shapes](#10-the-redesigned-record-sections-and-shapes) **[new]**
11. [Worked example: a share with the new scopes](#11-worked-example-a-share-with-the-new-scopes) **[new]**
12. [After the redesign ships: what to remove](#12-after-the-redesign-ships-what-to-remove) **[new]**
13. [Decisions made for the redesign](#13-decisions-made-for-the-redesign) **[new]**

---

## 1. Ground rules

**Who calls what**

| Caller | Supabase client | May use |
|---|---|---|
| Patient browser (signed in, including anonymous demo users) | `createClient()` from `@/lib/supabase/client`, publishable key + the user's session | Own rows in the tables below (through RLS), the patient functions, `seed_demo_record`, `seed_demo_record_v2`, `delete_my_account`, `export_my_data` |
| Next.js server, portal routes `/api/portal/*` | Publishable key; with or without a user session (both work) | The `portal_*` functions (including `portal_get_document`), always with `server_secret` first |
| Next.js server, cron route | Publishable key | `cleanup_demo_users(server_secret)` |
| Doctor's browser | None. It never talks to Supabase | Nothing |
| Not signed in, publishable key only | | Nothing. Every table refuses (`permission denied`); every patient function refuses |

**Errors.** Every error this database raises on purpose has a short machine code as its `message`, for example `session_live`. With supabase-js that is `error.message`. Branch on `error.message`, never on the HTTP status: PostgREST maps the codes to different statuses (401, 403, 400 and 500 all occur). Some errors also carry a human `details` (the SQL `DETAIL`) or `hint`. Any other message (a constraint name, `permission denied for ...`) means a bug or an attack, not a state the screens should design for.

**Time.** All timestamps are `timestamptz`, returned as ISO strings in UTC. The database decides every time-based state. Screens count down from the timestamps they are given, and must not decide on their own that something has expired. "Today" and "23:59" mean Irish time (`Europe/Dublin`).

**Lazy transitions.** Nothing runs on a timer. Every function that reads a session first moves it to the state the clock says it is in (an unused code expires, a request times out, an active session pauses, a paused session ends). So the portal's polling (`portal_status`) and the patient's `my_share_session()` are what move time forward. A realtime update follows each such change.

**Overloaded functions. [new]** `create_share_code`, `portal_get_record` and `export_my_data` each have two versions with the same name: the original, and one that takes an extra argument (the four new scopes, `version`, `version`). Always pass arguments by name, as supabase-js does. PostgREST picks the version whose arguments match the names sent: the old names reach the original, the new names reach the new one, and a call that names only some of the four new scopes matches neither (HTTP 404, `PGRST202`). Checked over HTTP against this project (section 9). In raw SQL, positional calls such as `create_share_code(true, true, true, true)` are ambiguous; use named notation (`=>`).

**Never in the repo:** the server secret, any real email address, any real health data.

---

## 2. Tables: what the browser may read and write

All tables are in `public` with row-level security on. The browser can only ever see or change rows that belong to the signed-in user. `user_id` defaults to the caller, so inserts can leave it out.

| Table | Browser may | Notes |
|---|---|---|
| `profiles` | select, update own row (`id = user id`) | Created automatically when the auth user is created; never insert. Deleted with the user. `id`, `is_demo` and `created_at` cannot be changed (raises `read_only_field`). |
| `conditions` | select, insert, update, delete own | |
| `medications` | select, insert, update, delete own | No mental health flag, on purpose. A trigger keeps `medication_periods` in step with `dose`, `started_on` and `ended_on` (below). |
| `medication_periods` **[new]** | select own; **update only `note` and `note_shared`** | One row per strength taken. New periods come only from `log_strength_change` (or the trigger, for medications written the old way); `undo_strength_change` removes the newest. |
| `entries` | select, insert, update, delete own | The browser can only write `source = 'patient'` entries, never `kind = 'session_notes'`, never `session_id` or `detail` (raises `session_notes_read_only`). Session notes written by a doctor can be read and deleted; only their `is_mental_health` can be changed (the new detail columns are read-only on them too). |
| `result_values` **[new]** | select, insert, update, delete own | Rows of a `result` entry. `entry_id` must be one of the caller's own entries. |
| `health_events` **[new]** | select, insert, update, delete own | The full timeline. |
| `health_event_prescriptions` **[new]** | select, insert, update, delete own | What was prescribed for an event. Optional links to the caller's own medication and period. |
| `relatives` **[new]** | select, insert, update, delete own | Family history. |
| `relative_conditions` **[new]** | select, insert, update, delete own | A relative's conditions. `relative_id` must be the caller's own relative. |
| `insurance_connections` **[new]** | select own; **update only `include_in_shares`**; delete own | At most one per account. Connect (or replace) with `save_insurance`. Delete is "Disconnect". |
| `documents` **[new]** | select own; **update only `title`, `document_date`, `is_mental_health`**; delete own | The list. Upload with `upload_document`; read a file with `my_document_file`. Deleting a document deletes its file. |
| `care_team` | select, insert, update, delete own | |
| `vitals` | select, insert, update, delete own | No patient screen writes these yet; the demo seeds one row. |
| `share_sessions` | **select only**, own (`patient_id`) | Every change goes through a function. In the realtime publication. |
| `access_events` | **select only**, own (`patient_id`) | The access log. Written only by functions. |

Child rows always belong to the same user as their parent: each child table's foreign key is on `(parent_id, user_id)`, so a row can never point at someone else's record (a try raises a foreign key violation, `23503`).

There is no view and no other table the app needs. The `private` schema (invite list, server-secret hash, portal attempts, portal token bindings, and **[new]** `document_files`, the bytes of each document) is not reachable through the API at all.

### Columns and allowed values

**`profiles`**: `id uuid`, `first_name`, `last_name` (text, up to 100), `date_of_birth date`, `sex` (text, up to 40), `country`, `city` (up to 100), `address` (up to 300), `phone` (up to 40), `blood_type` (one of `A+ A- B+ B- AB+ AB- O+ O-`, or null for "not known"), `allergies text[]` (default `{}`), `implants text[]` (default `{}`), `email_reminders boolean` (default false), `terms_accepted_at timestamptz`, `onboarding_step` (one of `about`, `medical`, `privacy`, `profiles`, `welcome`, `done`; default `about`; the sign-up steps after the code), `is_demo boolean` (true for anonymous users; read-only), `created_at`, `updated_at`.

**`conditions`**: `id`, `user_id`, `name` (required, up to 200), `status` (`managed`, `ongoing`, `resolved`; default `ongoing`), `clinician`, `specialty` (up to 200), `diagnosed_year integer` (1900 to 2200), `diagnosed_note` (up to 200, for "since childhood"), `is_mental_health boolean` (default false), `created_at`, `updated_at`.

**`medications`**: `id`, `user_id`, `name` (required, for example `Warfarin`), `dose` (`5mg`), `form` (`Tablet`), `frequency` (`once daily`), `timing` (`evening`), `drug_class` (`Anticoagulant`), `prescriber` (`Dr O'Mahony`), `prescriber_specialty` (`Cardiology`), `prescriber_org` (`Mater Private`), `indication`, `started_on date`, `ended_on date`, `instructions` (up to 2000), `refill_due_on date`, **[new]** `unit` (`mg`, `mcg`, `g`, `mL`, `units`, `IU`, or null: then the unit is read from `dose`), `created_at`, `updated_at`. **Current** means `ended_on` is null or today or later; **expired** (the redesign says **past**) means `ended_on` is before today. The redesign's status (`current` / `past`) is computed this way, not stored. Its schedule ("Morning", "Evening", "As needed") is `timing`, or "As needed" when `frequency` says so.

To add a medication in the redesigned app, insert a row as today with `dose` written as a number and a unit (`"36mg"`), `unit`, `started_on` and `prescriber`: the first strength period is created from them. To stop one, set `ended_on`: the open period ends with it. Change a strength only with `log_strength_change`.

**`medication_periods`** **[new]**: `id`, `medication_id`, `user_id`, `strength numeric` (> 0; the unit is the medication's), `start_date date`, `end_date date` (null while it is the current strength), `date_precision` (`day`, `month` or `year`: how to show the dates; Concerta's are months, Salbutamol's start is a year), `prescribed_by` (text, up to 200), `note` (the patient's own "how it felt", up to 2000), `note_shared boolean` (default **false**), `created_at`, `updated_at`. At most one open period per medication. A strength change closes the open period on the change date and opens the next on the same date. How medications written the old way (`dose` text, no periods) stay in step, through a trigger:
- a new row whose `dose` reads as a number and a unit (`36mg`, `100 mcg`, `2.5mg`) gets its first period (`start_date` = `started_on`, or today; `end_date` = `ended_on`; `prescribed_by` = `prescriber`). A `dose` that does not read (`"thin layer"`) gets no period; the medication still shows, with `strength_label` = the dose text;
- a `dose` changed to another strength closes the open period today and opens a new one today (never overwrites). If the open period started today, or the medication has ended, the strength is corrected in place instead;
- `ended_on` set, changed or cleared moves the latest period's `end_date` with it (never before its start);
- `started_on` changed moves the first period's start, if no later period would start before it.
Every existing medication got its first period this way when the redesign's migration ran.

**`result_values`** **[new]**: `id`, `user_id`, `entry_id` (a `result` entry), `position` (order, 0 up), `name` (`Haemoglobin`), `value numeric`, `unit` (`g/L`; null for INR), `ref_low`, `ref_high` (numeric, either may be null), `created_at`, `updated_at`. "low" when `value < ref_low`, "high" when `value > ref_high` (computed in the shapes, not stored).

**`health_events`** **[new]**: `id`, `user_id`, `kind` (`infection` or `condition`), `title` (up to 200), `occurred_on date`, `date_precision` (`day`, `month` default, `year`), `clinician` (`Dr Hennessy`), `place` (`Rathmines Medical Centre`, or `Cardiology, Mater Private`), `outcome` (`resolved`, `settled`, `ongoing`, `seasonal`, `managed`, or null), `notes` (the doctor's notes, up to 5000), `is_mental_health`, `created_at`, `updated_at`.

**`health_event_prescriptions`** **[new]**: `id`, `user_id`, `event_id`, `position`, `name` (`Doxycycline 100mg`; free text, may be "Nothing prescribed"), `detail` (`7 days, from 2 Aug`), `medication_id`, `medication_period_id` (optional links into the caller's own medications; set to null if that medication or period is deleted), `created_at`, `updated_at`.

**`relatives`** **[new]**: `id`, `user_id`, `relation` (one of `mother`, `father`, `maternal_grandmother`, `maternal_grandfather`, `paternal_grandmother`, `paternal_grandfather`, `sister`, `brother`, `daughter`, `son`, `maternal_aunt`, `maternal_uncle`, `paternal_aunt`, `paternal_uncle`, `other`), `label` (optional, up to 60; otherwise the shapes give "Mum", "Dad's dad" and so on), `created_at`, `updated_at`. Several of one relation are allowed (two brothers).

**`relative_conditions`** **[new]**: `id`, `user_id`, `relative_id`, `name` (`Heart attack`), `age_at_diagnosis` (0 to 130, optional), `category` (`heart`, `diabetes`, `asthma`, `cancer`, `stroke`, `other`, or null; drives the tree's filters), `is_mental_health` (a relative's mental health condition is hidden from a doctor without the Mental health scope, like the patient's own), `created_at`, `updated_at`. A relative with no conditions is shown as "None known".

**`insurance_connections`** **[new]**: `id`, `user_id`, `provider` (`VHI`, `Laya Healthcare`, `Irish Life Health` or whatever the patient typed for "Other provider"; up to 100), `member_number_last4` (exactly 4 letters or digits: the full number is never stored), `plan_name` (up to 100), `renews_on date`, `via` (`provider`: the mocked provider sign-in; `manual`: typed in), `include_in_shares boolean` (default false), `connected_at`, `created_at`, `updated_at`. There is no column for a password, token or any other credential, and `save_insurance` takes none. Insurance is a mock on every account (owner's decision): the app's mock adapter supplies the sample plan (`•••• 4821`, Comprehensive plan, renews 1 Mar 2027) and calls `save_insurance` with `via: 'provider'`.

**`documents`** **[new]**: `id`, `user_id`, `title` (up to 200), `content_type` (`application/pdf`, `image/jpeg` or `image/png`), `byte_size` (1 to 3 145 728), `document_date date` (optional: the date on the letter), `is_mental_health`, `created_at`, `updated_at`. The bytes live in `private.document_files`, which checks the leading bytes against `content_type` (`%PDF-`, `FF D8 FF`, `89 50 4E 47 0D 0A 1A 0A`) and the size against `byte_size`; nothing else can be stored there, even by the database owner. When the app serves a file it must send the stored `content_type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox` and `Cache-Control: no-store`, and never render it into a page as HTML.

**`entries`** (the timeline and appointments): `id`, `user_id`, `kind` (`visit`, `result`, `prescription`, `note`, `letter`, `imaging`, `vaccination`, `session_notes`), `title` (required, up to 300), `occurs_at timestamptz` (required), `clinician`, `place` (up to 200), `body` (up to 20000), `is_mental_health boolean`, `source` (`patient` or `clinician_session`), `session_id uuid` (session notes only), `detail jsonb` (session notes only, see below), **[new]** the text kind of visit detail: `reason` (up to 2000), `assessment`, `plan` (up to 5000 each), and for a prescription `rx_medication` (`Warfarin 5mg, daily`, up to 300), `rx_quantity` (`28 tablets`, up to 100), `rx_pharmacy` (`Boots, Rathmines`, up to 200), `created_at`, `updated_at`. The result kind of visit detail is `result_values`.
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
| `code_generated` | patient | the preferences: `share_conditions`, `share_recent_visits`, `share_full_timeline`, `share_care_team`, `share_mental_health`, `allow_notes`, `duration_kind`, `appointment_entry_id`; **[new]** also `share_documents`, `share_family_history`, `share_insurance`, `share_medication_notes` when the new `create_share_code` made the code |
| `requested` | clinician | `clinician_name`, `clinician_role`, `clinician_practice` (as typed) |
| `request_cancelled` | clinician | `{}` (the doctor backed out; the code is live again) |
| `approved` | patient | `expires_at`, `duration_kind` |
| `denied` | patient | `{}` |
| `expired` | system | `stage`: `"code"` (nobody typed the code within 5 minutes) or `"request"` (the patient did not answer within 5 minutes) |
| `cancelled` | patient | `reason`: `"regenerated"` (a new code replaced it) or `"patient"` (patient cancelled) |
| `section_viewed` | clinician | `section`: `overview`, `conditions`, `timeline`, `medications` or `care_team` (old app); **[new]** with version 2 also `recent_visits`, `full_timeline`, `family_history`, `insurance`, `documents`, `mental_health`. Only sections that were shared are logged. Repeat views of the same section within 30 seconds are not logged again. |
| `document_viewed` **[new]** | clinician | `document_id`. The doctor opened one file (`portal_get_document`). Not logged again for the same file within 30 seconds. |
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
| `share_documents`, `share_family_history`, `share_insurance`, `share_medication_notes` **[new]** | boolean | The redesign's new scopes. Always false on a session the old `create_share_code` made. (The session object gained these four keys; every other key is unchanged.) |
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

### `create_share_code(...)` **[old app]**

Starts a share: issues a new code with the preferences chosen on Confirm preferences. The redesigned app calls the [new overload](#create_share_code-new-overload-new) instead. Sessions made here have the four new scopes off.

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

### `create_share_code(...)` (new overload) **[new]**

The redesign's Share confirm. The same function name; the four new scopes have **no default and must all be named**, which is what sends the call here rather than to the original. Same rules, transitions and errors as the original.

| Name | Type | Default |
|---|---|---|
| `share_documents` | boolean | **required** (the tile defaults to off) |
| `share_family_history` | boolean | **required** (off) |
| `share_insurance` | boolean | **required** (off; the app pre-sets it from the connection's `include_in_shares`) |
| `share_medication_notes` | boolean | **required** (off) |
| `share_conditions`, `share_recent_visits`, `share_full_timeline`, `share_care_team`, `share_mental_health`, `allow_notes`, `duration_kind`, `appointment_entry_id` | as in the original | as in the original (`true`, `true`, `false`, `true`, `false`, `true`, `'30m'`, `null`) |

Safety information and medications have no switch: always shared. `share_full_timeline` is the Full timeline tile, `share_mental_health` the Mental health tile.

Returns: the session object, with the four new fields set. Raises: as the original (`invalid_preferences` if any switch, new or old, is null).

### `my_record(section text)` **[new]**

The patient's own record, in exactly the shapes the doctor gets from `portal_get_record` version 2 ([section 10](#10-the-redesigned-record-sections-and-shapes)), so the phone and the portal show the same data the same way. The owner sees everything: every section is `shared: true`, `scope` is `null`, personal notes (`kind: 'note'`) are included, mental health items are included, every medication note is included with its `note_shared`, and every insurance connection is listed whatever its `include_in_shares`.

`section`: `overview`, `conditions`, `recent_visits`, `medications`, `full_timeline`, `care_team`, `family_history`, `insurance`, `documents`, `mental_health`.

Raises: `not_signed_in`, `invalid_section`.

Phone screens and the section to read: Home (`overview` and `recent_visits`, plus `medications` for the refill line), Record Timeline tab (`recent_visits.upcoming` plus `full_timeline.visits`), Conditions tab (`conditions`), Family tab and Family tree (`family_history`), Full timeline (`full_timeline.events`), Visit detail (the entry's `detail`), Medications and Medication detail (`medications`), Insurance (`insurance`), Documents (`documents`).

### `log_strength_change(medication_id, strength, changed_on, prescribed_by?, note?, note_shared?, unit?)` **[new]**

"Log a strength change". Closes the current period on `changed_on` and opens a new one from `changed_on`. Never overwrites an earlier period. Atomic (the medication row is locked). Also keeps the old columns right: `dose` becomes `"<strength><unit>"`, `unit` is set, `prescriber` becomes `prescribed_by` when given, `started_on` is filled if it was empty.

| Name | Type | Notes |
|---|---|---|
| `medication_id` | uuid | one of the caller's medications |
| `strength` | numeric | > 0 and < 100000, in the medication's unit |
| `changed_on` | date | today or earlier, and after the current period's start |
| `prescribed_by` | text or null | up to 200 |
| `note` | text or null | the patient's note on the new period, up to 2000 |
| `note_shared` | boolean | default `false` |
| `unit` | text or null | only needed when the medication has no unit yet (its `dose` did not read as one); must match an existing unit |

Returns: the medication object ([section 10](#a-medication)), owner view (notes with `note_shared`).

Raises: `not_signed_in`, `not_found` (not the caller's), `invalid_strength`, `invalid_unit`, `unit_required`, `medication_not_current` (it has ended), `invalid_date` (`details` says why), `same_strength`, `invalid_input` (prescriber or note too long).

### `undo_strength_change(medication_id uuid)` **[new]**

Removes the newest period (a change logged by mistake) and reopens the one before; `dose` goes back. Returns the medication object. Raises: `not_signed_in`, `not_found`, `nothing_to_undo` (only one period).

A period's note and `note_shared` are edited directly: `supabase.from('medication_periods').update({ note, note_shared }).eq('id', periodId)`. Nothing else on a period can be changed by the browser.

### `save_insurance(provider, member_number, plan_name?, renews_on?, via?)` **[new]**

Connect insurance, or replace the connection (one per account). Takes the member number as typed and stores only its last four letters or digits. There is no password argument and the database has nowhere to keep one.

| Name | Type | Notes |
|---|---|---|
| `provider` | text | required, up to 100 |
| `member_number` | text | up to 40 characters, at least 4 letters or digits (spaces and dashes ignored) |
| `plan_name` | text or null | up to 100 |
| `renews_on` | date or null | |
| `via` | `'provider'` or `'manual'` | default `'manual'`. `'provider'` for the mocked provider sign-in |

Returns: the insurance object ([section 10](#insurance)), owner view. Replacing keeps `include_in_shares` as it was; a new connection starts with it off.

Raises: `not_signed_in`, `invalid_provider`, `invalid_member_number`, `invalid_plan`, `invalid_via`.

"Include in shares": `supabase.from('insurance_connections').update({ include_in_shares }).eq('id', id)`. "Disconnect": delete the row.

### `upload_document(title, content_type, data_base64, document_date?, is_mental_health?)` **[new]**

Upload a PDF, JPEG or PNG. The file is sent as base64 (whitespace is ignored).

| Name | Type | Notes |
|---|---|---|
| `title` | text | required, up to 200 |
| `content_type` | text | `application/pdf`, `image/jpeg` or `image/png`; must match the file's leading bytes |
| `data_base64` | text | the file, at most 3 MB (3 145 728 bytes) decoded |
| `document_date` | date or null | |
| `is_mental_health` | boolean | default false |

Limits per account: 20 MB and 100 files for a real account, 3 MB and 5 files for a demo account. All demo accounts together: 100 MB.

Returns: the document object ([section 10](#a-document)).

Raises: `not_signed_in`, `invalid_title`, `invalid_type` (a type other than the three, or bytes that are none of them), `type_mismatch` (`details`: what the file really is), `invalid_file` (empty or not base64), `file_too_large`, `quota_exceeded` (`details` gives the limits), `storage_full` (demo only: the shared demo allowance is used up).

### `my_document_file(document_id uuid)` **[new]**

One of the caller's files: `{ "id", "title", "content_type", "byte_size", "data_base64" }` (base64 without line breaks). Raises: `not_signed_in`, `not_found`. Serve it with the headers in section 2 (`documents`).

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

**What the portal can learn, by state.** No portal function returns anything from the patient's record (not even the name) unless the session is `active` at that moment, and only `portal_get_record` returns it (and **[new]** `portal_get_document`, one granted file at a time). A correct code only creates a request the patient sees.

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
| `scope` | `active` | `{ "critical_safety": true, "medications": true, "conditions", "recent_visits", "full_timeline", "care_team", "mental_health", "documents", "insurance", "family_history", "medication_notes" }` (booleans). What the patient granted, for building the rail: each rail item is a link when its key is true and a dimmed "Not shared" row when false (Overview and Medications always true). **[new]** `documents` and `insurance` now report the session's choice (they were always false before, and still are for every session the old `create_share_code` makes); `family_history` and `medication_notes` are new keys. |
| `notes` | `active` and `allow_notes` | `{ "chief_complaint", "assessment", "plan", "follow_up", "updated_at" }`: the draft as last saved |
| `notes_saved_to_record` | `ended` | true if a `session_notes` entry was written |
| `locked_until` | when this token is locked | Show `c-code-locked` on reload |

`status` is about the latest session this portal token submitted a code for. After `ended`, `denied`, `expired` or `cancelled` it stays that way until the doctor submits another code. After `portal_cancel_request` it is `none`.

Raises: `invalid_server_secret`, `invalid_portal_token`.

### `portal_get_record(server_secret, portal_token, section, version)` **[new]**

Version 2: the redesigned portal's sections. Still the single gate for record data (with `portal_get_document` for one file). The three-argument version below is unchanged and is what the old app calls; passing `version` reaches this one.

| Argument | Notes |
|---|---|
| `section` | `overview`, `conditions`, `recent_visits`, `medications`, `full_timeline`, `care_team`, `family_history`, `insurance`, `documents`, `mental_health` |
| `version` | `2` |

Returns:
- `null` unless the token's session is `active` at that moment (time-based changes are applied first). Treat `null` as "access closed" and call `portal_status`.
- Otherwise the section envelope ([section 10](#10-the-redesigned-record-sections-and-shapes)): `{ "version": 2, "section", "shared", "patient", "critical", "scope", "data" }`.
- **A section the patient did not grant** returns `"shared": false` and `"data": null`, with `patient`, `critical` and `scope` still filled (the page header and the rail need them). Its tables are not read and no view is logged. Show "Not shared". This is the denial; there is no error for it.

Which scope opens which section: `overview` and `medications` always; `conditions` with Conditions; `recent_visits` with Recent visits; `full_timeline` with Full timeline; `care_team` with Care team; `family_history` with Family history; `insurance` with Insurance; `documents` with Documents; `mental_health` with Mental health. Inside a shared section, items flagged as mental health appear only with the Mental health scope, and a medication note only with the Medication notes scope and its own `note_shared` on.

Logs `section_viewed` for each shared section (once per section per 30 seconds).

Raises: `invalid_server_secret`, `invalid_portal_token`, `invalid_section` (a name not in the list: a bug in the app), `invalid_version`.

### `portal_get_document(server_secret, portal_token, document_id)` **[new]**

One document's file, for the doctor to open. Returns `{ "id", "title", "content_type", "byte_size", "data_base64" }` (base64 without line breaks), or `null` when any of these is not true: the session is `active` right now; the patient granted Documents; the document is this patient's; the document is not flagged as mental health, or the patient also granted Mental health. Treat `null` as "not available" (the list in `portal_get_record` only shows documents the doctor may open). Logs `document_viewed`.

The route that calls it must answer with the stored `content_type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: no-store`, and never put the file into a page as HTML. At most 3 MB, under Vercel's 4.5 MB response cap.

Raises: `invalid_server_secret`, `invalid_portal_token`, `invalid_input` (no `document_id`).

### `portal_get_record(server_secret, portal_token, section)` **[old app]**

The old portal's sections. The redesigned portal passes `version: 2` instead (above). Unchanged: in particular `documents` is still an unknown section here (`invalid_section`), and its `scope` object is the old one (`documents` and `insurance` always false). `section`: `overview`, `conditions`, `timeline`, `medications` or `care_team`.

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

Documents and insurance are never returned by this version; show them locked with "Not shared".

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

### `seed_demo_record_v2()` **[new]** (patient browser, anonymous users only)

Fills the caller's sandbox with Jane Doe's record exactly as the approved boards show it (`docs/redesign/canvas/`). Calling it again is "Reset demo": it first deletes everything the caller owns, every new table and any share session included.

Returns: `{ "ok": true, "appointment_entry_id": uuid }` (today's GP visit). Raises: `not_signed_in`, `not_anonymous`.

Dates relative to today (Irish time) where the boards tell today's story; fixed where they show history. What it creates:
- Profile: as `seed_demo_record` (Jane Doe, born 12 March 1991, Female, Dublin, A+, Penicillin allergy, onboarding `done`).
- Conditions: Atrial fibrillation (managed, Dr O'Mahony, Cardiology, 2019); Hypothyroidism (ongoing, Dr Walsh, Endocrinology, 2022); Mild asthma (managed, Dr Hennessy, GP, "since childhood").
- Current medications, in this order: **Concerta** 36mg, morning, Dr Hennessy, periods 18mg Jan to Mar 2024, 27mg Mar to Jun 2024, 36mg Jun to Oct 2024, 45mg Oct 2024 to Feb 2025, 36mg Feb 2025 to now (month precision, each with Jane's note from the board, all `note_shared: true` so they show to a doctor only when the Medication notes scope is granted); **Levothyroxine** 25mcg Mar to Sep 2022 then 50mcg ("Energy back to normal.", shared), morning, Dr Walsh; **Warfarin** 5mg from Jun 2019, evening, Dr O'Mahony, refill due in 8 days; **Salbutamol** 100mcg from 2015 (year precision), as needed, Dr Hennessy. Instructions, forms and classes as in the old seed.
- Past medications, all Dr Hennessy, day precision: Doxycycline 100mg 2 to 9 Aug 2026; Prednisolone 20mg 9 to 14 Feb 2026; Nitrofurantoin 100mg 12 to 17 Sep 2025; Cetirizine 10mg 1 Apr to 30 Sep 2024.
- Entries: **GP visit** today 9:30, Dr Hennessy, Rathmines Medical Centre, Reason "Tired for three weeks", Assessment "Possibly low iron. Thyroid dose to be reviewed.", Plan "Blood tests. Repeat INR on <today + 14, e.g. 25 Nov>."; **Blood count and INR** (result) 9 days ago, Dr Hennessy, Mater Hospital: Haemoglobin 128 g/L (115 to 160), White cells 6.2 x10⁹/L (4 to 11), Platelets 245 x10⁹/L (150 to 400), INR 2.4 (2 to 3), Ferritin 18 µg/L (30 to 300, low); **Fatigue symptoms** (personal note) 11 days ago; **Warfarin renewed** (prescription) 12 days ago, Dr O'Mahony, Boots, Rathmines: "Warfarin 5mg, daily", "28 tablets", "Boots, Rathmines"; upcoming **INR blood test** in 14 days (Rathmines Medical Centre) and **Cardiology follow-up** in 48 days (Dr O'Mahony, Mater Private). No "Cardiology review": the boards do not show one.
- Full timeline, nine events with their prescriptions and notes, exactly as the board: Chest infection Aug 2026 (Doxycycline 100mg, 7 days, from 2 Aug), Asthma flare Feb 2026 (Prednisolone 20mg, 5 days; Salbutamol 100mcg, as needed), Urinary tract infection Sep 2025 (Nitrofurantoin 100mg, 5 days), Hay fever Apr 2024 (Cetirizine 10mg, April to September), Tonsillitis Nov 2023 (Clarithromycin 250mg, 7 days), Hypothyroidism diagnosed Mar 2022 (Dr Walsh, Endocrinology; Levothyroxine 25mcg, raised to 50mcg in Sep 2022), Covid-19 Dec 2020, Atrial fibrillation diagnosed Jun 2019 (Dr O'Mahony, Cardiology, Mater Private; Warfarin 5mg, daily, ongoing), Glandular fever Feb 2018. Prescription lines link to the matching medication period where one exists. Every antibiotic is a non-penicillin (Penicillin allergy).
- Family: Mum's mum (Type 2 diabetes), Mum's dad (none known), Dad's mum (Asthma), Dad's dad (Heart attack at 61), Mum (Type 2 diabetes), Dad (Atrial fibrillation), Brother (Asthma), with the tree's categories (heart, diabetes, asthma).
- Care team: Dr Hennessy (GP, Rathmines Medical Centre), Dr O'Mahony (Cardiology, Mater Private), Dr Walsh (Endocrinology), Boots (Pharmacy, Rathmines).
- Vitals, 43 days ago: 128/82, heart rate 74, 58 kg, SpO2 98.
- No documents, no insurance connection (the Insurance board starts at "choose a provider"), no mental health items: the boards show none.

**Written, not applied (November 2026 review fixes).** `migrations/20261112120000_trace_demo_seed_review_fixes.sql` replaces this function with a corrected story (the review's sample-data items E1 to E9; the file's header lists each change). In short: an ADHD condition (Dr Byrne, Psychiatry, 2023, mental health) and its timeline event explain Concerta, whose strengths become 18, 27, 36, 54, 36mg with a calmer 54mg note; today's 9:30 GP visit has only its reason; a visit for tiredness 16 days ago comes first, with one past share to Dr Hennessy (ended, with session notes and access events) that planned the bloods; the results 9 days ago gain TSH; "Fatigue symptoms" has text; "Warfarin renewed" moves to 20 days ago; vitals are dated that visit; Covid-19 and Glandular fever lose their "Nothing prescribed" rows; two sample PDF letters (one flagged mental health). Same signature and grants. Until the owner applies it, everything above describes the live function; once applied, update this section, `supabase/tests/10_redesign_seed_account.sql` and the expectations listed in docs/REVIEW.md 1.6.

### `seed_demo_record()` **[old app]** (patient browser, anonymous users only)

Unchanged. The redesigned app calls `seed_demo_record_v2()`. (Medications it creates get their strength periods from the trigger.)

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

### `delete_my_account()`, the new tables **[new]**

Every new table cascades from the auth user, and document files from their document, so `delete_my_account()` (and the daily `cleanup_demo_users`) remove all of it. Checked in `10_redesign_seed_account.sql`.

### `export_my_data(version)` **[new]** (patient browser)

`export_my_data({ version: 2 })`: "Export my data" for the redesigned app. `{ "version": 2, "exported_at", "user_id", "profile", "conditions", "medications", "medication_periods", "entries", "result_values", "health_events", "health_event_prescriptions", "care_team", "vitals", "relatives", "relative_conditions", "insurance_connections", "documents", "share_sessions", "access_events" }`. Every array holds whole rows of the caller's own data (share sessions without `portal_token_hash`); each document carries its file as `data_base64`, so the export can be large (up to about 27 MB for a full real account). Raises: `not_signed_in`, `invalid_version` (anything but 2).

### `export_my_data()` **[old app]** (patient browser)

Unchanged; it does not include the new tables. The redesigned app calls `export_my_data({ version: 2 })`.

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
| `07_strength_periods.sql` **[new]** | A strength change closes the previous period on the same date and never overwrites; its refusals; medications written the old way keep their periods in step (insert, dose change, `ended_on`); `dose` follows the new function; undo; what the browser may edit on a period; `note_shared` defaults to false |
| `08_redesign_scopes.sql` **[new]** | Defaults; each new scope switched on alone changes exactly its own section; an ungranted section returns `shared: false`, `data: null`, leaks nothing and is not logged; medication notes need the scope and `note_shared`; a mental-health-flagged item in each table stays hidden without that scope while every medication comes through; unknown section and version; nothing before Allow or after the end; `portal_status` scope keys; the `create_share_code` overload (old call shape, all four new scopes required); execute grants |
| `09_documents.sql` **[new]** | Upload of each type and the round trip; wrong type, wrong bytes, renamed file, bad base64, over 3 MB, no title; the per-account caps (bytes and count); the bytes table's own checks; what the browser may do; another account cannot list, delete or fetch; `portal_get_document` only while active with Documents (and Mental health for a flagged file), never another patient's file, nothing after the end, view logged; delete removes the bytes |
| `10_redesign_seed_account.sql` **[new]** | `seed_demo_record_v2` matches the boards (medications, Concerta's periods and notes, past medications, visit dates and detail, results and the low Ferritin, the nine events, relatives, care team, vitals, no penicillin antibiotic), resets, refuses real accounts; insurance stores only the last four and has no password column or argument; `export_my_data(version 2)` covers every table and the original is unchanged; isolation and anon on every new table; a child row cannot attach to another user's parent; account deletion removes every new row and file |

**The old app's calls, proved unaffected (November 2026).** After the redesign's migrations were applied, files 01 to 06 were run unchanged against the hosted project and every check passed (01: 14, 02: 8, 03: 32, 04: 18, 05: 18, 06: 19). Over HTTP with the publishable key and a deliberately wrong server secret, PostgREST resolved `portal_get_record` with the old three keys and with `version` each to one function (`invalid_server_secret`, no `PGRST203` ambiguity), and `create_share_code` with no keys, the old keys and the new keys each to one function (`42501` without a user session); naming only `share_documents` matched none (`PGRST202`). The app's TypeScript compiles against the regenerated types.

---

## 10. The redesigned record: sections and shapes

**[new]** One builder serves two readers with the same shapes: the doctor through `portal_get_record(..., version: 2)` (only what the session grants) and the patient through `my_record(section)` (everything). Every shape is already ordered and joined; the screens do not join tables themselves. Dates are `"YYYY-MM-DD"`, timestamps ISO strings in UTC. Numbers are JSON numbers (`36`, `6.2`), never padded.

### The envelope

```json
{
  "version": 2,
  "section": "medications",
  "shared": true,
  "patient":  { "first_name", "last_name", "date_of_birth", "age", "sex", "city" },
  "critical": { "blood_type": "A+", "allergies": ["Penicillin"], "implants": [] },
  "scope":    { "critical_safety": true, "medications": true, "conditions", "recent_visits", "full_timeline",
                "care_team", "mental_health", "documents", "insurance", "family_history", "medication_notes" },
  "data": { ... } | null
}
```

`patient` and `critical` are always there (Safety info is always shared). `scope` is the session's grants (as in `portal_status`), or `null` from `my_record`. `shared: false` means the patient did not grant this section: `data` is `null` and nothing behind it was read. Show "Not shared".

### Sections and their `data`

| `section` | Shared when | `data` |
|---|---|---|
| `overview` | always | `{ "conditions": [condition] \| null, "recent_visits": { "past": [entry], "upcoming": [entry] } \| null, "medications": [medication] (current only), "vitals": vitals \| null }`. `conditions` is null without Conditions; `recent_visits` null without Recent visits; `vitals` (`{ "recorded_on", "systolic", "diastolic", "heart_rate", "weight_kg", "spo2" }`) null unless Recent visits or Full timeline was granted, or none recorded. |
| `conditions` | Conditions | `{ "conditions": [condition] }`, unresolved first, then in the order added |
| `recent_visits` | Recent visits | `{ "past": [entry], "upcoming": [entry] }`. `past`: the 3 most recent entries at or before now, newest first. `upcoming`: every later entry, soonest first (not clickable on the screens). For a doctor, never a personal note. |
| `medications` | always | `{ "current": [medication], "past": [medication] }`. Current: newest-started first (Concerta, Levothyroxine, Warfarin, Salbutamol in the demo). Past: most recently ended first. Every medication, always: the mental health switch never hides one. |
| `full_timeline` | Full timeline | `{ "events": [event], "visits": [entry] }`. `events`: the full timeline, newest first. `visits`: every entry at or before now, newest first (the older visits the Recent visits pane points to: "Older visits are in the full timeline"). |
| `care_team` | Care team | `{ "care_team": [{ "id", "name", "role", "organisation", "kind" }] }`, GP first, then specialists, then pharmacies |
| `family_history` | Family history | `{ "relatives": [relative] }`, grandparents first, then parents, aunts and uncles, then siblings, then children; maternal before paternal |
| `insurance` | Insurance | `{ "connections": [insurance] }`. For a doctor only a connection with `include_in_shares` on, so the list can be empty while the section is shared. |
| `documents` | Documents | `{ "documents": [document] }`, newest first |
| `mental_health` | Mental health | `{ "conditions": [condition], "visits": [entry], "events": [event], "documents": [document] }`: the items flagged as mental health, each only when its own section was also granted (conditions with Conditions, visits with Recent visits or Full timeline, events with Full timeline, documents with Documents). |

Everywhere, for a doctor: an item flagged `is_mental_health` (a condition, entry, event, document or relative's condition) appears only when Mental health was granted. A medication note appears only when Medication notes was granted **and** that period's `note_shared` is on; otherwise `note` is `null` (the doctor never learns a note exists). Unlike the old version, the visit the share was started from is not hidden: the portal board lists today's GP visit with its detail.

### An entry

A visit, result, prescription, letter, imaging, vaccination, session notes or (owner only) personal note.

```json
{ "id", "kind", "title", "occurs_at", "upcoming": false, "clinician", "place", "body", "is_mental_health", "source",
  "detail": null
    | { "kind": "text", "reason", "assessment", "plan", "follow_up", "medication", "quantity", "pharmacy" }
    | { "kind": "result", "results": [{ "id", "name", "value", "unit", "ref_low", "ref_high", "flag": "low" | "high" | null }] } }
```

- `kind: "result"` entries always have result `detail` (rows in `position` order; `results` may be empty).
- Other entries have text `detail` when any of `reason`, `assessment`, `plan` or the prescription fields is set, otherwise `null`. Show the non-null fields in order: Reason, Assessment, Plan, Follow-up; for a prescription Medication, Quantity, Pharmacy.
- `session_notes` entries map the doctor's notes: Chief complaint into `reason`, then `assessment`, `plan`, `follow_up`.
- `upcoming` is `occurs_at > now()`.
- Visit detail meta line: the date, `clinician` and `place` ("2 Nov 2026, ordered by Dr Hennessy, Mater Hospital" for a result).

### A medication

```json
{ "id", "name", "status": "current" | "past", "unit": "mg",
  "strength": 36, "strength_label": "36mg",
  "schedule": "Morning" | "Evening" | "As needed" | null,
  "form", "frequency", "timing", "drug_class", "indication", "instructions",
  "prescriber", "prescriber_specialty", "prescriber_org",
  "started_on", "ended_on", "refill_due_on",
  "supply_days_left": 8 | null,
  "period_count": 5,
  "periods": [{ "id", "strength": 36, "strength_label": "36mg", "start_date", "end_date": null,
                "date_precision": "day" | "month" | "year", "prescribed_by", "note",
                "note_shared": true  /* owner only */ }] }
```

- `strength` and `strength_label` are the latest period's. A medication with no period (its old `dose` text did not read as a strength) has `strength: null`, `strength_label` = the dose text, `periods: []`.
- `periods` newest first; the current strength is the one with `end_date: null`. A past medication has every period ended. Draw the step chart oldest first (reverse the array).
- "Now 36mg, since Feb 2025": the first period's `strength_label` and `start_date`, shown at its `date_precision`.
- Past list sub line: `started_on` to `ended_on` and the prescriber.
- `supply_days_left`: `refill_due_on` minus today, current medications only ("8 days left").
- `period_count`: the number of periods. (The board's "5 strength changes" for Concerta counts its 5 periods.)
- Portal history line: `Jane: "<note>"` only when `note` is not null; otherwise no label and no gap.

### An event

```json
{ "id", "kind": "infection" | "condition", "title", "occurred_on", "date_precision",
  "clinician", "place", "seen_by": "Dr Hennessy, Rathmines Medical Centre",
  "outcome": "resolved" | "settled" | "ongoing" | "seasonal" | "managed" | null,
  "notes", "is_mental_health",
  "prescriptions": [{ "id", "name": "Doxycycline 100mg", "detail": "7 days, from 2 Aug",
                      "medication_id", "medication_period_id" }] }
```

Sub line "Aug, Infection" and sheet meta "Aug 2026, Infection" come from `occurred_on` at `date_precision` and `kind`. `outcome` is lower case: capitalise it ("Resolved"). `prescriptions` in order; a line may be "Nothing prescribed" / "Rest and fluids".

### A relative

```json
{ "id", "relation": "paternal_grandfather", "label": "Dad's dad", "generation": -2, "side": "paternal",
  "conditions": [{ "id", "name": "Heart attack", "age_at_diagnosis": 61, "category": "heart",
                   "is_mental_health": false, "label": "Heart attack at 61" }] }
```

`generation`: -2 grandparents, -1 parents, aunts and uncles, 0 siblings, 1 children, `null` for `other`. `side`: `maternal`, `paternal` or `null`. The tree places nodes from these two; the patient's own node ("You" / "Jane") is drawn by the app and is not in the data (its "3 conditions" comes from the conditions section, which the doctor sees only with Conditions). Empty `conditions`: "None known". The tree's filters use `category`.

### A condition

`{ "id", "name", "status": "managed" | "ongoing" | "resolved", "clinician", "specialty", "diagnosed_year", "diagnosed_note", "is_mental_health" }`. Sub line "Managed, since 2019" or "Dr O'Mahony, since 2019"; `diagnosed_note` ("since childhood") when there is no year.

### A document

`{ "id", "title", "content_type", "byte_size", "document_date", "created_at", "is_mental_health" }`. Type label: PDF for `application/pdf`, Photo for the images. Open the file with `my_document_file` (patient) or `portal_get_document` (doctor).

### Insurance

`{ "id", "provider", "member_number_masked": "•••• 4821", "plan_name", "renews_on", "via": "provider" | "manual", "include_in_shares", "connected_at" }`.

---

## 11. Worked example: a share with the new scopes

**[new]** Jane shares her record with Medication notes and Family history on, from today's GP visit. P is the patient's phone, S the portal's server routes.

```ts
// P: demo only
await supabase.auth.signInAnonymously();
const { data: seed } = await supabase.rpc("seed_demo_record_v2");
// seed = { ok: true, appointment_entry_id: "..." }

// P: the phone screens read the same shapes the doctor will get
const { data: meds } = await supabase.rpc("my_record", { section: "medications" });
// meds.data.current[0] = { name: "Concerta", strength_label: "36mg", schedule: "Morning", period_count: 5,
//   periods: [{ strength: 36, start_date: "2025-02-01", end_date: null, date_precision: "month",
//               prescribed_by: "Dr Hennessy", note: "Back on 36. Smoother and sleeping better.", note_shared: true }, ...] }

// P: Share confirm -> Create share code. All four new tiles must be named.
const { data: s1 } = await supabase.rpc("create_share_code", {
  share_documents: false, share_family_history: true, share_insurance: false, share_medication_notes: true,
  share_conditions: true, share_recent_visits: true, share_full_timeline: false,
  share_care_team: true, share_mental_health: false,
  allow_notes: true, duration_kind: "30m",
  appointment_entry_id: seed.appointment_entry_id,
});
// s1.status = "code_issued", s1.share_family_history = true, s1.share_medication_notes = true

// S: the doctor types the code (unchanged), P taps Allow (unchanged)
// S: portal_status -> { status: "active", scope: { ..., family_history: true, medication_notes: true,
//      documents: false, insurance: false, full_timeline: false, mental_health: false }, ... }
// The rail: Overview, Recent visits, Medications, Care team, Family history as links;
// Full timeline, Documents, Insurance, Mental health dimmed with "Not shared".

const { data: med } = await server.rpc("portal_get_record", {
  server_secret, portal_token: cookie, section: "medications", version: 2,
});
// med.shared = true
// med.data.current[0].periods[0].note = "Back on 36. Smoother and sleeping better."  (scope on, note_shared on)
// med.data.current[0].periods[0] has no note_shared key

const { data: tl } = await server.rpc("portal_get_record", {
  server_secret, portal_token: cookie, section: "full_timeline", version: 2,
});
// tl = { version: 2, section: "full_timeline", shared: false, patient: {...}, critical: {...}, scope: {...}, data: null }
// nothing was read, nothing logged: show "Not shared" (the rail item is not a link anyway)

const { data: fam } = await server.rpc("portal_get_record", {
  server_secret, portal_token: cookie, section: "family_history", version: 2,
});
// fam.data.relatives = 7 relatives, grandparents first: { label: "Mum's mum", generation: -2, side: "maternal", ... }

const { data: doc } = await server.rpc("portal_get_document", {
  server_secret, portal_token: cookie, document_id: someId,
});
// null: Documents was not granted

// P or S ends the session as before; every portal_get_record and portal_get_document call returns null after.
// access_events: code_generated (with the new scopes), requested, approved, section_viewed for each shared
//   section opened (medications, family_history...), notes_saved, ended
```

---

## 12. After the redesign ships: what to remove

**[new]** Once the old app no longer runs against this database, these exist only for it and can go (in one migration, after checking nothing calls them):

- `create_share_code(share_conditions, share_recent_visits, share_full_timeline, share_care_team, share_mental_health, allow_notes, duration_kind, appointment_entry_id)`, the original. The new overload's four scopes could then get defaults if wanted, since nothing would be ambiguous.
- `portal_get_record(server_secret, portal_token, section)`, the three-argument version, and `private.portal_record_json`. `version` could then become optional.
- `seed_demo_record()`. (`seed_demo_record_v2` could be renamed in the same release as the app.)
- `export_my_data()`, the original. `version` could then become optional.
- The sync trigger `medications_sync_periods` and `private.sync_medication_periods()`, once the redesigned app writes strengths only through `log_strength_change` and every medication has a period. Keep `private.parse_dose()` while any row might lack `unit`.
- `medications.dose`, once nothing reads it: the strength lives in `medication_periods`, the unit in `medications.unit`. Backfill `unit` from `dose` first. Until then `log_strength_change` keeps `dose` filled.
- Not to remove: `medications.started_on` and `ended_on` (status and the past list use them); old section names in the access log (history).

---

## 13. Decisions made for the redesign

**[new]** Where the brief left a choice open, the option that exposes less and stores less was taken.

- **Scopes on the session row.** The four new scopes are columns on `share_sessions`, so the session object, realtime and the access log carry them. The existing `share_full_timeline` and `share_mental_health` columns are the Full timeline and Mental health tiles.
- **Overloads, not new names.** Adding arguments with defaults to a function the old app calls would make every old call ambiguous (two functions would match), so the new versions of `create_share_code`, `portal_get_record` and `export_my_data` take an argument with no default (the four scopes, `version`). Old calls reach the originals; new calls reach the new ones.
- **What an ungranted section returns.** `shared: false` and `data: null`, with the header data the page needs. Not an error (a denial is a normal state the rail already shows), and not logged (nothing was seen). An unknown section name is an error (`invalid_section`), as before.
- **Mental health items need two scopes.** A flagged item appears only when Mental health and its own section were both granted (a flagged document needs Documents and Mental health). A relative's condition can be flagged too, though the notes name four tables: a relative's mental health is as sensitive as the patient's.
- **Medication notes need two switches.** The Medication notes scope for the session and `note_shared` on the period. Strength, dates and prescriber travel with Medications. The doctor never sees `note_shared` itself.
- **Insurance needs two switches.** The Insurance scope for the session and the connection's `include_in_shares`. The app should pre-set the Insurance tile from `include_in_shares`.
- **Insurance stores no number.** Only the last four characters of the member number are kept; the function takes the number and drops the rest. No column or argument could hold a password. One connection per account.
- **Documents.** Bytes in a private table the API cannot reach, checked by leading bytes and size in the table itself; PDF, JPEG, PNG; 3 MB a file; 20 MB and 100 files per real account, 3 MB and 5 files per demo account, 100 MB for all demo accounts together (the free plan's database is 500 MB and demo accounts last 24 hours). The owner deletes through the table; uploads only through the function.
- **Today's visit is not hidden in version 2.** The old version hides the visit a share was started from; the portal board shows it, with its detail, under Recent visits, so version 2 includes it.
- **Full timeline also carries every past visit** (`full_timeline.visits`), as the old full timeline did, because the Recent visits board says "Older visits are in the full timeline". The Full timeline board itself shows the events.
- **Dates with precision.** Periods and events store a date and `date_precision` (`day`, `month`, `year`) rather than text, so they sort and chart; the boards' "Jan 2024" is a month, "2015" a year, "2 Aug 2026" a day.
- **Status is computed.** A medication's current or past status comes from `ended_on` (as the old app does), not a stored column that could disagree.
- **Old-style writes keep working.** A trigger turns the old app's `dose` edits into periods (closing, never overwriting), and the migration gave every existing medication its first period without changing any existing row.
- **Demo seed values not on the boards.** Vitals stay 43 days ago, as in the old seed. Concerta has no drug class or indication (the boards show none, and adding one would add mental health data). Past medications' indications name the timeline event they were for. Concerta's and Levothyroxine's notes are seeded `note_shared: true`, so the portal board's `Jane: "..."` lines appear when the Medication notes scope is granted (off by default).
- **Board inconsistencies left for Aoife.** Share code board: "Medications, 3 active" (the record has 4 current). Medications board: "5 strength changes" for Concerta (5 periods, 4 changes). Home's "Recent" leaves out today's GP visit while Record's timeline shows it: the app's choice; both come from the same data.
