# Trace: what to review

This is your checklist for the working build of Trace. It lists every place where the app differs from your Figma file, every screen Figma does not have, every new line of copy, every claim that was reworded so it is true of this version, and everything left out.

Nothing here is final until you have looked at it. Each item names the screen it is on. Frame names (p-home, c-overview and so on) are the ones in the Final Screens page. Where an item asks a question, the build uses the answer in brackets until you say otherwise.

How to work through it:

1. **Differences from Figma**: approve each one or overrule it.
2. **New screens**: these have no frame. Redesign them, or approve them as they are.
3. **New copy**: every string the build added. Rewrite freely.
4. **Claims reworded**: Figma copy that the app could not back up, and what it says now.
5. **Left out**: features in the design that this version hides.
6. **Open questions**: things only you can decide.

The live app is at https://trace-app-liard-eta.vercel.app (the patient app), with the doctor's portal at /view and the two-device demo at /demo. A short technical appendix for developers is at the end; you can skip it.

---

## 1. Differences from Figma

### 1.1 Accessibility changes (WCAG 2.2 AA)

Contrast ratios are against white unless noted.

- **A1. Secondary text, everywhere** (helper text, meta lines, placeholders, tab labels, "Step 3 of 7"). Figma uses Text/Secondary #8A94A3 (3.1:1, 2.9:1 on the page colour). The build uses Text/Tertiary #5C677A (5.7:1) for any secondary text that carries meaning, and keeps #8A94A3 for decoration only.
- **A2. Indigo text** (secondary and ghost button labels, links, the selected choice card label, the live banner's time chip, the portal's "trace" wordmark, eyebrows). Figma uses Brand/Indigo #5B7AE8 (3.9:1). The build uses Indigo/Text #4258CB (6.0:1). Several final screens already use #4258CB; the Design System components still use #5B7AE8.
- **A3. Field outlines** (text inputs, text areas, selects, empty code boxes). Figma's Border/Default #E1E4EA is 1.3:1, so a field's edge is nearly invisible. The build adds a Border/Control colour, #7A8495 (3.8:1). This is the most visible change: fields read slightly heavier than in Figma.
- **A4. Switch "off" track.** Figma #C8CED8 (1.6:1); the build uses Border/Control #7A8495, so the off state is visible.
- **A5. Selected choice card description.** Figma has Brand/Indigo at 75% opacity; the build uses Indigo/Text at full opacity.
- **A6. Secondary buttons and critical strip pills.** Figma's 0.5px borders are 1px in the build; half-pixel lines vanish on many screens.
- **A7. Portal session notes fields.** 12px text in Figma, 14px in the build. Labels stay 12px caps.
- **A8. Small controls** (small and medium buttons, filter tabs, switches). Same look, with an invisible 44px tall tap area.
- **A9. Medication card.** Figma's chevron is the button; in the build the whole card header is one button, so it is easy to tap and has a proper name for screen readers.
- **A10. Tab bar.** Tabs are 56 by 48, and 48 by 48 below 375px wide so the bar fits a 320px screen.
- **A11. Focus rings.** Figma draws a 2px white then 2px indigo shadow. The build draws a 2px Indigo/Text outline with a 2px gap (white on indigo screens). Same look, and it also shows in Windows high contrast mode. Every control has one.
- **A12. Field errors.** Figma has a red border and red helper text. The build adds an alert icon and a message that says what is wrong in words.
- **A13. Code boxes** (sign-in and portal). Drawn as boxes, but one real field underneath: numeric keyboard, paste works, the phone can fill in an emailed code, and a screen reader hears one field.
- **A14. Tab bar, current tab.** Figma shows it by colour only (Indigo/Text against Text/Tertiary is 1.1:1). The build also makes the current label bold.
- **A15. Peach and teal icon tiles with white icons** (refill card, banner cards). White on peach is 2.4:1, on teal 3.0:1. Unchanged, because the icons are decorative and the text beside them carries the meaning. Flagged in case you want darker tiles.
- **A16. Large avatar on p-active.** White initials on Brand/Indigo (3.9:1) kept, because at 96px it is large text. Smaller avatars use Indigo/Accessible or the indigo tint.
- **P1. Welcome screen "trace" wordmark.** Kept in Brand/Indigo. At 40px bold it passes as large text (3.9:1); flagged because it is the last Brand/Indigo text.
- **P2. p-splash.** Shown only while the browser checks whether you are signed in, usually a blink. It is a loading state on the web, not a screen.
- **P4. Field errors on every form.** Not designed. Words under the field, a red border and icon, and the cursor moves to the first field with a problem.
- **P5. Medication card.** The open card ends with an "Edit" link, since editing has to start somewhere.
- **P6. Delete and other destructive actions.** Not designed. A confirm sheet with the action and "Cancel" as two equal buttons; the action is the indigo primary button, because there is no red button in the kit. Say if you want one.
- **S1. Access request sheet (p-request), where the cursor starts.** On the request itself, not on "Allow access", so a stray Enter cannot grant access. Tab reaches Allow, then Deny. Escape and tapping outside do nothing.
- **S2. Time's up (p-paused), "+15m" and "+30m".** Screen readers hear "+15m, add 15 minutes" and "+30m, add 30 minutes".
- **S3. Every countdown** (banner, Home card, p-code, p-active). The ticking time is never read aloud. Screen readers hear only: "Sharing started. Dr Hennessy can see your record.", "5 minutes of sharing left.", "1 minute of sharing left.", "Time's up. Dr Hennessy's access is paused until you decide." and "Sharing ended. Dr Hennessy no longer has access to your record."
- **S4. p-code digits.** The four boxes are hidden from screen readers, which hear one line instead: "Your code: 4 8 3 7".
- **S5. p-code "Regenerate" and the p-paused buttons.** Same look, 44px tall tap areas.
- **S6. Status rows on p-active, p-paused and p-ended.** A coloured dot plus the words ("Session active"), and the clock time has a spoken form ("24 minutes 31 seconds left").
- **S25. Focus ring on list rows.** On My profile's "Your data" list and the ended screen's "What would you like to do?" list, the focus ring now sits just inside each row, because the list's rounded corners cut it off outside. *(New in the hardening pass.)*
- **P14. Portal accordion body text.** Figma has white at 75%; the build uses 90%, as 75% on the tinted cards is close to 4:1.

### 1.2 Components

- **G1. Spacing.** Foundations shows 4, 8, 12, 16, 24, 32, 48, 64, 80; the build plan also lists 20, which the Button uses. Both are available. Is 20 intended?
- **G2. Radius 12 and 28.** Used widely in Figma as raw values (hint strips, choice cards, timeline cards, selects; tab bar and sheet corners), not as variables. The build adds them as named sizes.
- **G3. Display/SM line height.** Figma says 100%; built at 1.2 so two-line headings ("Dr Hennessy has access") do not touch.
- **G4. Field labels.** Input labels are 14px Regular and Select labels 12px Medium in the Design System. All form labels are 14px Regular, one style.
- **G5. Portal sidebar.** The Design System's Doctor Sidebar is indigo/600 with an indigo/700 active row; c-overview uses Surface-Dark #3A4EBF with an Indigo/Accessible active row. Built from c-overview.
- **G6. Critical safety strip.** Figma has three versions: Design System (outlined pills), p-record (filled #B83C2E pills, a raw value) and c-overview (white pills, lighter tint). Built as a patient version and a portal version; #B83C2E is now a named colour.
- **G7. Condition tags.** p-record uses the 600 shade, the Pill component the 700. Built with the 700 shades; both pass AA.
- **G9. Timeline title row.** Figma's text runs under the chevron on phones. The kind tag wraps under the title when there is no room, and the small dot between title and tag is gone.
- **G10. Tertiary button, disabled.** Figma has an indigo fill with Brand/Indigo text; built as translucent white with white text. Disabled states are exempt from contrast, but check the look.
- **G11. Header bell.** Not built (out of scope). The header has an empty slot on the right instead.
- **G12. Switch, "critical" tone.** Built (red when on), but no screen uses it yet.
- **G13. Access request sheet buttons.** Allow and Deny are both outlined buttons of equal weight, as in p-request.
- **G14. Expired medication card.** There was no expired card design when the kit was built: the name is greyed, the class tag neutral, and "Expired · " starts the summary line. Compare with p-meds-expired.
- **D20. Pills on p-profiles.** The kit's medium pill (12px corners), not fully round.
- **P13. Portal accordion icons.** Lucide icons in place of the Figma icon assets. The "For your practice" and "Privacy and security" header icons are guesses.

### 1.3 Patient app screens

- **D1. p-login (Welcome).** Adds "Just looking? Try Trace with sample data." and a "Try the demo" button under the two buttons, and the line "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" at the bottom.
- **D3. p-verify.** Six boxes, not four (Supabase's codes are six digits). "We sent a 6-digit code to ...", and under the boxes "Or open the link in the email on this device.", since the email carries a link until its template is changed. No "Code expires in 14:52": the screen cannot know the expiry. "Resend code" sends a new one and says "We sent a new code."
- **D4. p-about.** Date of birth uses the phone's own date picker. Country is a list: Ireland first, nine more, then Other.
- **D7. p-medical.** Allergies and implants are one line each, split on commas; the hint adds "Separate them with commas." The implants placeholder is "e.g. pacemaker, stent", with "(optional)" after the label.
- **D10. p-privacy.** Switches sit to the right of their text (one switch layout across the app). "I agree" with the agreement off says "Turn on the agreement to continue."
- **D11. p-profiles.** "Add Emergency and Specialist profiles later" is hidden. Both buttons move on: the GP visit profile is the defaults every share starts from, so there is nothing to store. After "I'll do this later", Welcome shows "GP visit profile" / "Ready whenever you share. You can check it before every share." without a tick.
- **D12. p-welcome.** "Add your first entry" says "Log a visit, write a note, or add a medication". If no critical safety details were entered, it shows "Add your critical safety details" / "Blood type, allergies and implants, from Profile", without a tick, so it never claims something was saved.
- **P3. Sign-up step 3 (About you).** No back link: the code step is behind you once you are signed in. Steps 4 to 6 go back one step.
- **D13. p-home.** No bell and no "Upload doc", so four quick actions across the row. "Upcoming" is the next future visit, with "Today" or "2d". The refill card shows the current medication whose refill date is nearest (today or later); the third stat tile ("8 days until refill") hides when there is none. "Recently added" is the three latest past entries.
- **D14. p-home.** "added this month" counts entries created this calendar month.
- **D15. p-record.** No bell. Under Ongoing conditions, an "Add a condition" link. Resolved conditions get their own list. An empty critical strip adds an "Add allergies or blood type" link to Edit profile.
- **D16. p-meds and p-meds-expired.** No "Request repeat prescription". An "Add a medication" button ends the list. The first current medication starts open. Cards are in the order they were added; expired ones most recently ended first.
- **D17. p-add.** Only Log appointment, Add a medication and Write a note, plus a new "Add a condition" tile ("A diagnosis or ongoing health issue").
- **D18. p-profile.** No back arrow (it is a tab), no "Verified", no PPS number. The third stat is "conditions" (Figma: "documents"). Settings (Push notifications, Face ID unlock, Share anonymised data) and the Share / Export / Help / Privacy tiles are replaced by a "Your data" list: Share my record, Access log, Export my data, Privacy and terms, Delete my account (and Reset demo on the demo). "Sign out" stays as the last button. Personal details add Sex and Email when known; empty ones read "Not added".
- **D19. Care team on p-profile.** The tag is the role as typed ("GP", "Cardiology", "Pharmacy"); the line under it is the organisation, or "Specialist" / "GP" / "Pharmacy" when there is none. Pharmacies are teal, everyone else indigo.
- **S7. p-apptday.** The card shows the visit's place only ("Rathmines Medical Centre"), not "· Dublin": an entry has one "Where" field. No bell, no "Upload doc".
- **S8. p-apptday.** The card shows on the day of a visit until a share started from that visit has ended. Then Home goes back to normal for the rest of the day.
- **S9. p-home-live.** The Upcoming card is hidden while the live card shows, as in the frame. At Time's up the card reads "Time's up" / "Dr Hennessy · GP visit" / "Access paused · Decide now" with no time; a Manual share reads "No timer · View session".
- **S10. Live banner while paused.** "Dr Hennessy's access is paused" and "Time's up" with a peach dot, in place of "can see your record" and the time, which would be untrue.
- **S11. p-prefs (Confirm preferences).** No Documents or Insurance switches. Back goes to Home (from the card) or My profile (from Profile). "Recent visits (last 3)" and "Full timeline" are separate switches; with both on, the doctor sees the full timeline.
- **S12. p-prefs.** If a doctor can already see the record: "A doctor can already see your record. View session".
- **S13. p-code.** "trace.health/view" is the real address. The heading is set at 36px so it fits one line at 390 wide.
- **S14. p-code.** The list ends with "Not included: ...", as on p-active. The rows follow the choices: "Full timeline" / "Every entry" replaces Recent visits when on; "Mental health history" / "Included" appears when on.
- **S15. p-code, other states.** Once the doctor types the code the timer card reads "Code entered" / "Dr Hennessy is asking". Expired: "This code has expired." / "Make a new code when your doctor is ready." / "No longer works" / "Make a new code" / "Back to home". Cancelled: "This code was cancelled." Denied: "You denied this request."
- **S18. p-request, what they will see.** Built from this share's switches: "Full timeline" replaces "Recent visits (last 3)" when on, "Mental health history" appears when on, "Can add session notes to your record" only when notes are allowed. The grey line lists what is off, for example "Conditions, full timeline, documents, insurance and mental health not included".
- **S19. p-active.** "Rathmines Medical Centre · GP visit" is the practice the doctor typed plus the profile. "3 diagnoses" counts every condition the doctor sees, resolved ones included. Manual shares show "Until you end it" and no clock; "Access ends automatically at" shows the 12 hour limit.
- **S20. p-active.** The chevron at the top left is "Minimise": back to Home while the session carries on.
- **S20b. p-paused (Time's up).** The same "Minimise" chevron, back to Home, so the screen can be left without deciding. The frame has none. *(New in the hardening pass.)*
- **S21. p-paused.** "Session notes saved · access closed" only when notes are allowed and the doctor wrote some, otherwise "Access closed". Adds "If you don't decide, the session closes at 10:35am." "Time used" shows minutes from Allow to the pause ("30 of 30 min").
- **S22. p-ended.** The line under "Session ended" depends on who ended it: "Dr Hennessy no longer has access to your record." (you), "Dr Hennessy ended the session and no longer has access to your record." (the doctor) or "The session closed after Time's up. Dr Hennessy no longer has access to your record." (the timer). Session notes: "View", "None written" or "Not allowed". Under a minute: "Less than a minute".
- **S24. Home, Recently added.** Today's 9:30 visit counts as recently added once the time has passed, so it sits under the share card on appointment days.
- **S24b. Every confirm sheet.** Same look. A sheet left open when you leave a screen now closes itself, and a confirm sheet closes after its action works, so going back to that screen does not reopen it.

### 1.4 Doctor's portal screens

- **P1 (portal). c-code-expired.** The peach hint "Jane will be notified in her Trace app" is left out: the portal cannot know the patient's name before access, and nothing notifies the patient.
- **P3 (portal). c-denied, Close.** Goes back to the name step, so the next doctor at the computer starts fresh.
- **P5. c-opening.** The overview has loaded before this shows; the bar then fills in about 1.3 seconds (at once with reduced motion), because the name comes from the first record read.
- **P6. c-waiting steps.** "Code accepted" ticked and "Waiting for approval" in progress, instead of three empty circles.
- **P8. "Need help?"** Moves to the "First time using Trace?" accordion.
- **P15. c-overview vitals.** "Elevated", "Normal" and "Stable" are left out: they are clinical judgements the app would have to invent.
- **P16. c-overview "View all".** Only on Medications, Timeline and Upcoming; there is no conditions page or vitals history in the portal.
- **P17. c-overview timeline.** No chevrons, since there is no entry detail page. On the Timeline page, entries with text (results, letters, session notes) open in place, with a chevron.
- **P18. c-overview medication tags.** "ongoing" on every current medication, as in Figma. It carries no information; consider the drug class instead.
- **P19. c-timeline chips.** "All", then one chip per kind actually shared (Visits, Results, Prescriptions...), instead of All, Letters, Results, Imaging, Vitals. Vitals are not timeline entries, and a chip should never show an empty list. Figma tags the blood test "Visit"; the build uses the entry's real kind.
- **P20. c-meds chips.** "Active 3", "Expired 2", with counts. Medications are newest started first, not the frame's order.
- **P21. c-end.** "Visit type" always reads "GP" (the share profile is the GP visit profile).
- **P22. c-end "Edit notes".** Goes back to the record, where the notes panel is.
- **P23. c-end before the name loads.** "End session" until the name arrives (only after a reload of that page).
- **P25. c-loading.** The deployment's real address in place of "trace.health/view".
- **P26. Dates.** "5 JAN 2026" as in Figma, three-letter months in Irish time ("SEP", not "SEPT").
- **Below 1024px, every portal screen.** The layout stacks: the sidebar becomes a row of section tabs and the notes panel moves under the record. The LIVE banner wraps by its own width.

---

## 2. New screens (no Figma frame)

Each is built from the UI kit, matching the nearest existing screen. Redesign or approve.

### Patient app

- **Sign in** (from "I already have an account"): "Welcome back." / "Enter the email you signed up with. We'll send you a code to sign in.", then the p-verify code step with the heading "Check your email.", the button "Sign in" and the eyebrow "Sign In". Built from p-create and p-verify.
- **Link expired** (when an emailed sign-in link fails): "That link didn't work.", a line on why, then Sign in and Back to Trace (words in section 3).
- **Terms** (from "Read full terms" and every "Terms" link): a plain page with What Trace is, What is stored, Who can see it, Your rights and The demo.
- **Write a note**, **Log appointment** (also takes results, prescriptions, letters and scans) and **Add a medication**: forms from the Add screen.
- **Entry detail and edit**, also used as the session notes view.
- **Add, view and edit a condition**, reached from Ongoing conditions on the record.
- **Edit or delete a medication**, from the Edit link on a medication card.
- **Edit profile**, with Critical safety and Email sections.
- **Add, edit and remove someone on the care team**, from My profile.
- **Empty states** for a brand-new record: Home, Record, Meds and the care team on Profile.
- **Access log**: every share, newest first, one card each with who (as they typed it), the practice, a status tag, When, How long, Shared, a link to the session notes, and "What happened (6)" opening the events with their times. The newest card starts open.
- **"Share my record" and "Access log" rows** on My profile's Your data list. "Share my record" comes first and is hidden while a doctor has access.
- **"Couldn't load" state on the indigo screens** (the code screen and the live session): if the phone is offline, the screen now says so with "Try again" instead of "Loading…" for ever, and tries again by itself every few seconds. *(New in the hardening pass.)*

### Doctor's portal

- **Name step** (before the code): the c-code card with "Who is asking?" and three fields. Pre-filled with Dr Hennessy, GP, Rathmines Medical Centre in the demo. Remembered on that computer, so a returning doctor goes straight to the code.
- **Request timed out**: the patient did not answer in 5 minutes.
- **Code withdrawn**: the patient cancelled the share before answering.
- **Access paused**: the record and sidebar are gone; a card on the page background, with the notes panel still beside it so the doctor can finish writing.
- **Session ended**: indigo, like c-end, with a "Session ended." heading and a card that says who ended it and whether notes reached the record.
- **Notes not saved** (on the Session ended screen): if the session ended while the doctor had typed notes that had not been saved yet (the patient ended it, time ran out, or the connection dropped), the screen says so and shows the text in a read-only box to copy. Before this, the text simply vanished. *(New in the hardening pass.)*
- **Care team**: one white card per person (name, role and practice, a GP / Specialist / Pharmacy tag), in the overview's card style.

### Demo

- **Demo marker** on every signed-in screen of a demo account: a slim strip at the very top, peach on the light screens and indigo on the indigo ones. Real accounts never see it.
- **Reset demo** row on My profile (demo accounts only), with a confirm sheet. It re-runs the sample record and goes to Home.
- **The two-device demo page, 1100px and wider**: the patient app in a dark phone frame (390 wide) beside the portal in a laptop frame (drawn at 1100 by 760 and scaled to fit), on Surface/Sunken. The phone starts at Welcome, the laptop at the portal's name step, pre-filled.
- **The two-device demo page, narrower**: the phone alone, with a button that opens the portal in a new tab.
- **Check:** at 1440 wide the portal is scaled to about 80% inside the laptop, so its small text is small. Opening it in a real second window always works.

---

## 3. New copy

Every string the build added. All are stand-ins in the voice of the existing screens; rewrite any of them.

### Shared pieces

- Critical safety strip, empty: "No allergies or blood type recorded"
- Locked switch rows, for screen readers: "Locked on", read after "Critical safety. Always shared for your safety"
- After an optional field's label: "(optional)". Fields are required unless marked.
- Field error examples on the component sheet: "Enter an email address like name@example.ie", "That code doesn't match. Check it with your patient and try again.", "Too many attempts. Try again in 15 minutes."
- Expired medication card: "Expired · " before the summary
- Timeline, upcoming entries, for screen readers: "Upcoming, " before the date
- Live share banner, for screen readers: ". View session" after the visible text
- Sign-up progress back link, for screen readers: ". Back to the previous step" after "Step 3 of 7"
- Access request, for screen readers: "Duration: " before "30 min"

### Welcome, sign up and sign in

- Welcome: "Just looking? Try Trace with sample data." · "Try the demo" · "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study · Terms"
- Demo errors: "The demo is switched off right now. Try again later." · "The demo is busy right now. Try again in a few minutes." · "The demo couldn't start. Try again in a moment."
- Email step errors: "Enter an email address like name@example.ie" · "Trace is invite-only for now." · "Too many emails were sent. Wait a minute, then try again." · "Trace couldn't connect. Check your connection and try again." · "Something went wrong. Try again in a moment."
- Email field placeholder: "janedoe@example.ie" (Figma: "janedoe@email.com", which is a real mail provider's domain)
- Sign in: "Welcome back." · "Enter the email you signed up with. We'll send you a code to sign in." · "We couldn't find an account for that email. Check it, or create your record instead."
- Code step: "Or open the link in the email on this device." · "Enter the 6-digit code from the email." · "That code didn't work. Check it, or ask for a new code." · "We sent a new code."
- Link expired: "That link didn't work." · "Sign-in links work once, for a short time, and only on the device that asked for them. Ask for a new one." · "Sign in" · "Back to Trace"
- About you errors: "Enter your first name." · "Enter your last name." · "Enter your date of birth." · "Enter a real date of birth, like 12/03/1991."
- Any sign-up step: "Your details couldn't be saved. Check your connection and try again."
- Privacy: "Turn on the agreement to continue."

### Loading and errors (patient app)

- "Loading…" · "This couldn't load. Check your connection and try again." / "Try again" · "Trace couldn't load your record. Check your connection and reload the page." (now also shown when the phone is offline on opening the app, instead of going back to Welcome)
- "This entry / condition / medication / person isn't in your record. It may have been deleted."
- "This couldn't be saved. Check your connection and try again." · "This couldn't be deleted. Check your connection and try again."
- Sharing summary rows when the counts cannot load (offline): "Always shared" under Medications, "Included" under Active conditions and Care team. *(New in the hardening pass.)*

### Home, record, meds, add

- Home, empty: "Your record is empty" / "Start with what you know: a medication you take, your next appointment, or a note for yourself." / "Add to my record" · refill title "... · due today" when due today · badge "Today"
- Record: "Add allergies or blood type" · "No ongoing conditions." · "Add a condition" · "Resolved conditions" · "Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here."
- Meds: "No current medications." · "No expired medications." · "Add a medication" · "Edit" · detail rows "Refill due", "Since: 2019 · ongoing / ends 12 March 2027 / ended 3 July 2026"
- Add: "Add a condition" / "A diagnosis or ongoing health issue"
- Entry form: "What kind": Visit or appointment, Test result, Prescription, Letter, Scan or X-ray · "Title" · "Date" · "Time" · "Doctor or clinician" · "Where" · "Notes" / "Note" · placeholders "e.g. GP visit", "e.g. Fatigue symptoms", "e.g. Dr Hennessy", "e.g. Rathmines Medical Centre" · hint "Only you can see personal notes. They are never shared with a doctor." · errors "Give the note a title.", "Say what the appointment was for, like GP visit.", "Enter a date, like 14/01/2026.", "Enter a time, like 09:30.", "Write the note." · buttons "Save note", "Save to my record", "Save changes"
- Mental health switch: "About mental health" / "Kept out of every share unless you include mental health for that share." · on detail screens: "About mental health. Left out of a share unless you include mental health."
- Entry detail: the title is the kind ("Visit", "Result", "Note"...) · "Upcoming" tag · rows "When", "Doctor", "Where", "Notes"; for session notes "Written by", "Chief complaint", "Assessment", "Plan", "Follow-up" · "Personal note. Only you can see it; it is never shared with a doctor." · "Delete entry" / "Delete this entry?" / "It will be removed from your record. You can't undo this." / "Cancel"
- Condition form: "Condition" · "Status": Ongoing, Managed, Resolved · "Doctor" · "Specialty" · "Year diagnosed" · "Or when it started" (hint "Shown when there is no year.") · "Enter the condition's name." · "Enter a year between 1900 and 2026." · "Save condition" · detail row "Diagnosed" · "Delete condition" / "Delete this condition?"
- Medication form: "Name" · "Dose" · "Form" · "How often" · "When" · "Drug class" · "What it's for" · "Prescribed by" · "Their specialty" · "Clinic or hospital" · "Started" · "Ends or ended" (hint "Leave empty if you're still taking it.") · "Next refill due" · "Instructions" · "Enter the medication's name, like Warfarin." · "The end date is before the start date." · "Save medication" · "Delete medication" / "Delete Warfarin 5mg?" / "It will be removed from your record. To show you stopped taking it, set an end date instead."

### Profile

- "Your data" · "Share my record" · "Access log" · "Export my data" (while working: "Preparing your file…") · "Privacy and terms" · "Delete my account" · "Not added" · "No one on your care team yet." · "Add to your care team" · "Your data couldn't be exported. Check your connection and try again."
- Delete account: "Delete your account?" / "Your whole record goes with it: profile, conditions, medications, timeline, care team and access log. This can't be undone. You can export your data first." / "Delete everything" / "Keep my account" / "Your account couldn't be deleted. Check your connection and try again."
- Edit profile: sections "Personal details", "Critical safety" ("Always shown first to any doctor you share with."), "Email" · "Sex" · "Phone" · "Address" · "Town or city" · "Reminders and health tips by email" / "Optional. Trace does not send these yet."
- Care team form: "Name" · "Type": GP, Specialist, Pharmacy · "Role or specialty" · "Practice, clinic or shop" · "Enter a name, like Dr Hennessy." · "Remove from care team" / "Remove Dr Hennessy?" / "They will be removed from your care team. Nothing else in your record changes."
- Export file name: trace-export-YYYY-MM-DD.json
- Reset demo: "Reset demo" · "Reset the demo?" · "Jane's record goes back to how it started. Anything you added, and any share, is cleared." · "Cancel" · "The demo couldn't be reset. Check your connection and try again." · announced: "The demo is reset. Jane's record is back to how it started."

### Sharing (patient side)

- Request sheet, under the list: "The name and practice are as they typed them. Trace does not check them."
- Request sheet, share started from Profile: "Sharing your GP visit profile. This share is not linked to an appointment." (in place of "Sharing your GP visit profile for this appointment."; please rewrite)
- Durations on the request: "30 min", "1 hour", "All day", "Until you stop it"
- Access log: "Access log" · "Every share, newest first. Only you can see this." · "You haven't shared your record yet. Every share shows up here." · "No one used this code" · tags "Code ready", "Waiting for you", "Live now", "Time's up", "Ended", "Denied", "Expired", "Cancelled" · rows "When", "How long", "Shared", "Notes" / "Session notes" · "What happened (n)"
- Access log events: "You made a share code" · "Dr Hennessy typed the code and asked for access" · "Dr Hennessy cancelled their request" · "You allowed access" · "You denied access" · "The code expired unused" · "The request closed with no answer" · "Replaced by a new code" · "You cancelled the code" · "Viewed the overview / conditions / the timeline / medications / the care team" · "Time ran out, access paused" · "You added 15 minutes" · "Session notes added to your record" · "You ended the session" · "Dr Hennessy ended the session" · "The session closed after Time's up"
- Share errors: "A doctor can already see your record. End that session before you start a new share." · "That appointment isn't in your record any more. Share from your profile instead." · "This share has reached its 12 hour limit. Save and end it." · "This session has already closed." · "That request has already closed." · "That didn't work. Check your connection and try again."
- Announcements for screen readers (as S3, plus): "Dr Hennessy can see your record again." (after adding time) · "The request from Dr Hennessy timed out." · "Your share code expired." · "The doctor cancelled their request. Your code still works." · "You denied access. Dr Hennessy cannot see your record." · "New code ready: 4 8 3 7."
- Session ended, nothing to show: "No ended session to show" / "Your access log has every share you have made." / "View access log"

### Demo page

- "trace" · "Try both sides of a GP visit" · "Start on the phone: tap Try the demo and share Jane's record. Then type the code into the laptop. Sample data only. Trace is a portfolio project by Aoife Randles, not a medical service. Terms" · captions "Jane's phone", "Dr Hennessy's laptop" · frame names for screen readers "Patient app, on a phone", "Doctor's portal, on a laptop"
- Narrower: "Start on the phone: tap Try the demo and share Jane's record. Then open the doctor's portal and type the code." · "Open the doctor's portal" (screen readers add "(opens in a new tab)")
- Demo marker: "Demo · sample data"

### Doctor's portal

- Skip link (keyboard only): "Skip to the record"
- Header, for screen readers: "trace clinical access portal home" on the wordmark
- Footer: "Trace · Clinical Access Portal" / "A portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" / "Encrypted in transit · Access logged"
- Name step: eyebrow "NEW SESSION", "Who is asking?", "Your patient sees these details on their phone before they decide. Trace does not check them.", fields "Your name", "Role (optional)" with hint "For example GP or practice nurse", "Practice (optional)", "Continue", "Remembered on this computer for next time." · error "Enter your name, as your patient knows you."
- Code card: "Requesting as Dr Hennessy, GP, Rathmines Medical Centre. Change details" (where Figma has "Or scan their QR code instead")
- c-code-error: "Wrong code. 4 tries left before a 15 minute pause." under the boxes (the count is live). In Figma the boxes alone show it, in colour only.
- c-code-locked: "Code entry is paused for this browser until 14:05." / "You can try again now." "Enter a new code" stays disabled until then.
- Waiting, for screen readers: "The patient has about 4 minutes to respond". Steps read "(done)", "(in progress)", "(not yet)".
- Request timed out: eyebrow "NO ANSWER", "Your patient didn't answer in time.", "Requests close after 5 minutes. Ask your patient for a new code.", "Enter a new code"
- Code withdrawn: eyebrow "NOT SHARED", "Your patient withdrew the code.", "They cancelled the share before answering. Ask them for a new code if you still need their record."
- Access paused: eyebrow "ACCESS PAUSED", "Time's up on this share.", "The patient's timer ran out, so their record is hidden. It comes back here if they add more time.", "If nothing changes, the session closes at 10:02.", "You can still finish your notes. They go to the record when the session ends.", "End session now"
- Session ended: heading "Session ended."; eyebrow "SESSION ENDED"; "Your patient ended the session." / "They stopped sharing from their phone. Access to their record is closed."; "You ended the session." / "Access to the record is closed on both sides."; "The session has closed." / "The patient's time ran out and they did not add more. Access to their record is closed."; "Your session notes were saved to the patient's record." or "No session notes were written, so nothing was added to the record."; "Start a new session"
- Notes not saved *(new in the hardening pass)*: "Your last changes to the notes were not saved before the session ended, so they are not in the record. Copy them now if you need them: they are gone when you leave this page." · box label "Notes not saved"
- Notes panel status: "Saving notes…", "Notes saved", "Notes could not be saved. Check your connection and try Save notes again."
- Care team: "The people Jane sees for their care" · "Jane did not share their care team for this visit." · "No care team recorded." · tags "GP", "Specialist", "Pharmacy"
- Timeline: "Every entry Jane chose to share" (full timeline) · "Jane did not share their timeline for this visit." · "No past entries shared." · section "Upcoming"
- Medications: "No current medications.", "No expired medications."; expired cards show "Taken: 2024 · ended 3 Jul 2026"; a "Refill due" row when there is a date
- Overview: "No conditions recorded.", "No current medications.", "No past entries shared.", "No upcoming visits."
- c-end: "Nothing written" in an empty field · "These notes will be written to Jane's Trace record when you end the session. Jane can read everything you write." (Figma: "She can read"; the app cannot know pronouns) · without notes allowed: "The patient did not allow notes for this session, so nothing is added to their record." · after a failed save: "Your latest notes could not be saved. Ending the session will try again."
- Loading: for screen readers "Loading the portal"; under the wordmark the real address, "<address>/view · Clinical Access Portal" · error "The portal could not reach Trace. Check your connection and reload the page."
- Errors: "Enter all 4 digits of the code." · "The code could not be checked. Check your connection and try again." · "The request could not be cancelled. Check your connection and try again." · "The session could not be ended. Check your connection and try again."
- Announcements for screen readers: "Session started. You are reading the shared record." · "5 minutes of access left." · "1 minute of access left." · "Access paused. The patient's time ran out and the record is hidden." · "The patient added more time. The record is back." · "Session ended. Access to the record is closed."
- Browser tab titles: "Clinical Access Portal", "Overview", "Timeline", "Medications", "Care team", "End session", each followed by "· Trace Clinical Access Portal"

---

## 4. Claims reworded

Figma copy that this version cannot back up, and what the app says now. Each needs your words.

- **Portal footer.** Figma: "End-to-end encrypted · Access audited", "© 2025 trace.health · Clinical Access Portal v1.0" and five footer links. Now: "Encrypted in transit · Access logged" and the portfolio line. Trace encrypts connections and stored data and logs access, but it is not end-to-end encrypted.
- **c-opening footer line.** "Encrypted · read-only · audit logged" is now "Encrypted in transit · read-only · access logged".
- **Portal accordion, Privacy and security.** "data controller" removed. "You cannot edit, export, or permanently store... nothing persists on our side" became "You cannot edit any part of the record. The view closes when the session ends." "GDPR Article 9 compliant" became "Every view is logged". "Encrypted end-to-end... expires after 30 minutes" became "Connections and stored data are encrypted. This is not end-to-end encryption. A share code works once and expires after 5 minutes if it is not used." (The code lasts 5 minutes, not 30.)
- **Portal accordion, For your practice.** Practice profile, practice QR code, team audit log and "Set up a clinic profile, it's free" do not exist. Now: "There is nothing to set up. You type your details each time." and two cards, "Your details appear on the consent screen" (which says Trace does not check them) and "Remembered on this computer".
- **Portal accordion, What you'll see.** Figma: Conditions, Medications, Blood tests, Imaging, Visit history, Documents. Now: Critical safety, Conditions, Medications, Visit history ("Visits, results, prescriptions and letters, newest first"), Care team and Session notes ("If the patient allows it, notes you write go back to their record"). Conditions and Medications keep your words.
- **The doctor's identity.** Nothing checks it. The request sheet adds "The name and practice are as they typed them. Trace does not check them.", the name step says the same, and there is no badge on the portal header.
- **"Verified" on My profile.** Left out: nothing verifies identity.
- **PPS number on My profile.** Left out: the app does not collect it.
- **Welcome, third feature.** Figma: "Private and GDPR compliant". Now: "Private by design" (body unchanged: "Your data is yours. No advertising. No data sales. Ever."). Compliance is a legal claim a portfolio project cannot make. *(Changed in the hardening pass.)*
- **Welcome, second feature.** Figma: "Upload documents, log visits, track medications, all in one record." Now: "Log visits, track medications and keep notes, all in one record." Uploads are not in this version. *(Changed in the hardening pass; it was kept before.)*
- **p-about, under Country.** Figma: "Used to verify your identity with healthcare providers". Removed: nothing verifies identity. *(Changed in the hardening pass.)*
- **p-medical, the intro.** Figma: "This is always shown to any doctor you share with — it can never be hidden. Providing this now protects you in an emergency." Now: "This is always shown to any doctor you share with. It can never be hidden. Adding it now means every doctor you share with sees it first." There is no emergency access, and no em dashes. *(Changed in the hardening pass.)*
- **p-medical, the red hint.** Figma ends "...will always see it — including in emergencies." Now: "...will always see it, before anything else." *(Changed in the hardening pass.)*
- **p-privacy, What Trace stores.** Figma: "Your health record, documents you upload, medications you add, and notes you write." Now: "Your health record: the visits, medications and notes you add." *(Changed in the hardening pass.)*
- **p-privacy, Who can see your data.** Figma: "Trace staff cannot access your health record." Whoever runs the database can. Now: "The database is run by Aoife Randles, who made Trace." This matters now that someone else is on the invite list. *(Changed in the hardening pass.)*
- **p-privacy, the reminders switch.** Figma: "Optional — you can change this in settings". Now: "Optional. Trace does not send these yet. You can change this in Edit profile." *(Changed in the hardening pass.)*
- **p-privacy, Your rights.** "Full GDPR rights apply. Irish data protection applies under the Data Protection Act 2018." is unchanged. It describes the law rather than a feature, but check you are happy to say it.
- **Terms, The demo.** "Demo records are deleted after 24 hours" became "A daily clean-up deletes each demo record once it is a day old.", since the clean-up runs once a day and a record can last up to two days. *(Changed in the hardening pass.)*
- **c-denied.** "This is normal — patients are in control" became "This is normal. Patients are in control." (no em dash).
- **Portal accordion, How it works.** "Patient approves — record loads" became "Patient approves, record loads" (no em dash). Otherwise your words.
- **c-end.** "She can read everything you write" became "Jane can read everything you write": the app cannot know pronouns.
- **p-ended, "Add notes or receipts".** Kept, but it opens Add, which has no receipts tile. Suggest "Add notes".
- **A line on Welcome and in the portal footer** says Trace is a portfolio project by Aoife Randles and not a medical service, linking to the case study and Terms. Terms says the same, plus what is stored.

---

## 5. Left out

In the design but not in this version. They are hidden, not shown as "coming later".

- **Home:** the notification bell and the "Upload doc" quick action.
- **Add:** the Upload document, Scan or photograph, Record a vaccination, Family history and Upload a receipt tiles.
- **Meds:** "Request repeat prescription" (there is no pharmacy to send it to).
- **My profile:** Push notifications, Face ID unlock and Share anonymised data settings; the Share / Export / Help / Privacy tiles (replaced by the Your data list).
- **Confirm preferences:** the Documents and Insurance switches. Documents and Insurance show as locked, "Not shared", in the portal sidebar.
- **Profiles step (p-profiles):** "Add Emergency and Specialist profiles later".
- **Every portal code card:** "Or scan their QR code instead".
- **Portal:** the Documents screen (c-documents-specialist); the vitals judgements ("Elevated", "Normal", "Stable").
- **Lock-screen states** (p-lock-active, p-lock-ended): a web app cannot draw on the lock screen.
- **c-code-expired:** "Jane will be notified in her Trace app".
- **p-verify:** "Code expires in 14:52".

---

## 6. Open questions

Each has a default the build uses until you decide.

- **G8. Condition colours.** Figma gives each condition its own colour (indigo, peach, teal) rather than one per status. Built that way, cycling in that order; resolved conditions get a neutral tag. Should colour mean something, such as status or specialty?
- **D2. Welcome feature line.** Now reworded (section 4); confirm or rewrite.
- **D5, D6, D8, D9.** The About, Medical and Privacy lines are now reworded (section 4); confirm or rewrite.
- **D13. Refill card on Home.** It shows the nearest refill date however far away. Should it only show within, say, 14 days? (Any date.)
- **S11. Recent visits and Full timeline.** Should turning on Full timeline switch off Recent visits? (No; both can be on.)
- **S17. The request sheet's line for a share started from Profile.** Please rewrite the stand-in.
- **S23. "Add notes or receipts" on p-ended.** (Kept; suggest "Add notes".)
- **P3 (portal). c-denied "Close".** Back to the name step. Is that what you meant?
- **P18. "ongoing" tag on portal medications.** (Kept; consider the drug class.)
- **P6. Destructive actions.** Do you want a red button for delete? (Indigo primary.)
- **Sign-up step 3 cannot be left.** Once signed in, the About you step has no back link and no sign out, so the only way out is to finish sign-up (or close the tab). Should it have a "Sign out" link? (No link.) *(Found in the hardening pass.)*
- **How long Time's up waits, and how long a Manual share can run.** (30 minutes, and 12 hours.)
- **Six code boxes** where Figma shows four (a Supabase limit). (Six boxes, same style.)

---

## Technical appendix

For developers. Aoife can skip this.

- The patient app's countdowns use the database's clock: every Supabase response carries a `Date` header the browser can read, and `src/lib/serverClock.ts` measures the offset from it (no visible change on a phone whose clock is right). The portal already uses `server_time` from `portal_status`.
- Ending a session writes the row twice in one transaction (ended, then `notes_entry_id`), and both realtime updates carry the same `updated_at`. `ShareSession.tsx`'s `pick()` keeps the version with the notes entry on a tie, and the ended screen reads the row and the notes entry itself.
- Sign out and Delete my account do a full page load of `/`, so screens Next.js keeps hidden in memory (with the previous person's record) are dropped.
- Every route sends `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and a `Permissions-Policy` turning off camera, microphone, location and payment.
- Component sources for the items above: the UI kit is in `src/components/ui`, patient pieces in `src/components/patient`, portal pieces in `src/components/portal`, and the development-only component sheet at `/kit` (404 in production).
- `tests/e2e/a11y.spec.ts` checks every screen of both apps at 320px wide (no sideways scroll, axe) and tabs once round each screen (every stop visible, with a focus ring that is not clipped).
