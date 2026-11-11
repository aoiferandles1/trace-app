# For Aoife to review

Everything in the build that differs from the Figma file, or that Figma does not have yet: accessibility substitutions, new strings, new screens and guesses. Each entry says what changed and why. Nothing here is final until you have looked at it.

Started in Phase 1 (tokens and UI kit). Later phases add their screens and strings to the sections below.

## 1. Accessibility substitutions

Target: WCAG 2.2 AA (PLAN.md section 10). Contrast ratios are against white unless noted.

| # | Where | Figma | Build | Why |
|---|---|---|---|---|
| A1 | Any secondary text that carries meaning (helper text, meta lines, placeholders, tab labels, "Step 3 of 7") | Text/Secondary `#8A94A3` (3.1:1, 2.9:1 on Surface/Page) | Text/Tertiary `#5C677A` (5.7:1) | 1.4.3 text contrast. `#8A94A3` is kept as a token for decoration only. |
| A2 | Indigo text: secondary and ghost button labels, links, selected choice card label, live banner time chip, portal "trace" wordmark, eyebrows | Brand/Indigo `#5B7AE8` (3.9:1, 3.6:1 on Indigo Tint) | Indigo/Text `#4258CB` (6.0:1, 5.5:1 on tint) | 1.4.3. Several final screens already use `#4258CB` (p-request buttons, session notes); the Design System components still use `#5B7AE8`. |
| A3 | Text input, text area, select and empty code box outlines | Border/Default `#E1E4EA` (1.3:1) | New token Border/Control `#7A8495` (3.8:1 on white, 3.5:1 on Surface/Page, 3.3:1 on Surface/Sunken) | 1.4.11: a field's edge must be visible at 3:1. This is the most visible change; the fields read slightly heavier than in Figma. |
| A4 | Switch "off" track | `#C8CED8` (1.6:1) | Border/Control `#7A8495` | 1.4.11: the off state must be visible. The white thumb on it is 3.8:1. |
| A5 | Choice card (selected) description | Brand/Indigo at 75% opacity | Indigo/Text, full opacity | 1.4.3. |
| A6 | Secondary buttons, critical strip pills | 0.5px borders | 1px borders | Half-pixel lines render unevenly or vanish on many screens. |
| A7 | Portal session notes fields | 12px text | 14px text | 12px body text in a writing field is hard to read; labels stay 12px caps. |
| A8 | Small controls: Button sm (32px) and md (40px), filter tabs (32px), switches (32px) | Visual size only | Same look, 44px tall tap target (invisible) | 2.5.8, and PLAN.md's 44px rule. |
| A9 | Medication card chevron (16px) | Chevron is the button | The whole card header is one button with `aria-expanded` | Tap target and screen reader name. |
| A10 | Tab bar tabs | 56 x 48 | 56 x 48 (48 x 48 below 375px wide, to fit 320px screens) | Reflow at 320px (1.4.10). |
| A11 | Focus rings | Shadow: 2px white then 2px Indigo/Text | 2px Indigo/Text outline with a 2px gap; white on indigo surfaces | Same look; an outline also shows in Windows high contrast mode. Every interactive element has one. |
| A12 | Error states | Red border, red helper text | Red border plus an alert icon and a message that says what is wrong | 1.4.1 and 3.3.1: not colour alone. |
| A13 | Code boxes (sign-in and portal) | Four separate boxes | One real input drawn as boxes: numeric keyboard, paste, one-time-code autofill, one field for screen readers | PLAN.md section 10. |
| A14 | Tab bar, active tab | Indigo/Text icon and label (colour only; Indigo/Text and Text/Tertiary are 1.1:1 apart) | Same colours, and the active label is bold; `aria-current="page"` for screen readers | 1.4.1: the current tab must not be shown by colour alone. |
| A15 | Peach and teal icon tiles with white icons (refill card, banner cards) | White on `#E8906B` (2.4:1), on `#00A896` (3.0:1) | Unchanged | The icons are decorative; the text beside them carries the meaning. Flagging in case you want darker tiles. |
| A16 | p-active avatar (white initials on Brand/Indigo, 3.9:1) | | Kept, at large size only (96px) | Large text needs 3:1. Smaller avatars use Indigo/Accessible or the indigo tint. |

## 2. Component differences and guesses

| # | Where | What I did | Why, or what to check |
|---|---|---|---|
| G1 | Spacing scale | Foundations shows 4, 8, 12, 16, 24, 32, 48, 64, 80. PLAN.md section 5 also lists 20, which the Button component uses. Both are available (Tailwind's 4px steps). | Confirm 20 is intended. |
| G2 | Radius 12px and 28px | Used widely in Figma as raw values (hint strips, choice cards, timeline cards, select; tab bar and sheet corners). Added as `--radius-md` (12) and `--radius-sheet` (28). | Not Figma variables. |
| G3 | Display/SM line height | Figma says 100%. Built at 1.2 so two-line headings ("Dr Hennessy has access") do not touch. | |
| G4 | Field labels | Input labels are 14px Regular, Select labels 12px Medium in the Design System. All form labels are 14px Regular. | One consistent label style. |
| G5 | Portal sidebar | The Design System's Doctor Sidebar is indigo/600 with an indigo/700 active row; c-overview uses Surface-Dark `#3A4EBF` with an Indigo/Accessible active row. Built from c-overview. | |
| G6 | Critical safety strip | Three versions in Figma: Design System (outlined pills), p-record (filled `#B83C2E` pills, a raw value), c-overview (white pills, lighter tint). Built as `variant="patient"` and `variant="portal"`; `#B83C2E` is now the `--critical-pill` token. | |
| G7 | Condition tag colour | p-record's tags use the 600 shade; the Pill component uses 700. Built with the Pill's 700 shades. | Both pass AA. |
| G8 | Condition colours | Figma gives each condition its own colour (indigo, peach, teal) rather than one per status. Built as a `colour` prop with `conditionTone(index)` cycling in that order; resolved conditions show a neutral tag. | Confirm whether colour should mean anything (for example status or specialty). |
| G9 | Timeline title row | Figma's text runs under the chevron on phones. The kind tag now wraps under the title when there is no room, and the small dot between title and tag is gone. | |
| G10 | Tertiary button, disabled | Figma: indigo fill with Brand/Indigo text. Built as translucent white with white text. | Disabled states are exempt from contrast; check the look. |
| G11 | Header bell | Not built (out of scope, PLAN.md section 11). `ScreenHeader` has an `action` slot instead. | |
| G12 | Toggle "critical" tone | Built (red when on) but no final screen uses it yet. | |
| G13 | Access request sheet, Allow and Deny | Both are secondary (outlined) buttons of equal weight, as in p-request. Escape and tapping outside do nothing: the patient answers with a button. | |
| G14 | Medication card, expired | No expired card design in hand at Phase 1: built as greyed name and a neutral class tag, with "Expired · " before the summary. | Compare with p-meds-expired when that screen is built. |

## 3. New strings

Strings built into components. Screens will add their own in later phases.

| Where | String | Notes |
|---|---|---|
| Critical safety strip, empty | "No allergies or blood type recorded" | New. |
| Locked switch rows (screen readers) | "Locked on" | Read after "Critical safety. Always shared for your safety". |
| Optional fields | "(optional)" after the label | Fields are required unless marked. |
| Field errors (examples on /kit) | "Enter an email address like name@example.ie", "That code doesn't match. Check it with your patient and try again.", "Too many attempts. Try again in 15 minutes." | Stand-ins showing the style; the real ones come with each screen. |
| Medication card, expired | "Expired · " before the summary line | New. |
| Timeline, upcoming (screen readers) | "Upcoming, " before the date | |
| Live share banner (screen readers) | ". View session" after the visible text | |
| Sign-up progress back link (screen readers) | ". Back to the previous step" after "Step 3 of 7" | |
| Portal skip link | "Skip to the record" | Visible on keyboard focus only. |
| Portal session notes status | "Saving notes…", "Notes saved", "Notes could not be saved. Check your connection and try Save notes again." | New. |
| Portal header (screen readers) | "trace clinical access portal home" on the wordmark link | |
| Portal footer | "Trace · Clinical Access Portal" / "A portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" / "Encrypted in transit · Access logged" | Replaces "© 2025 trace.health · Clinical Access Portal v1.0", the five footer links, and "End-to-end encrypted · Access audited" (PLAN.md section 11). The case study link points at https://aoiferandles.com/trace/; "Terms" points at `/terms`, which a later phase builds. |
| Access request, duration (screen readers) | "Duration: " before "30 min" | |

## 4. New screens

None in Phase 1. The `/kit` page and its `/kit/patient` and `/kit/portal` demos are development tools, not part of the app (they return 404 in production).

## 5. Patient app (Phases 3 and 4)

Built from the final screens where a frame exists (`p-splash`, `p-login`, `p-create`, `p-verify`, `p-about`, `p-medical`, `p-privacy`, `p-profiles`, `p-welcome`, `p-home`, `p-record`, `p-meds`, `p-meds-expired`, `p-add`, `p-profile`), and composed from the UI kit where none does. Dates and "today" are Irish time everywhere.

### 5.1 Accessibility substitutions

| # | Where | Figma | Build | Why |
|---|---|---|---|---|
| P1 | Welcome wordmark "trace" | Brand/Indigo `#5B7AE8`, 40px bold | Unchanged | 3.9:1 passes AA for large text (40px bold). Flagging because it is the one Brand/Indigo text left. |
| P2 | p-splash | A static indigo frame | Shown only while the browser checks for a session (usually a blink). The wordmark carries hidden text ". Loading" | It is a loading state on the web, not a screen. |
| P3 | Sign-up steps, "Step 3 of 7" back link | Every step has "<" | Step 3 has no back link | Step 2 (the code) is behind you once you are signed in. Steps 4 to 6 go back one step. |
| P4 | Field errors on every form | Not designed | Words under the field, red border and icon, focus moves to the first field with an error | 3.3.1. |
| P5 | Medication card | Chevron only | The expanded panel ends with an "Edit" link (named "Edit Warfarin 5mg" for screen readers) | Editing has to start somewhere; the card is where you see the medication. |
| P6 | Delete and destructive actions | Not designed | A confirm sheet (the BottomSheet modal) with the action and "Cancel" as two equal buttons; the action is the indigo primary button | There is no red button in the kit. Check whether you want one. |

### 5.2 Differences from the frames

| # | Screen | What I did | Why, or what to check |
|---|---|---|---|
| D1 | p-login | Added "Just looking? Try Trace with sample data." and a "Try the demo" button under the two buttons, and the footer line "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" | PLAN.md sections 9 and 11. |
| D2 | p-login | Kept "Upload documents, log visits, track medications, all in one record." | Uploads are not in the MVP. Reword if you like. |
| D3 | p-verify | Six boxes, "We sent a 6-digit code to ...", a hint under the boxes "Or open the link in the email on this device.", no "Code expires in 14:52" | Supabase codes are six digits; the email carries a link until its template is changed; the expiry is a project setting the screen cannot know. "Resend code" sends a new one and says "We sent a new code." |
| D4 | p-about | Date of birth is the browser's date field (it shows the phone's own date format); Country is a list: Ireland first, then nine more and Other | A real date and no typing errors. |
| D5 | p-about | Kept "Used to verify your identity with healthcare providers" under Country | Nothing verifies identity (PLAN.md section 11). Suggest rewording. |
| D6 | p-medical | Kept both lines with em dashes verbatim ("This is always shown to any doctor you share with — it can never be hidden." and "... always see it — including in emergencies.") | Your copy rule says no em dashes; also there is no emergency access in the MVP, so "including in emergencies" overclaims. |
| D7 | p-medical | Allergies and implants are one line each, split on commas; the hint adds "Separate them with commas." Implants placeholder "e.g. pacemaker, stent" with "(optional)" after the label | The database keeps lists. |
| D8 | p-privacy | Kept "documents you upload" and "Trace staff cannot access your health record" | Uploads are not in the MVP; the second is true only while you are the only real user (PLAN.md section 11). Reword before inviting anyone. |
| D9 | p-privacy | Kept "Optional — you can change this in settings" (em dash) | The setting is in Edit profile ("Reminders and health tips by email"). Trace sends no emails yet. |
| D10 | p-privacy | Switches sit on the right of their text (the kit's SwitchRow), not the left | One switch layout across the app. "I agree" with the agreement off shows "Turn on the agreement to continue." |
| D11 | p-profiles | "Add Emergency and Specialist profiles later" hidden. Both buttons move on: the GP visit profile is the defaults every share starts from, so there is nothing to store. After "I'll do this later", Welcome shows "GP visit profile" / "Ready whenever you share. You can check it before every share." without a tick | PLAN.md section 11. |
| D12 | p-welcome | "Add your first entry" says "Log a visit, write a note, or add a medication" (Figma: "Upload a document, log a visit, or add a medication"). If no critical safety was entered: "Add your critical safety details" / "Blood type, allergies and implants, from Profile", without a tick | No uploads; the critical line must not claim something was saved. |
| D13 | p-home | No bell, no "Upload doc". Four quick actions across the row. "Upcoming" is the next visit in the future, with "Today" or "2d". The refill card shows the current medication with the nearest refill date that is today or later; the third stat tile ("8 days until refill") hides when there is none. "Recently added" is the three latest past entries | PLAN.md sections 7 and 11. Check whether the refill card should only show within, say, 14 days. |
| D14 | p-home | "added this month" counts entries created this calendar month | PLAN.md section 7. |
| D15 | p-record | No bell. Under Ongoing conditions, an "Add a condition" link. Resolved conditions get their own "Resolved conditions" list. An empty critical strip adds an "Add allergies or blood type" link to Edit profile | PLAN.md section 8, item 3. |
| D16 | p-meds, p-meds-expired | No "Request repeat prescription". An "Add a medication" button closes the list. The first current medication starts open. Cards are listed in the order they were added; expired ones most recently ended first | PLAN.md section 11. |
| D17 | p-add | Only Log appointment, Add a medication and Write a note, plus a new "Add a condition" tile ("A diagnosis or ongoing health issue") | PLAN.md section 11. |
| D18 | p-profile | No back arrow (it is a tab), no "Verified", no PPS number. The third stat is "conditions" (Figma: "documents"). Settings (Push notifications, Face ID unlock, Share anonymised data) and the Share / Export / Help / Privacy tiles are replaced by a "Your data" list: Export my data, Privacy and terms, Delete my account. "Sign out" stays as the last button. Personal details add Sex and Email when known; empty ones read "Not added" | PLAN.md section 11; none of those settings exist. Phase 5 adds "Share my record" as the first row of Your data. |
| D19 | Profile care team | The tag is the role as typed ("GP", "Cardiology", "Pharmacy"); the line under it is the organisation, or "Specialist" / "GP" / "Pharmacy" when there is none. Pharmacies are teal, everyone else indigo | Matches the frame's data. |
| D20 | Pills on p-profiles | The kit's md pill (12px corners), not fully round | Component reuse. |

### 5.3 New screens

| Route | Screen | Built from |
|---|---|---|
| `/login` | Sign in: "Welcome back." / "Enter the email you signed up with. We'll send you a code to sign in." then the p-verify code step ("Check your email.", button "Sign in"), eyebrow "Sign In" | p-create, p-verify |
| `/auth/link-expired` | "That link didn't work." / "Sign-in links work once, for a short time, and only on the device that asked for them. Ask for a new one." / Sign in / Back to Trace | p-create |
| `/terms` | Terms: What Trace is, What is stored, Who can see it, Your rights, The demo (full text in `src/app/terms/page.tsx`) | Plain page |
| `/add/note` | Write a note | Kit forms |
| `/add/appointment` | Log appointment (also takes results, prescriptions, letters, scans) | Kit forms |
| `/add/medication` | Add a medication | Kit forms |
| `/record/[id]`, `/record/[id]/edit` | Entry detail and edit (also the session notes view for Phase 5) | Card, medication card's detail rows |
| `/record/conditions/new`, `/record/conditions/[id]`, `.../edit` | Add, view, edit a condition | Same |
| `/meds/[id]/edit` | Edit or delete a medication | Kit forms |
| `/profile/edit` | Edit profile, with Critical safety and Email sections | Kit forms |
| `/profile/care-team/new`, `/profile/care-team/[id]` | Add, edit, remove someone on the care team | Kit forms |
| Empty states | Home, Record, Meds, Profile care team | Card, section text |

### 5.4 New strings

| Where | String |
|---|---|
| Welcome | "Just looking? Try Trace with sample data." · "Try the demo" · "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" |
| Demo errors | "The demo is switched off right now. Try again later." (anonymous sign-ins off) · "The demo is busy right now. Try again in a few minutes." · "The demo couldn't start. Try again in a moment." |
| Email step errors | "Enter an email address like name@example.ie" · "Trace is invite-only for now." · "Too many emails were sent. Wait a minute, then try again." · "Trace couldn't connect. Check your connection and try again." · "Something went wrong. Try again in a moment." |
| Sign in errors | "We couldn't find an account for that email. Check it, or create your record instead." |
| Code step | "Or open the link in the email on this device." · "Enter the 6-digit code from the email." · "That code didn't work. Check it, or ask for a new code." · "We sent a new code." |
| About you errors | "Enter your first name." · "Enter your last name." · "Enter your date of birth." · "Enter a real date of birth, like 12/03/1991." |
| Any step | "Your details couldn't be saved. Check your connection and try again." |
| Privacy | "Turn on the agreement to continue." |
| Loading and errors | "Loading…" · "This couldn't load. Check your connection and try again." / "Try again" · "Trace couldn't load your record. Check your connection and reload the page." · "This entry / condition / medication / person isn't in your record. It may have been deleted." · "This couldn't be saved. Check your connection and try again." · "This couldn't be deleted. Check your connection and try again." |
| Home | "Your record is empty" / "Start with what you know: a medication you take, your next appointment, or a note for yourself." / "Add to my record" · refill title "... · due today" when due today · badge "Today" |
| Record | "Add allergies or blood type" · "No ongoing conditions." · "Add a condition" · "Resolved conditions" · "Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here." |
| Meds | "No current medications." · "No expired medications." · "Add a medication" · "Edit" · detail rows "Refill due", "Since: 2019 · ongoing / ends 12 March 2027 / ended 3 July 2026" |
| Add | "Add a condition" / "A diagnosis or ongoing health issue" |
| Entry form | "What kind": Visit or appointment, Test result, Prescription, Letter, Scan or X-ray · "Title" · "Date" · "Time" · "Doctor or clinician" · "Where" · "Notes" / "Note" · placeholders "e.g. GP visit", "e.g. Fatigue symptoms", "e.g. Dr Hennessy", "e.g. Rathmines Medical Centre" · hint "Only you can see personal notes. They are never shared with a doctor." · errors "Give the note a title.", "Say what the appointment was for, like GP visit.", "Enter a date, like 14/01/2026.", "Enter a time, like 09:30.", "Write the note." · buttons "Save note", "Save to my record", "Save changes" |
| Mental health switch | "About mental health" / "Kept out of every share unless you include mental health for that share." · on detail screens: "About mental health. Left out of a share unless you include mental health." |
| Entry detail | Title is the kind ("Visit", "Result", "Note"...) · "Upcoming" tag · rows "When", "Doctor", "Where", "Notes", for session notes "Written by", "Chief complaint", "Assessment", "Plan", "Follow-up" · "Personal note. Only you can see it; it is never shared with a doctor." · "Delete entry" / "Delete this entry?" / "It will be removed from your record. You can't undo this." / "Cancel" |
| Condition form | "Condition" · "Status": Ongoing, Managed, Resolved · "Doctor" · "Specialty" · "Year diagnosed" · "Or when it started" (hint "Shown when there is no year.") · "Enter the condition's name." · "Enter a year between 1900 and 2026." · "Save condition" · detail row "Diagnosed" · "Delete condition" / "Delete this condition?" |
| Medication form | "Name" · "Dose" · "Form" · "How often" · "When" · "Drug class" · "What it's for" · "Prescribed by" · "Their specialty" · "Clinic or hospital" · "Started" · "Ends or ended" (hint "Leave empty if you're still taking it.") · "Next refill due" · "Instructions" · "Enter the medication's name, like Warfarin." · "The end date is before the start date." · "Save medication" · "Delete medication" / "Delete Warfarin 5mg?" / "It will be removed from your record. To show you stopped taking it, set an end date instead." |
| Profile | "Your data" · "Export my data" (while working: "Preparing your file…") · "Privacy and terms" · "Delete my account" · "Not added" · "No one on your care team yet." · "Add to your care team" · "Your data couldn't be exported. Check your connection and try again." |
| Delete account | "Delete your account?" / "Your whole record goes with it: profile, conditions, medications, timeline, care team and access log. This can't be undone. You can export your data first." / "Delete everything" / "Keep my account" / "Your account couldn't be deleted. Check your connection and try again." |
| Edit profile | Sections "Personal details", "Critical safety" ("Always shown first to any doctor you share with."), "Email" · "Sex" · "Phone" · "Address" · "Town or city" · "Reminders and health tips by email" / "Optional. Trace does not send these yet." |
| Care team form | "Name" · "Type": GP, Specialist, Pharmacy · "Role or specialty" · "Practice, clinic or shop" · "Enter a name, like Dr Hennessy." · "Remove from care team" / "Remove Dr Hennessy?" / "They will be removed from your care team. Nothing else in your record changes." |
| Export file | `trace-export-YYYY-MM-DD.json` |

## Clinician portal

Phase 6: `/view` (before the record opens) and `/view/session` (the record). Built from the c-* frames; everything below either has no frame or differs from its frame on purpose.

### New screens (no Figma frame)

| Screen | Where | What it is |
|---|---|---|
| Name step | `/view`, before the code | The c-code card with "Who is asking?" and three fields. Pre-filled with Dr Hennessy, GP, Rathmines Medical Centre when the URL has `?demo`. Remembered in this browser; a returning doctor goes straight to the code. |
| Request timed out | `/view`, after waiting | The c-code card: the patient did not answer in 5 minutes. |
| Code withdrawn | `/view`, after waiting | The c-code card: the patient cancelled the share before answering. Not in PLAN.md's list, but the database has the state (`cancelled`). |
| Access paused | `/view/session` | The record and sidebar are gone; a card on the page background, with the notes panel still beside it so the doctor can finish writing. |
| Session ended | `/view/session` | Indigo, like c-end: a "Session ended." hero and a card that says who ended it (the patient, the doctor, or the timer) and whether notes reached the record. |
| Care team | `/view/session/care-team` | One white card per person (name, role and practice, a GP / Specialist / Pharmacy tag), in the overview's card style. |
| Below 1024px | every portal screen | PortalShell stacks: the sidebar becomes a row of section tabs, the notes panel goes under the record. The LIVE banner wraps by its own width, since from 1024px the record column can be under 400px wide. |

### New strings

| Where | String |
|---|---|
| Name step | Eyebrow "NEW SESSION", heading "Who is asking?", "Your patient sees these details on their phone before they decide. Trace does not check them.", fields "Your name", "Role (optional)" with hint "For example GP or practice nurse", "Practice (optional)", "Continue", "Remembered on this computer for next time." Error: "Enter your name, as your patient knows you." |
| Code card | "Requesting as Dr Hennessy, GP, Rathmines Medical Centre. Change details" (where Figma has "Or scan their QR code instead") |
| c-code-error | Field error under the boxes: "Wrong code. 4 tries left before a 15 minute pause." (the count is live). In Figma the boxes alone show it, in colour only. |
| c-code-locked | Under Figma's line: "Code entry is paused for this browser until 14:05." / "You can try again now." "Enter a new code" stays disabled until then. |
| Waiting | Screen readers: "The patient has about 4 minutes to respond" (the ticking time is hidden from them). Steps read "(done)", "(in progress)", "(not yet)". |
| Request timed out | Eyebrow "NO ANSWER", "Your patient didn't answer in time.", "Requests close after 5 minutes. Ask your patient for a new code.", "Enter a new code" |
| Code withdrawn | Eyebrow "NOT SHARED", "Your patient withdrew the code.", "They cancelled the share before answering. Ask them for a new code if you still need their record." |
| Access paused | Eyebrow "ACCESS PAUSED", "Time's up on this share.", "The patient's timer ran out, so their record is hidden. It comes back here if they add more time.", "If nothing changes, the session closes at 10:02.", "You can still finish your notes. They go to the record when the session ends.", "End session now" |
| Session ended | Hero "Session ended."; eyebrow "SESSION ENDED"; "Your patient ended the session." / "They stopped sharing from their phone. Access to their record is closed."; "You ended the session." / "Access to the record is closed on both sides."; "The session has closed." / "The patient's time ran out and they did not add more. Access to their record is closed."; "Your session notes were saved to the patient's record." or "No session notes were written, so nothing was added to the record."; "Start a new session" |
| Care team | Meta "The people Jane sees for their care"; "Jane did not share their care team for this visit."; "No care team recorded." Tags "GP", "Specialist", "Pharmacy". |
| Timeline | Meta "Every entry Jane chose to share" (full timeline); "Jane did not share their timeline for this visit."; "No past entries shared."; section "Upcoming" |
| Medications | "No current medications.", "No expired medications."; expired cards show "Taken: 2024 · ended 3 Jul 2026"; a "Refill due" row when there is a date |
| Overview | "No conditions recorded.", "No current medications.", "No past entries shared.", "No upcoming visits." |
| c-end | "Nothing written" in an empty field; "These notes will be written to Jane's Trace record when you end the session. Jane can read everything you write." (Figma: "She can read", but the app cannot know pronouns); without notes allowed: "The patient did not allow notes for this session, so nothing is added to their record."; on a failed save: "Your latest notes could not be saved. Ending the session will try again." |
| Loading | Screen readers: "Loading the portal". Under the wordmark, the real address: "<site>/view · Clinical Access Portal" (from NEXT_PUBLIC_SITE_URL). Error: "The portal could not reach Trace. Check your connection and reload the page." |
| Errors | "Enter all 4 digits of the code.", "The code could not be checked. Check your connection and try again.", "The request could not be cancelled. Check your connection and try again.", "The session could not be ended. Check your connection and try again." |
| Announcements (screen readers, polite) | "Session started. You are reading the shared record.", "5 minutes of access left.", "1 minute of access left.", "Access paused. The patient's time ran out and the record is hidden.", "The patient added more time. The record is back.", "Session ended. Access to the record is closed." |
| Page titles | "Clinical Access Portal", "Overview", "Timeline", "Medications", "Care team", "End session" (each followed by "· Trace Clinical Access Portal") |

### Differences from the frames, and why

| # | Where | Figma | Build | Why |
|---|---|---|---|---|
| P1 | c-code-expired | Peach hint "Jane will be notified in her Trace app" | Left out | The portal cannot know the patient's name before access, and nothing notifies the patient. |
| P2 | c-denied | "This is normal — patients are in control" | "This is normal. Patients are in control." | No em dashes. |
| P3 | c-denied, Close | No destination | Goes back to the name step, so the next doctor at the computer can start fresh | Check this is what you meant. |
| P4 | c-opening footer line | "Encrypted · read-only · audit logged" | "Encrypted in transit · read-only · access logged" | PLAN.md section 11. |
| P5 | c-opening | Progress and three steps | The overview has loaded before it shows; the bar then fills in about 1.3 seconds (at once with reduced motion) | The name comes from the first record call. |
| P6 | c-waiting steps | Three empty circles | "Code accepted" ticked, "Waiting for approval" in progress | Shows where things are. |
| P7 | All code cards | "Or scan their QR code instead" | Left out | Out of scope (PLAN.md section 11). |
| P8 | "Need help?" | No destination | Moves to the "First time using Trace?" accordion | |
| P9 | Accordion, How it works | "Patient approves — record loads" | "Patient approves, record loads" | No em dashes. Otherwise verbatim. |
| P10 | Accordion, What you'll see | Conditions, Medications, Blood tests, Imaging, Visit history, Documents | Critical safety, Conditions, Medications, Visit history ("Visits, results, prescriptions and letters, newest first"), Care team, Session notes ("If the patient allows it, notes you write go back to their record") | Reference ranges, imaging reports and documents are not in the MVP. Conditions and Medications keep Figma's words. |
| P11 | Accordion, For your practice | Practice profile, practice QR code, team audit log, "Set up a clinic profile — it's free" | "There is nothing to set up. You type your details each time." Two cards: "Your details appear on the consent screen" (says Trace does not check them) and "Remembered on this computer" | None of those features exist, and the doctor's identity is not verified (PLAN.md section 11). |
| P12 | Accordion, Privacy and security | "data controller"; "You cannot edit, export, or permanently store... nothing persists on our side"; "GDPR Article 9 compliant"; "encrypted end-to-end... expires after 30 minutes" | Card 1 without "data controller"; "You cannot edit any part of the record. The view closes when the session ends."; "Every view is logged" in place of the GDPR claim; "Connections and stored data are encrypted. This is not end-to-end encryption. A share code works once and expires after 5 minutes if it is not used." | Claims the MVP cannot back up. The code lasts 5 minutes, not 30. |
| P13 | Accordion icons | Figma icon assets | lucide-react equivalents | Project convention. The "For your practice" and "Privacy and security" header icons are guesses (Building2, ShieldCheck). |
| P14 | Accordion body text | White at 75% | White at 90% | Contrast: 75% on the tinted cards is close to 4:1. |
| P15 | c-overview vitals | "Elevated", "Normal", "Stable" under each value | Left out | They are clinical judgements the app would have to invent. |
| P16 | c-overview "View all" | On Conditions, Medications, Timeline, Upcoming, Vitals | Medications, Timeline and Upcoming only | There is no conditions page or vitals history in the portal. |
| P17 | c-overview timeline | Chevrons on each entry | No chevrons on the overview | There is no entry detail page. On the Timeline page, entries with a body (results, letters, session notes) expand in place, with a chevron. |
| P18 | c-overview medication tags | "ongoing" | "ongoing" on every current medication | Kept, but it carries no information; consider the drug class instead. |
| P19 | c-timeline chips | All, Letters, Results, Imaging, Vitals | All, then one chip per kind actually shared (Visits, Results, Prescriptions...) | Vitals are not timeline entries, and a chip should never show an empty list. Figma also tags the blood test "Visit"; the build uses the entry's real kind. |
| P20 | c-meds chips | "Active", "Expired" | "Active 3", "Expired 2" | The counts help. The order is the database's (newest started first), not the frame's. |
| P21 | c-end | "Visit type GP" | Always "GP" (the share profile is the GP visit profile) | |
| P22 | c-end "Edit notes" | Opens editing | Goes back to the record, where the notes panel is | One place to edit. |
| P23 | c-end before the name loads | "End session with Jane Doe" | "End session" until the name arrives (only on a reload of that page) | |
| P24 | Footer on every portal screen | "© 2026 trace.health", five links, "End-to-end encrypted · Access audited" | The Phase 1 PortalFooter (section 3) | PLAN.md section 11. |
| P25 | c-loading | "trace.health/view" | The deployment's real address | PLAN.md Phase 9. |
| P26 | Dates | "5 JAN 2026" | Same, three-letter months in Irish time ("SEP", not the "SEPT" that en-IE formatting gives) | |
