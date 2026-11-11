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

### 1.1 The redesign's foundation (Phase 1, November 2026)

The app now runs on the redesign's tokens, fonts, icons and base components (docs/redesign/BRIEF.md sections 1 to 3 and the canvas boards). The old Figma colours, DM Sans, the lucide icons, shadows, pills, eyebrows and tinted icon tiles are gone everywhere. Screens keep their old layouts until their phase rebuilds them against the boards, but every one is already drawn with the new pieces. What changed from the brief or the boards, and what needs your eye:

**Contrast (WCAG 2.2 AA). Every pairing in the token table was measured; the /kit Tokens section shows the live ratios.**

- **R1. `ring-off` darkened.** The empty ring of the tick toggle is its only sign of "off", so it needs 3:1. The brief's #9096BE is 2.9:1 on white and 2.7:1 on ground. Now #878DB3 (3.2:1 on white, 3.0:1 on ground), the smallest darkening that passes. Nothing was lightened.
- **R2. Secondary text on an accent card.** The Insurance board's "Connected", "Member number" and "Comprehensive plan" are white at 80% on accent, which is 3.8:1. The build uses full white there (4.9:1). The weight difference still separates the label from the value.
- **R3. Field and segmented outlines (open question).** The boards draw inputs, code boxes and the segmented control with border-control #DCDFF0, which is 1.3:1 on white and 1.2:1 on ground. The build follows the boards: every field has a visible label, the white fill and a 2px ink focus ring, and the segmented control's choice is the accent fill. This reopens the old A3 (you had approved a 3:1 field outline for the first build). Say if you want the 3:1 outline back on inputs only; a darker border-control near #8A8FB3 would pass.
- **R4. Everything else passes as specified:** ink 16.3:1 on ground; ink-2 5.7:1 on ground, 6.1:1 on white, 5.1:1 on locked-tint; segment-text 7.8:1; accent 4.9:1 on white and 4.6:1 on ground (text), white on accent 4.9:1; white on session 7.1:1; white at 78% on session 5.0:1; urgent 5.4:1 on its tint; critical 6.3:1 on its tint; the track switch's off colour 3.6:1; white at 50% rings on session 3.0:1; the accent dot on the range band 3.2:1. Accent text on locked-tint is only 4.1:1, so locked tiles use session indigo for their icons (5.9:1) and ink for words.
- **R5. Focus.** One 2px ink outline with a 2px gap on every control (white on session indigo), as the boards' CSS draws it. Inputs also turn their border accent while focused.
- **R6. Touch targets.** Every control on the phone has at least 44 x 44: the 32px back arrow, the 36px sheet close, the 24px tick and small buttons keep their drawn size with an invisible larger tap area.

**Where a board differs from the brief's tables (the build follows the board).**

- **B1. Tick toggle ring** is 2px on ShareA2 and InsuranceA2; the brief says 1.5px. Size 24 on the tiles, 28 on Insurance's "Include in shares" row.
- **B2. "Doctor can add notes"** is a 52 x 32 track switch on ShareA2, not the tick. Both exist (`SwitchRow control="track"`); every other toggle is the tick.
- **B3. Share confirm's "Create share code"** is 56px tall with radius 18 on ShareA2, while ApproveA2, SessionA2 and FamilyA2 use the brief's 52px pill. Built as each board (`Button size="xl"` on Share confirm only). Say if the share screen should match the others.
- **B4. Segmented control height.** 40px on the Record, Medications, Timeline and Family boards (the brief), 44px for ShareA2's durations, 34px in the portal (PortalRecordE). All three are built.
- **B5. Session active's time bar** is 6px on SessionA2; the brief says 3px. The portal header's bar is 3px (PortalRecordE). Both are built.
- **B6. "End sharing now"** is white with ink text on SessionA2; the brief says indigo text. Built as the board.
- **B7. The portal's End session** is an outlined button with accent text (PortalRecordE); the brief says ink text for secondary buttons. Built as the board.
- **B8. Approve access backdrop** is #2A3787 on ApproveA2, darker than session indigo. It is a token, `session-deep`.
- **B9. Rail items** are 44px with radius 12 on PortalRecordE; the brief says radius 10. Built at 12.
- **B10. Scope tile edges** are 1.5px on ShareA2; the brief says every border is 1px.
- **B11. Record's safety facts** sit in a critical-tint strip on RecordA2; the brief says plain text. The strip is built as the board.
- **B12. Detail screen titles** are 24/30 on FamilyA2, InsuranceA2, ShareA2 and CodeA2, and 28/34 on TimelineA2 and MedDetailA2. Both sizes are tokens (`text-title-sm`, `text-title`).
- **B13. Not-shared rings on CodeA2** are solid (white at 50%); the brief says dashed. The portal rail's are dashed (PortalRecordE). Built as each board.
- **B14. Portal "Save notes"** is 48px on PortalRecordE; the portal's Continue is 52px on PortalEntryB. Both use the 52px button for now.

**Kept from the first build's accessibility work:** whole-row tap targets (A9), errors in words with an icon (A12), one real field under the code boxes (A13), the access request's first focus on the request (S1), the spoken forms of times and codes (S2 to S4), and the confirm sheets closing after their action (S24b).

### 1.2 New and changed words in Phase 1

- Tab bar: "Timeline" is now "Record" and "Meds" is "Medications" (the boards).
- Demo marker: "Demo with sample data" (was "Demo · sample data"), a 28px strip at the very top.
- Access request: "Deny" (was "Deny access"), a text button under the filled "Allow access"; the disclaimer reads "Name and practice are as typed. Trace does not check them."; the not-shared line reads "Not shared: ...".
- Share code: the "Not shared" items are a list with an empty ring each; the timer line is "Expires in 4:59".
- Portal waiting: "Patient has" over the large countdown (was "Patient has 4:59 to respond").
- Portal session notes: "Added to Jane's record when the session ends." (was "Notes are written back to..." and "Patient granted permission to add notes"); the "Type notes here..." placeholders are gone.
- Portal session line: "Reading Jane Doe's record, shared today, GP visit profile. Read only." and "Access expires in 24:31", with no LIVE stamp and no tinted banner.
- Portal footer: "Trace · Clinical Access Portal" is gone (the wordmark says it).
- Rail: "Not shared" under each section the share leaves out.
- Home's header date is sentence case ("Wednesday 11 Nov 2026", was capitals).
- The splash is the wordmark on ground, not on indigo (session indigo is kept for sharing).
- Every delete action is a text button in the critical colour; its confirm sheet has the action filled and "Cancel" as a text button (replaces P6).

### 1.3 Patient app screens

- **D1. p-login (Welcome).** Adds "Just looking? Try Trace with sample data." and a "Try the demo" button under the two buttons, and the line "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study · Terms" at the bottom.
- **D3. p-verify.** Six boxes, not four (Supabase's codes are six digits). "We sent a 6-digit code to ...", and under the boxes "Or open the link in the email on this device.", since the email carries a link until its template is changed. No "Code expires in 14:52": the screen cannot know the expiry. "Resend code" sends a new one and says "We sent a new code."
- **D4. p-about.** Date of birth uses the phone's own date picker. Country is a list: Ireland first, nine more, then Other.
- **D7. p-medical.** Allergies and implants are one line each, split on commas; the hint adds "Separate them with commas." The implants placeholder is "e.g. pacemaker, stent", with "(optional)" after the label.
- **D10. p-privacy.** Switches sit to the right of their text (one switch layout across the app). "I agree" with the agreement off says "Turn on the agreement to continue."
- **D11. p-profiles.** "Add Emergency and Specialist profiles later" is hidden. Both buttons move on: the GP visit profile is the defaults every share starts from, so there is nothing to store. After "I'll do this later", Welcome shows "GP visit profile" / "Ready whenever you share. You can check it before every share." without a tick.
- **D12. p-welcome.** "Add your first entry" says "Log a visit, write a note, or add a medication". If no critical safety details were entered, it shows "Add your critical safety details" / "Blood type, allergies and implants, from Profile", without a tick, so it never claims something was saved.
- **P3. Sign-up step 3 (About you).** No back link: the code step is behind you once you are signed in. Steps 4 to 6 go back one step.
- **D17. p-add.** Log appointment, Add a medication, Write a note, and three new tiles: "Add a condition" ("A diagnosis or ongoing health issue"), "Add a relative" ("Family history for your tree") and "Upload a document" ("A letter or result, as a PDF or photo").
- **S8. p-apptday.** The card shows on the day of a visit until a share started from that visit has ended. Then Home goes back to normal for the rest of the day.
- **S10. Live banner while paused.** "Dr Hennessy's access is paused" and "Time's up", in place of "can see your record" and the time, which would be untrue.
- **S12. p-prefs.** If a doctor can already see the record: "A doctor can already see your record. View session".
- **S15. p-code, other states.** Once the doctor types the code the timer card reads "Code entered" / "Dr Hennessy is asking". Expired: "This code has expired." / "Make a new code when your doctor is ready." / "No longer works" / "Make a new code" / "Back to home". Cancelled: "This code was cancelled." Denied: "You denied this request."
- **S21. p-paused.** "Session notes saved · access closed" only when notes are allowed and the doctor wrote some, otherwise "Access closed". Adds "If you don't decide, the session closes at 10:35am." "Time used" shows minutes from Allow to the pause ("30 of 30 min").
- **S22. Session ended summary** (now reached from Home's "View summary"). The line under "Session ended" depends on who ended it: "Dr Hennessy no longer has access to your record." (you), "Dr Hennessy ended the session and no longer has access to your record." (the doctor) or "The session closed after Time's up. Dr Hennessy no longer has access to your record." (the timer). Session notes: "View", "None written" or "Not allowed". Under a minute: "Less than a minute".
- **S24b. Every confirm sheet.** Same look. A sheet left open when you leave a screen now closes itself, and a confirm sheet closes after its action works, so going back to that screen does not reopen it.

### 1.3b Patient screens rebuilt on the boards (Phases 2 and 3, November 2026)

Home (MainA2), Record (RecordA2), Share confirm (ShareA2), Share code (CodeA2), Approve access (ApproveA2) and Session active (SessionA2) now follow the boards value by value. Where the build differs, or the board shows something the data cannot, it is listed here. Screens without a board (Time's up, the ended summary, Profile and its rows, the live state of Home) follow the brief's rules; they are in section 2.

- **E1. Home's three states.** Normal day: greeting, Coming up, Recent. A visit today (until a share started from it has ended): the accent today card with "Share record". While a doctor has access, or at Time's up: the same card shows "Dr Hennessy has access", the time left as the big figure, "Ends at 6:11pm", and a "View session" pill ("Time's up for Dr Hennessy" / "0:00" / "Your record is hidden" / "Decide now" when paused; "No timer" / "Until you end it" for a Manual share). On Home this card takes the place of the live strip, so the two do not say the same thing twice; every other screen keeps the strip. No board shows the live state.
- **E2. "Share record" only on a visit day.** As before, sharing on any other day starts from Profile's "Share my record". The brief calls the card's button the primary entry to sharing; say if Home should offer sharing every day.
- **E3. Coming up.** Refills of current medications and every upcoming entry, soonest first. A refill 5 days away or less is the tinted tile with its days left in words ("3 days"); a later one is a plain tile (your decision of 11 Nov). So the demo's warfarin refill, 8 days away, is a plain tile, unlike MainA2, which tints it; expected. Upcoming visits pick their icon from the title: a drop for a blood test or INR, a heart for cardiology, a calendar otherwise (the board's three). Tiles show the entry's own title, so "Cardiology follow-up" wraps to two lines where the board says "Cardiology". Refill tiles open the medication, visit tiles the entry (the boards make every tile a link; brief 4.3 says upcoming items are not clickable, but the patient needs to edit their own appointments).
- **E4. Recent.** The three latest past entries, leaving out the visit on the today card (as the board does). While a share is live the card does not feature the visit, so it appears in Recent.
- **E5. Home's greeting** reads "Good afternoon, Jane" to a screen reader as one heading.
- **E6. Record's safety strip.** Board: no warning icon. Brief 5.6: a warning icon. Built as the board; the word "allergy" and the colour carry it.
- **E7. Record opens on Timeline.** The board's preview state is the Family tab; the app opens on the first tab and remembers the tab in the address (`/record?tab=conditions`), so a condition's Back returns to it.
- **E8. Record's Timeline tab.** Every upcoming entry (latest first, dates in accent, "upcoming" for screen readers), then every past entry, newest first, each opening its detail. With the demo that is exactly the board's six rows.
- **E9. Family tab's short list.** The board shows Mum, Dad and Dad's dad; nothing in the data picks Dad's dad over Mum's mum. The build shows parents first, then other relatives with a known condition, three at most: Mum, Dad, Mum's mum. Say which three you want, or the rule.
- **E10. Family tab's small tree** is drawn from the relatives that exist (grandparents, parents, you filled, one sibling). With the demo it is the board's drawing.
- **E11. Share confirm, ten tiles.** The board's seven plus Documents, Family history and Medication notes in the same style, before Mental health. No Insurance tile: insurance is personal and never shared (your decision of 11 Nov); every share is created with it off, and it is in no "Sharing" or "Not shared" list. Defaults: Safety info and Medications locked; Conditions, Recent visits, Full timeline, Care team and Medication notes on (your decision of 11 Nov); Documents, Family history and Mental health off. The count reads "7 of 10 shared" with ten bars (narrower than the board's seven, to fit).
- **E12. Share confirm's title** names the doctor of the visit it came from ("Share with Dr Hennessy", DH avatar). From Profile there is no doctor yet: the title is "Share your record" and the right-hand disc shows a person icon.
- **E13. No "Private by default" line** under the tiles: the board has only the Mental health tile's caption, and the brief's separate line would repeat it.
- **E14. Share code.** The board's "Next: doctor requests access" link in the demo strip is the canvas's click-through and is not built. "Sharing" lists every shared section with a line from the record ("4 active", "3 items", "GP, 2 specialists, 1 pharmacy", "7 relatives"); "Not shared" lists every section left out (with the defaults: Documents, Family history, Mental health).
- **E15. Approve access.** "They will see" and the "Not shared" line come from the share's own switches. The old line "Sharing your GP visit profile for this appointment." is gone, as on the board.
- **E16. Session active.** "Dr Hennessy can see" lists the shared sections from the session. The line under the name is the practice the doctor typed plus the title of the visit the share came from ("Rathmines Medical Centre, GP visit"); from Profile, the practice alone. "Access ends at 3:37pm" (the 12 hour limit for a Manual share).
- **E17. A way back from the session screens.** SessionA2 has a 24px gap and no back control; the tab bar is hidden there. The build puts a 32px "Back to Home" chevron in that gap (20px taller than the board), on Session active and Time's up. Without it the only way out is the browser's Back.
- **E18. Time's up** (no board): "Time's up" as a page title, the line, "Time used", then "Add 15 min" and "Add 30 min" (were "+15m" and "+30m") as two white buttons side by side, "Save and end", and when it closes by itself.
- **E19. When a share ends** (from the phone, the portal or the timer) the phone goes back to Home with one line: "Dr Hennessy no longer has access to your record. View summary". The summary is the old Session ended screen.
- **E20. Profile** (no board) is the brief's list: Your details, Share my record (hidden while a doctor has access), Insurance, Documents, Care team, Share history, Privacy and security, Reset demo on a demo, then Sign out on its own. The brief also lists Mental health; it has no page (your decision of 11 Nov), so there is no row.

### 1.3c Patient screens rebuilt on the boards (Phases 4 to 6, November 2026)

Medications (MedsA2), the Concerta strength history (MedDetailA2), Full timeline with its sheet (TimelineA2), Family tree (FamilyA2) and Insurance (InsuranceA2) follow the boards value by value. Visit detail and Documents have no board; they are in section 2. Where the build differs from a board, or the board and the brief disagree:

- **M1. Medications' sub lines say what the data says.** Concerta: "Morning, 4 strength changes" (the board says 5; 5 periods are 4 changes). Levothyroxine has two periods (25mcg then 50mcg), so it reads "Morning, 1 strength change" with a chevron, where the board shows "Morning" and no chevron. Warfarin reads "Evening", not "Evening, 8 days left": the urgent line starts at 5 days (your decision); within 5 days it reads "Evening, 3 days left" in the urgent colour.
- **M2. Every medication row opens the medication.** The board links every row but draws the chevron only on Concerta; the build draws it on rows with a strength history (the brief's rule) and keeps every row a link, since edit and end live on the medication's screen.
- **M3. Past rows wrap at 390.** "2 Aug to 9 Aug 2026, Dr Hennessy" and "100mg" are wider than the card together (319px in 312), on the board as in the build, so the sub line takes two lines.
- **M4. Medication screen extras** (none on MedDetailA2, all from brief 5.11): a pencil at the top right opens Edit (edit, end, delete); under each note, "Edit" and a "Share with doctors" tick switch; a period without a note has "Add a note". "Log a strength change" only shows for a current medication (an ended one cannot change). A past medication's line reads "Stopped 9 Aug 2026" instead of "Now ...".
- **M5. Strength history dates** follow each period's precision: Concerta's months as on the board ("Jan 2024 to Mar 2024"), Salbutamol's year ("2015 to now"), a logged change's day ("11 Nov 2026 to now").
- **M6. A new note is shared** with doctors unless you turn it off (your decision), on "Log a strength change" and "Add a note". A doctor sees it only when the share includes Medication notes too.
- **T1. Full timeline extras.** The sheet has an "Edit" text button (the board has none), and "Add to your timeline" sits under the card. Blocks with nothing in them (no outcome, nothing prescribed) are left out of the sheet.
- **F1. Family tree.** The board's tree, filter (All, Heart, Diabetes, Asthma) and summary line, drawn from the data: the filter offers the groups your family actually has, aunts and uncles extend the parents' row, children go under you, and a large family scrolls sideways inside the tree (it does at 320 wide too). Each person is a button opening a sheet with their conditions and "Edit"; "You" leads to your conditions. "You" counts your conditions that are not resolved ("3 conditions"); which groups you match comes from your conditions' names (atrial fibrillation counts as heart).
- **F2. Dimmed people keep readable words.** The board fades a whole node to 35%; the build fades only the ring and icon, since faded words fail contrast.
- **F3. The brief says nodes are "compact text chips";** the board draws circles with a person icon. Built as the board.
- **I1. Insurance: no "Include in shares".** Insurance is personal (your decision). The connected screen is the card and Disconnect (with a confirm sheet).
- **I2. The provider sign-in is a stand-in** on every account (your decision). Tapping a provider opens a sheet, "Sign in with VHI" / "You sign in on VHI's own page, and Trace never sees your password. For now this is a stand-in: it adds a sample plan." / "Continue" / "Cancel"; the board goes straight to the card. "Other provider" opens manual entry (the board would connect a provider called "Other provider").
- **I3. Insurance's Back** goes to Profile; the board's goes to Home. Manually entered plans say "Added by you" where a connected one says "Connected".
- **I4. Insurance card on accent:** "Connected", "Member number" and the plan are full white, not the board's 80% (white at 80% on accent is 3.8:1).
- **Tab bar on detail screens.** The boards draw the tab bar on Medication, Timeline, Family and Insurance; those screens, visit detail, a condition, Documents and a document keep it. Forms and the upload flow hide it.

### 1.4 Doctor's portal (Phase 7)

Rebuilt on PortalEntryB (Enter code), PortalWaitB (Waiting) and PortalRecordE (the live record and its views). Where the build differs from a board, or a board from the brief:

- **P1. "Change details".** The brief puts it top right; the board puts it after "Requesting as Dr Hennessy." beside Continue. Built as the board. The header's right side is the name and practice only.
- **P2. "Demo: patient approves".** Left out (there is no such button). The waiting footer keeps "The patient keeps their code and can still share later."
- **P3. Footer, right side.** "Demo with sample data" only in the demo (`/view?demo=1`); otherwise "A portfolio project, not a medical service" (the portfolio line the old footer carried). "Privacy and security" and "For your practice" lead to a new page, About the portal, which also links the case study and Terms.
- **P4. Wrong, expired and locked codes.** No separate screens: the code step keeps its title, the boxes empty and turn critical, and one line under them says what happened, with focus back in the boxes. Locked: boxes and Continue are disabled until the time given, then come back by themselves.
- **P5. Approved.** The "Opening Jane's record" step with its loading bar is gone; the record opens as soon as the patient taps Allow.
- **P6. End session.** The board's button ends at once. The build keeps the old c-end step, inside the record: "End session with Jane Doe", when it started, how long it ran, what happens to the notes, then End session or Back to the record. Ending cannot be undone, so one step before it seemed right; say if you want the board's direct end.
- **P7. Notes panel.** "Save notes" is 52px (board 48, see B14). The save status ("Saving notes…", "Notes saved", the error) sits under the button. The fields can be made taller by dragging their corner. The panel's own "End session" button is gone (the header has it). Below 1024px the notes sit under the record with no handle.
- **P8. Medication detail title.** 28px as the board (the brief says 26).
- **P9. Vitals date.** The date the vitals were taken sits beside "Vitals" (43 days ago in the demo; without it they read as today's). Not on the board.
- **P10. Recent visits.** When Full timeline is also shared, the older visits follow under "Earlier"; otherwise the board's "Older visits are in the full timeline." with the dashed ring. Upcoming are latest first, as on the board.
- **P11. Family history.** The tree places grandparents, parents, the patient and siblings; aunts, uncles, children and "other" are in the list beside it only. A filter dims only the other relatives' circles, not their names (the board dims the whole node to 35%, which makes the names unreadable). The patient's "3 conditions" shows only when Conditions was shared. The summary keeps the board's "Tap a condition to see who has it." (on a laptop you click).
- **P12. Care team "You".** On the person whose name matches the name the doctor typed.
- **P13. Sections left out of the Overview.** Without Conditions or Recent visits, the Overview keeps the heading with "Not shared" and the dashed ring, so the doctor knows it was left out, not empty. Vitals the same (they travel with Recent visits or Full timeline).
- **P14. Paused and ended.** In the code step's frame: a small label over the title ("Access paused", "Access ended"), a line or two, one action ("End session now", "Enter a new code").
- **P15. Declined, timed out, withdrawn.** A label, the title, one line, "Try again".
- **P16. Two panes at narrower widths.** Recent visits, Medications and Full timeline put list and detail side by side only when the record area is at least 600px wide (at 1280 with the notes open it is 654px). At 1024 with the notes open they stack; collapse the notes to get them side by side.
- **P16b. Insurance.** Not in the portal at all, as you decided: no rail item (not even "Not shared"), no view, no address, and the record route refuses the section even if a session granted it.
- **P17. The countdown reaching zero.** The record leaves the screen at once ("Checking access"), and the database's answer follows within a second (normally Time's up).
- **Below 1024px, every portal screen.** The layout stacks: the rail becomes a row of section tabs and the notes panel moves under the record.

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
- **Edit, end or delete a medication**, from the pencil on a medication's screen. A medication with a strength history has no strength field there: "To change the strength, log a strength change. Your history keeps every strength."
- **Log a strength change** (from a current medication): "Concerta 36mg ends on the date you pick, and the new strength starts the same day. Earlier strengths stay in your history." · "New strength (mg)" · "Date of the change" · "Prescribed by" · "How it feels" · "Share this note with doctors". Never overwrites a strength.
- **A strength's note** ("Add a note" / "Edit note"): "How it felt" and "Share this note with doctors".
- **Visit detail** (brief 5.9, no board): the visit as the title; a caption with the kind, date (and time for a visit), doctor and place ("Result, 2 Nov 2026, ordered by Dr Hennessy, Mater Hospital"); then Reason, Assessment, Plan, Follow-up (a prescription: Medication, Quantity, Pharmacy first; session notes: Chief complaint first) or the results card with range bars and "low" / "high" in words. The pencil edits an entry you wrote; "Delete entry" stays. The brief asks for each result's value in Sora; the build uses the portal's result row (value in the caption under the name) so phone and portal match: say if both should change. Upcoming entries are not clickable on Record (brief 4.3), but Home's tiles still open them (E3), where you can edit or delete your own appointments.
- **Log appointment and edit** add optional Reason, Assessment and Plan, and for a prescription "Medicine and strength", "Quantity" and "Pharmacy".
- **Add to your timeline / Edit timeline**: "Type" (Infection, Condition), "What it was", "Month", "Seen by", "Practice or hospital", "Outcome", "Prescribed" (each "Medicine 1" with "How long", "Remove", "Add a medicine"), "Doctor's notes", the mental health switch; "Delete from timeline".
- **Add a relative / Edit Dad's dad**: "Who", "What you call them", "Conditions" (each "Condition 1" with "Age at diagnosis", "Group", the mental health switch, "Remove"; "Add a condition"); "Remove relative".
- **Insurance, manual entry** ("Policy details", or "Other provider"): "Provider", "Member number" ("Trace keeps only the last four characters."), "Plan", "Renewal date", "Save policy". No password field anywhere.
- **Documents** (Profile's row): a card of documents, each with the document icon, its name and "2 Nov 2026, PDF" / "Photo", then "Upload a document". Empty: "No documents yet." / "Upload a document".
- **A document**: name, "2 Nov 2026, Photo, 820 KB", "Open" (a photo, in a new tab) or "Download" (a PDF: browsers will not show a PDF inside the safe sandbox the file is served in), the mental health switch, "Delete document".
- **Upload a document** (no tab bar): "File" with "PDF, JPEG or PNG, up to 3 MB." (a demo adds "The demo keeps up to 5 files, 3 MB in all."), "Name", "Date on the document", the mental health switch, "Upload". Refusals before anything is sent: "letter.pdf isn't a PDF, JPEG or PNG. Choose one of those." · "scan.png is 4.2 MB. Choose a file of 3 MB or less." · and from the database "The demo keeps up to 5 files, 3 MB in all. Delete a document to make room."
- **Edit profile**, with Critical safety and Email sections.
- **Add, edit and remove someone on the care team**, from My profile.
- **Empty states** for a brand-new record: Home ("Your record is empty. Start with a medication, an appointment or a note." / "Add to my record"), each Record tab, Meds and Care team.
- **Share history** (was Access log): every share, newest first, one card each with who (as they typed it), the practice, a status tag, When, How long, Shared, a link to the session notes, and "What happened (6)" opening the events with their times. The newest card starts open.
- **Your details** (Profile's first row): personal details and the critical safety facts as stored, with "Edit details" pinned at the bottom (opens Edit profile, which comes back here).
- **Care team** (Profile's row): the people in order, GP first, each opening its edit screen, then "Add to your care team".
- **Privacy and security** (Profile's row): "Privacy and terms", "Export my data" ("Everything in your record, as one file"; it now includes the new sections) and "Delete my account" as a red text button with its confirm sheet.
- **The ended summary** (Home's "View summary" after a share ends): the old Session ended screen, without its status row.
- **"Couldn't load" state on the indigo screens** (the code screen and the live session): if the phone is offline, the screen now says so with "Try again" instead of "Loading…" for ever, and tries again by itself every few seconds. *(New in the hardening pass.)*

### Doctor's portal

- **Name step** (before the code; not on the boards): the code step's layout, "Who is asking?", three fields, Continue. Pre-filled with Dr Hennessy, GP, Rathmines Medical Centre in the demo. Remembered on that computer, so a returning doctor goes straight to the code; "Change details" comes back here.
- **Request declined, timed out, code withdrawn**: label, title, one line, "Try again".
- **Access paused**: the record and rail are gone; the notes panel stays beside it so the doctor can finish writing.
- **Access ended**: who ended it, whether notes reached the record, "Enter a new code". **Notes not saved** shows here when typed notes had not reached the record.
- **End session step** (inside the record, see P6).
- **Not shared**: what an ungranted view's address shows ("Jane did not share this part of the record."); nothing is fetched.
- **Documents** (no board): rows with a document icon, the title, "PDF" or "Photo" and the date; each opens the file in a new tab, served as the file itself. Empty: "No documents shared."
- **Mental health** (no board): the items flagged as mental health, grouped as Conditions, Visits, Timeline and Documents (each only when its own section was shared too). Empty: "Nothing flagged as mental health."
- **About the portal** (`/view/about`): For your practice and Privacy and security, the old accordion's words, and the portfolio line.

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
- Locked rows and tiles, for screen readers: "Always shared", on the lock disc
- After an optional field's label: "(optional)". Fields are required unless marked.
- Field error examples on the component sheet: "Enter an email address like name@example.ie", "That code doesn't match. Check it with your patient and try again.", "Too many attempts. Try again in 15 minutes."
- Expired medication card: "Expired, " before the drug class and summary
- Timeline, upcoming entries, for screen readers: "Upcoming, " before the date
- Live share banner, for screen readers: ". View session" after the visible text
- Sign-up progress back link, for screen readers: ". Back to the previous step" after "Step 3 of 7"
- Access request, for screen readers: "For " before "30 min"
- Range bars, for screen readers: "Ferritin 18 µg/L, low. Normal range 30 to 300." (the reading in words)
- Strength chart, for screen readers: a table with Strength, From and To for every period
- Countdown, when a screen has no other announcer: "5 minutes left", "1 minute left", "10 seconds left"

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
- Sharing summary rows when the counts cannot load (offline): each section's name alone, with no line under it (Safety info keeps "Allergies, blood type").

### Home, record, meds, add

- Home: "GP visit today" (the visit's title + "today") · "Share record" · "Coming up" · "<Medication> refill" · badge "8 days", "1 day", "Today" · "Recent" · while sharing "Dr Hennessy has access", "Ends at 6:11pm", "Until you end it", "No timer", "View session", "Time's up for Dr Hennessy", "Your record is hidden", "Decide now" · after a share "Dr Hennessy no longer has access to your record. View summary" · empty "Your record is empty. Start with a medication, an appointment or a note." / "Add to my record"
- Record: tabs "Timeline", "Conditions", "Family" · strip "Penicillin allergy", "Blood type A+" · "View full timeline" · "Add a condition" · "No conditions yet." · "Family tree" / "7 relatives" · "Relatives" · "Add a relative" · "No conditions known in your family yet." · "Add allergies or blood type" · "Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here." · for screen readers ", upcoming" after an upcoming row
- Meds: "Medications" · "Current" / "Past" · "Morning, 4 strength changes" · "Evening, 3 days left" · "refill due today" · "refill overdue" · "2 Aug to 9 Aug 2026, Dr Hennessy" · "No current medications." · "No past medications." · "Add a medication"
- Medication screen: "Now 36mg, since Feb 2025" · "Stopped 9 Aug 2026" · "History" · "Prescribed by Dr Hennessy" · "Edit" · "Add a note" · "Share with doctors" · "Log a strength change" · errors "Enter the new strength in mg, like 36.", "That's the strength you take now (36mg).", "The date can't be in the future.", "Pick a date after 1 Feb 2025, when the current strength started.", "Concerta has ended, so its strength can't change."
- Timeline: "Timeline" · "All" / "Infections" / "Conditions" · "Aug, Infection" · sheet "Aug 2026, Infection", "Seen by", "Outcome", "Prescribed", "Doctor's notes", "Edit" · "Add to your timeline" · empty "Nothing on your timeline yet. Add illnesses and diagnoses to keep them in one place." / "No infections on your timeline." / "No conditions on your timeline."
- Family history: "Family history" · "All", "Heart", "Diabetes", "Asthma" (and "Cancer", "Stroke" when a relative has one) · "Tap a condition to see who has it." · "Heart: Dad's dad, Dad, You" · "nobody yet" · "None known" · "3 conditions" · "Add a relative" · sheet "Diagnosed at 61, Heart", "No conditions known.", "Edit" · empty "Add your parents, grandparents and siblings to build your tree."
- Insurance: "Choose your provider and sign in with them. Trace never sees your password." · "VHI", "Laya Healthcare", "Irish Life Health", "Other provider" · "Enter policy details manually" · "Read only. You can disconnect any time." · "Connected" / "Added by you" · "Member number" · "Renews 1 Mar 2027" · "Disconnect" / "Disconnect VHI?" / "Your plan details are removed from Trace. You can connect again any time."
- Add: "Add a condition" / "A diagnosis or ongoing health issue"
- Entry form: "What kind": Visit or appointment, Test result, Prescription, Letter, Scan or X-ray · "Title" · "Date" · "Time" · "Doctor or clinician" · "Where" · "Notes" / "Note" · placeholders "e.g. GP visit", "e.g. Fatigue symptoms", "e.g. Dr Hennessy", "e.g. Rathmines Medical Centre" · hint "Only you can see personal notes. They are never shared with a doctor." · errors "Give the note a title.", "Say what the appointment was for, like GP visit.", "Enter a date, like 14/01/2026.", "Enter a time, like 09:30.", "Write the note." · buttons "Save note", "Save to my record", "Save changes"
- Mental health switch: "About mental health" / "Kept out of every share unless you include mental health for that share." · on detail screens: "About mental health. Left out of a share unless you include mental health."
- Entry detail: the title is the entry's own ("Blood count and INR") · caption "Result, 2 Nov 2026, ordered by Dr Hennessy, Mater Hospital", "Upcoming visit, ..." · blocks "Reason", "Assessment", "Plan", "Follow-up", "Medication", "Quantity", "Pharmacy", "Notes" / "Note"; for session notes "Chief complaint" first · "No results recorded yet." · "Nothing else recorded." · "Personal note. Only you can see it; it is never shared with a doctor." · "Delete entry" / "Delete this entry?" / "It will be removed from your record. You can't undo this." / "Cancel"
- Condition form: "Condition" · "Status": Ongoing, Managed, Resolved · "Doctor" · "Specialty" · "Year diagnosed" · "Or when it started" (hint "Shown when there is no year.") · "Enter the condition's name." · "Enter a year between 1900 and 2026." · "Save condition" · detail row "Diagnosed" · "Delete condition" / "Delete this condition?"
- Medication form: "Name" · "Strength" (hint "A number and a unit: mg, mcg, g, mL, units or IU.") · "Form" · "How often" · "When" · "Drug class" · "What it's for" · "Prescribed by" · "Their specialty" · "Clinic or hospital" · "Started" · "Ends or ended" (hint "Leave empty if you're still taking it.") · "Next refill due" · "Instructions" · "Enter the medication's name, like Warfarin." · "The end date is before the start date." · "Save medication" · "Delete medication" / "Delete Warfarin 5mg?" / "It will be removed from your record. To show you stopped taking it, set an end date instead."

### Profile

- "Profile" · "Patient · Dublin, IE" · rows "Your details", "Share my record", "Insurance", "Documents", "Care team", "Share history", "Privacy and security", "Reset demo", "Sign out" (while working "Signing out…") · Your details: "Edit details", "Blood type", "Allergies", "Implants or devices", "Not added" · Privacy and security: "Privacy and terms", "Export my data" / "Everything in your record, as one file" (while working: "Preparing your file…"), "Delete my account" · "No one on your care team yet." · "Add to your care team" · "Your data couldn't be exported. Check your connection and try again."
- Delete account: "Delete your account?" / "Your whole record goes with it: profile, conditions, medications, timeline, family, documents, insurance, care team and share history. This can't be undone. You can export your data first." / "Delete everything" / "Keep my account" / "Your account couldn't be deleted. Check your connection and try again."
- Edit profile: sections "Personal details", "Critical safety" ("Always shown first to any doctor you share with."), "Email" · "Sex" · "Phone" · "Address" · "Town or city" · "Reminders and health tips by email" / "Optional. Trace does not send these yet."
- Care team form: "Name" · "Type": GP, Specialist, Pharmacy · "Role or specialty" · "Practice, clinic or shop" · "Enter a name, like Dr Hennessy." · "Remove from care team" / "Remove Dr Hennessy?" / "They will be removed from your care team. Nothing else in your record changes."
- Export file name: trace-export-YYYY-MM-DD.json
- Reset demo: "Reset demo" · "Reset the demo?" · "Jane's record goes back to how it started. Anything you added, and any share, is cleared." · "Cancel" · "The demo couldn't be reset. Check your connection and try again." · announced: "The demo is reset. Jane's record is back to how it started."

### Sharing (patient side)

- Share confirm: "Share with Dr Hennessy" (from a visit) or "Share your record" (from Profile) · tiles "Safety info", "Medications", "Conditions", "Recent visits", "Full timeline", "Care team", "Documents", "Family history", "Insurance", "Medication notes", "Mental health" / "Private by default" · "For how long" · "Doctor can add notes" · "5 of 11 shared" · "Create share code" · for screen readers "Shared securely" on the lock, "Always shared" on locked tiles
- Share code: "Share your record" · "Enter this at <address>/view" · "Expires in 4:59" · "Regenerate" · "Sharing", with lines "Allergies, blood type", "4 active", "3 items", "Last 3", "9 events", "GP, 2 specialists, 1 pharmacy", "2 documents", "7 relatives", the insurer's name or "Not connected" / "Not included in shares", "Notes you chose to share" · "Not shared"
- Request sheet (ApproveA2): "Access request" · "They will see" · "Can add session notes" · "Not shared: Full timeline, Documents, Family history, Insurance, Medication notes, Mental health." · "Name and practice are as typed. Trace does not check them."
- Session active: "Dr Hennessy has access" · "Rathmines Medical Centre, GP visit" · "Time left" · "Dr Hennessy can see" · "End sharing now" · "Access ends at 3:37pm" · "Back to Home" (the chevron, for screen readers)
- Time's up: "Time's up" · "Add 15 min" · "Add 30 min"
- Durations on the request: "30 min", "1 hour", "All day", "Until you stop it"
- Share history: "Share history" · "Every share, newest first. Only you can see this." · "You haven't shared your record yet. Every share shows up here." / "Share my record" · "No one used this code" · tags "Code ready", "Waiting for you", "Live now", "Time's up", "Ended", "Denied", "Expired", "Cancelled" · rows "When", "How long", "Shared", "Notes" / "Session notes" · "What happened (n)"
- Share history events: "You made a share code" · "Dr Hennessy typed the code and asked for access" · "Dr Hennessy cancelled their request" · "You allowed access" · "You denied access" · "The code expired unused" · "The request closed with no answer" · "Replaced by a new code" · "You cancelled the code" · "Viewed the overview / conditions / the timeline / medications / the care team / recent visits / the full timeline / family history / insurance / documents / mental health" · "Opened a document" · "Time ran out, access paused" · "You added 15 minutes" · "Session notes added to your record" · "You ended the session" · "Dr Hennessy ended the session" · "The session closed after Time's up"
- Share errors: "A doctor can already see your record. End that session before you start a new share." · "That appointment isn't in your record any more. Share from your profile instead." · "This share has reached its 12 hour limit. Save and end it." · "This session has already closed." · "That request has already closed." · "That didn't work. Check your connection and try again."
- Announcements for screen readers (as S3, plus): "Dr Hennessy can see your record again." (after adding time) · "The request from Dr Hennessy timed out." · "Your share code expired." · "The doctor cancelled their request. Your code still works." · "You denied access. Dr Hennessy cannot see your record." · "New code ready: 4 8 3 7."
- Session ended, nothing to show: "No ended session to show" / "Your share history has every share you have made." / "View share history" · the summary's rows "Add to your record" / "While the appointment is fresh" and "View share history" / "Every share you have made"

### Demo page

- "trace" · "Try both sides of a GP visit" · "Start on the phone: tap Try the demo and share Jane's record. Then type the code into the laptop. Sample data only. Trace is a portfolio project by Aoife Randles, not a medical service. Terms" · captions "Jane's phone", "Dr Hennessy's laptop" · frame names for screen readers "Patient app, on a phone", "Doctor's portal, on a laptop"
- Narrower: "Start on the phone: tap Try the demo and share Jane's record. Then open the doctor's portal and type the code." · "Open the doctor's portal" (screen readers add "(opens in a new tab)")
- Demo marker: "Demo with sample data" (the board's words)

### Doctor's portal

- Skip link (keyboard only): "Skip to the record"
- Header, for screen readers: "trace clinical access portal home" on the wordmark
- Footer: "Privacy and security" · "For your practice" · "Demo with sample data" (demo) or "A portfolio project, not a medical service"
- Enter code (board): "Enter the patient's code", "Ask your patient to generate a share code in their Trace app.", "Continue", "Requesting as Dr Hennessy. Change details", "What happens next", "The patient generates a code", "You enter it here", "They approve, you read what they chose to share"
- Code errors (under the boxes): "That code doesn't match. 4 tries left before a 15 minute pause." · "That code has expired. Codes last 5 minutes. Ask your patient for a new one." · "Too many attempts. Code entry is paused on this browser until 14:05. Ask your patient for a new code." · "Enter all 4 digits of the code."
- Name step: "Who is asking?", "Your patient sees these details before they decide. Trace does not check them.", "Your name", "Role (optional)" with "For example GP or practice nurse", "Practice (optional)", "Continue", "Remembered on this computer for next time." · error "Enter your name, as your patient knows you."
- Waiting (board): "Request sent", "Waiting for the patient to approve", "Patient has", "Cancel request", "Code accepted", "Waiting for approval", "Open record", "The patient keeps their code and can still share later." · for screen readers "About 4 minutes to respond"
- Declined: "Request declined" / "Your patient chose not to share their record." / "You can ask them to share again, or continue the consultation without it." / "Try again"
- Timed out: "No answer" / "Your patient didn't answer in time." / "Requests close after 5 minutes. Ask your patient for a new code."
- Withdrawn: "Code withdrawn" / "Your patient withdrew the code." / "They cancelled the share before answering. Ask them for a new code if you still need their record."
- Record header (board): "Allergy" (or "Allergies", "None recorded"), "Blood type" ("Not known"), "Implant" when there is one, "Shared for 30 min" / "Shared for 1 hour" / "Shared until 23:59" / "Shared until ended" ("No timer"), "29:54 left", "End session"
- Rail (board, without Insurance): Overview, Recent visits, Medications, Full timeline, Care team, Family history, Documents, Mental health; "Not shared" under each left out
- Overview (board): "Conditions", "Recent visits", "View all", "Upcoming", "Medications", "Vitals", "Blood pressure", "Heart rate, bpm", "Weight, kg", "O2 saturation" · new: "Not shared", "None recorded.", "No visits recorded.", "No current medications.", the vitals' date
- Recent visits (board): "Upcoming", "Last 3", "Older visits are in the full timeline.", "The shaded part of each bar is the normal range." · new: "Earlier", "Past", "No details recorded.", "No results recorded."
- Medications (board): "Current", "Past", "Now 36mg, since Feb 2025", "Stopped 9 Aug 2026", "History", "Prescribed by Dr Hennessy", 'Jane: "..."' · new: "No strength history recorded.", "No past medications."
- Full timeline (board): "All", "Infections", "Conditions", "Seen by", "Outcome", "Prescribed", "Doctor's notes"
- Family history (board): "Contains other people's health information.", "All", "Heart", "Diabetes", "Asthma" (and "Cancer", "Stroke" when present), "Tap a condition to see who has it.", "Heart: Dad's dad, Dad", "None known" · new: "no one", "No relatives recorded."
- Care team (board): "You" beside the doctor · new: "No one recorded."
- Not shared view: "Jane did not share this part of the record."
- Documents, Mental health: see section 2
- Session notes (board): "Session notes", "Added to Jane's record when the session ends.", "Chief complaint", "Assessment", "Plan", "Follow-up", "Save notes" · new: "Jane did not allow notes for this session." · status "Saving notes…", "Notes saved", "Notes could not be saved. Check your connection and try Save notes again." · for screen readers "Collapse session notes", "Open session notes", "Resize session notes. Arrow keys resize, Enter collapses or opens."
- End session step: "End session with Jane Doe", "Access closes on both sides straight away.", "Started", "Duration", "Your session notes are added to Jane's record when the session ends, and Jane can read them." or "Jane did not allow notes, so nothing is added to the record.", "End session", "Back to the record" · after a failed save: "Your latest notes could not be saved. Ending the session will try again."
- Access paused: "Access paused", "Time's up on this share.", "The patient's timer ran out, so their record is hidden. It comes back here if they add more time.", "If nothing changes, the session closes at 10:02.", "You can still finish your notes. They go to the record when the session ends.", "End session now"
- Access ended: "Access ended"; "Your patient ended the session." / "They stopped sharing from their phone. Access to their record is closed."; "You ended the session." / "Access to the record is closed on both sides."; "The session has closed." / "The patient's time ran out and they did not add more. Access to their record is closed."; "Your session notes were saved to the patient's record." or "No session notes were written, so nothing was added to the record."; "Enter a new code"
- Notes not saved: "Your last changes to the notes were not saved before the session ended, so they are not in the record. Copy them now if you need them: they are gone when you leave this page." · box label "Notes not saved"
- Loading: for screen readers "Clinical Access Portal"; "Loading the portal…", "Loading the record", "Checking access", "Loading…" · errors "The portal could not reach Trace. Check your connection and reload the page.", "This part of the record could not be loaded. Reload the page to try again."
- Errors: "The code could not be checked. Check your connection and try again." · "The request could not be cancelled. Check your connection and try again." · "The session could not be ended. Check your connection and try again."
- Announcements for screen readers: "Session started. You are reading the shared record." · "5 minutes of access left." · "1 minute of access left." · "Access paused. The patient's time ran out and the record is hidden." · "The patient added more time. The record is back." · "Session ended. Access to the record is closed."
- About the portal: "About the portal", "Trace is a portfolio project by Aoife Randles, not a medical service. Read the case study or the terms.", "For your practice", "Privacy and security" (the old accordion's rows), "Back to the portal"
- Browser tab titles: "Clinical Access Portal", "Overview", "Recent visits", "Medications", "Full timeline", "Care team", "Family history", "Documents", "Mental health", "End session", "Privacy and security", each followed by "· Trace Clinical Access Portal"

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
- **A line on Welcome and in the portal footer** says Trace is a portfolio project by Aoife Randles and not a medical service, linking to the case study and Terms. Terms says the same, plus what is stored.

---

## 5. Left out

In the design but not in this version. They are hidden, not shown as "coming later".

- **Home:** the notification bell and the "Upload doc" quick action.
- **Add:** the Scan or photograph, Record a vaccination and Upload a receipt tiles.
- **Meds:** "Request repeat prescription" (there is no pharmacy to send it to).
- **My profile:** Push notifications, Face ID unlock and Share anonymised data settings; the Share / Export / Help / Privacy tiles (replaced by the Your data list).
- **Profiles step (p-profiles):** "Add Emergency and Specialist profiles later".
- **Every portal code card:** "Or scan their QR code instead".
- **Portal:** the vitals judgements ("Elevated", "Normal", "Stable"). (Documents is built now, from the system: section 2.)
- **Lock-screen states** (p-lock-active, p-lock-ended): a web app cannot draw on the lock screen.
- **c-code-expired:** "Jane will be notified in her Trace app".
- **p-verify:** "Code expires in 14:52".

---

## 6. Open questions

Each has a default the build uses until you decide.

- **R3. Field outlines.** The boards' 1.3:1 border on inputs and code boxes, or a 3:1 one? (The boards' border; see 1.1.)
- **B3. Share confirm's button.** The board's 56px button with radius 18, or the 52px pill every other board uses? (The board's 56px.)
- **Q4. Board sample data.** CodeA2 says "Medications, 3 active", but Jane has 4 current medications: the build says "4 active". CodeA2 says "Care team, GP, 2 specialists"; Jane's care team also has Boots: the build says "GP, 2 specialists, 1 pharmacy". (What the data says.)
- **Q10. Levothyroxine's history** (M1). It has two strengths in the demo, so it shows a strength change and a chevron, unlike the board. Keep the data, or seed it with one strength? (Keep.)
- **Q11. Result values in Sora** (section 2, Visit detail). The brief puts each result's value in Sora; phone and portal show it as a caption. (Caption, as the portal.)
- **Q12. "Undo the last strength change".** The database can remove the newest strength (a change logged by mistake); the app has no button for it yet. Add one to the medication's screen? (No button.)
- **Q13. PDFs download, photos open.** A PDF served in the sandbox the file needs cannot be shown by Chrome's viewer, so "Download" saves it and the phone opens it. (As described.)
- **Q14. Timeline events by hand.** "Add to your timeline" and "Edit" are not on the board or in the brief's Add sheet. Keep them? (Keep.)
- **Q7. The chevron back to Home on the session screens** (E17). Keep it, or follow the board and leave the browser's Back as the only way out? (Keep it.)
- **Q8. Mental health in Profile.** The brief lists a Mental health row; it has no page. (No row.)
- **Q9. Sharing on days with no visit.** Only from Profile, as now, or also from Home? (Profile only.)
- **D2. Welcome feature line.** Now reworded (section 4); confirm or rewrite.
- **D5, D6, D8, D9.** The About, Medical and Privacy lines are now reworded (section 4); confirm or rewrite.
- **S11. Recent visits and Full timeline.** Should turning on Full timeline switch off Recent visits? (No; both can be on.)
- **Sign-up step 3 cannot be left.** Once signed in, the About you step has no back link and no sign out, so the only way out is to finish sign-up (or close the tab). Should it have a "Sign out" link? (No link.) *(Found in the hardening pass.)*
- **How long Time's up waits, and how long a Manual share can run.** (30 minutes, and 12 hours.)
- **Six code boxes** where Figma shows four (a Supabase limit). (Six boxes, same style.)
- **Portal: End session in one click or two?** (Two: the End session step, P6.)
- **Portal: PDFs open in a sandbox.** Shared files are sent with a sandbox policy, as the notes require. Some versions of Chrome refuse to show a PDF under that policy (its viewer needs scripts); photos are unaffected. If that happens, the fallback is to download PDFs instead of opening them. (Opened in the browser; not yet checked in a desktop Chrome.)
- **Portal: vitals date** beside Vitals (P9). Keep it? (Kept.)

---

## Technical appendix

For developers. Aoife can skip this.

- The patient app's countdowns use the database's clock: every Supabase response carries a `Date` header the browser can read, and `src/lib/serverClock.ts` measures the offset from it (no visible change on a phone whose clock is right). The portal already uses `server_time` from `portal_status`.
- Ending a session writes the row twice in one transaction (ended, then `notes_entry_id`), and both realtime updates carry the same `updated_at`. `ShareSession.tsx`'s `pick()` keeps the version with the notes entry on a tie, and the ended screen reads the row and the notes entry itself.
- Sign out and Delete my account do a full page load of `/`, so screens Next.js keeps hidden in memory (with the previous person's record) are dropped.
- A patient's document is served by `GET /api/documents/<id>` (`my_document_file` as the signed-in user) with its stored type, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox; frame-ancestors 'self'` and `Cache-Control: no-store`; the policy is set in `next.config.ts`, whose headers would otherwise replace the route's. PDFs go as an attachment, photos inline, always in their own tab.
- The insurance "sign-in" is `src/lib/patient/insuranceMock.ts`, a stand-in marked as such: it calls `save_insurance` with the sample plan and contacts no provider.
- Every route sends `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and a `Permissions-Policy` turning off camera, microphone, location and payment.
- Component sources for the items above: the base components are in `src/components/ui`, patient pieces in `src/components/patient`, portal pieces in `src/components/portal`, and the development-only component sheet at `/kit` (404 in production), which shows every component in every state with phone and desktop tokens and computes the contrast table live.
- Tokens are in `src/app/globals.css`. Phone and desktop differ only through the variables `.desk` resets (radii, control heights, title, heading, numeral and code sizes), so one utility gives the right value in either app.
- `tests/e2e/a11y.spec.ts` checks every screen of both apps at 320px wide (no sideways scroll, axe) and tabs once round each screen (every stop visible, with a focus ring that is not clipped).
