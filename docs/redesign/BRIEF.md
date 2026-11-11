# Trace: full app redesign (phone, patient web, doctor portal)

You are redesigning an existing, working app called **Trace**, a health record app a patient uses to keep their medical history and share it with a doctor for a limited time. This is a restyle plus a set of new sections. It is not a rewrite. Keep every working behaviour (auth, sharing code, approve and deny, timed sessions, the doctor portal) and change how it looks and add the new sections below.

The approved designs live on a canvas artifact. Open it first, switch to Play mode (the triangle button, top right) and click through every screen. Clicks do nothing in the normal canvas view.

Canvas: https://claude.ai/artifact/QqJjhdX4KULdLT2ywoug1y
Live app (current, old design): https://trace-app-liard-eta.vercel.app
Demo patient everywhere: Jane Doe, 35, female, born 12 Mar 1991, Dublin. Demo doctor: Dr Hennessy, GP, Rathmines Medical Centre. Keep this identity consistent on every screen, seed file and test.

---

## 0. How to work

1. **Discover before you change.** Read the repo. Write a short note (in your first reply, not a file) listing: framework and styling approach, routing, where design tokens or theme live, the list of routes/screens that exist today, how the patient app and the doctor portal share code, and how share sessions are stored and enforced. If the patient app and portal are separate bundles, say so.
2. **Tokens first.** Build the token layer and base components (section 2 and 3) and commit that before touching any screen.
3. **Work in the phases in section 9.** After each phase, run the app, take screenshots at the widths in section 10 and compare against the canvas. Fix drift before moving on.
4. **Do not invent design.** If a screen is not on the canvas, build it from the rules in sections 2, 3 and 7. If a rule does not cover it, pick the simplest option that follows the rules and list it in your final report under "Decisions I made".
5. **Keep the diff reviewable.** One commit per phase. Do not reformat unrelated files.

---

## 1. Design direction (read this, it decides most arguments)

The look is **calm, visual, indigo, not text heavy**. Think Revolut or Tines: big confident numbers, lots of air, almost no decoration. It must **not look AI generated** or like a template. The owner has rejected these specific things, so do not add them back:

- **No shadows.** Cards use a 1px hairline border only.
- **No icons inside tinted circles or squares.** Icons are bare, one per row or tile.
- **No "dot + Live" stamp, no pulsing dots, no status pills for decoration.**
- **No blue banner across the top of the doctor portal.** The portal has a left rail, not a header bar.
- **No gradients, no glassmorphism, no emoji, no illustration filler.**
- **No "On / Off" words on toggles.** Use the tick-in-circle control (section 3.5).
- **Tints are reserved for two meanings only:** locked or not-shared (indigo tint) and urgent (peach or red tint). Never use a tint just to decorate.
- **Fewer bubbles and circles.** The only filled circles are avatars and the single centre "add" button in the phone tab bar.
- **No decorative dividers.** Do not put grey lines between inline facts (allergy, blood type, time left). Spacing separates them.
- **Do not repeat explanations.** If the rail already shows what is shared, do not add a "What's shared" dropdown or a repeated legend line on each page.
- **Copy is short and plain.** No marketing tone, no filler sentences, no em dashes anywhere in UI copy.

---

## 2. Design tokens

Create these as CSS variables or theme tokens. Do not hard-code hex values in components.

### Colour

| Token | Value | Use |
|---|---|---|
| ground | #F7F7FB | App background |
| surface | #FFFFFF | Cards, sheets, inputs, tab bar |
| ink | #14163A | Primary text |
| ink-2 | #5B6085 | Secondary text, captions, inactive tab |
| segment-text | #4A4F7A | Unselected segmented control label |
| accent | #5468D4 | Primary actions, active states, links, charts, ticks |
| accent-alt | #4353C4 | Pressed state of accent (also offered: #6B5BD6 as a tweak option, not default) |
| session | #3D4EB8 | Session mode background (phone code, approve backdrop, session active, portal waiting, portal rail) |
| locked-tint | #E8EBFA | Locked or not-shared fill |
| urgent-tint | #FDEBDD, text #9A4A0A | Urgent but not an error (for example 8 days of warfarin left, low/high result) |
| critical-tint | #FCEAE7, text #A12A1E | Allergy, critical safety info |
| border-card | #E1E4F2 | Card outline |
| border-row | #ECEEF8 | Row dividers inside a card |
| border-control | #DCDFF0 | Inputs, segmented control outline |
| border-tabbar | #E4E6F2 | Top and bottom bar hairlines |
| ring-off | #9096BE | Empty (off) ring of the tick toggle |
| tree-line | #C4C8E2 and #B1B6D6 | Family tree connectors |
| range-band | #C9D0F3 | Normal range band on result bars |
| on-session-border | rgba(255,255,255,.28) | Hairlines on session indigo |

Rules: text on accent is white. Text on session indigo is white. Verify every text and icon pairing meets WCAG AA (4.5:1 text, 3:1 for UI components and focus). If `ring-off` or `ink-2` fail on their background, darken them slightly and tell the owner which token changed. Do not lighten anything.

### Typography

- **Sora, weight 300** for page titles, big numerals (strengths, vitals, countdown, code digits), section headings, and names in rows where the canvas uses it.
- **Inter 400 / 500 / 600** for everything else. Labels 500, buttons and tab labels 600.
- Load only these weights. Sora 300/400/600, Inter 400/500/600. Preconnect to Google Fonts or self-host if the app already self-hosts fonts.

| Role | Phone | Portal / web |
|---|---|---|
| Page title | Sora 300, 28/34, -0.01em | Sora 300, 26/32 |
| Patient name (portal header) | n/a | Sora 300, 30 |
| Section heading | Sora 300, 20/26 | Sora 300, 22/28 |
| Big numeral | Sora 300, 22 to 28 | Sora 300, 24 to 48 |
| Row title | Inter 500, 16/22 | Inter 500, 16/22 (17 in overview lists) |
| Body | Inter 400, 15/22 | Inter 400, 15/22 |
| Caption / secondary | Inter 400, 14/20 in ink-2 | Inter 400, 13 to 14 in ink-2 |
| Tab label | Inter 500, 12/16 (600 when active) | n/a |

Minimum text size anywhere is 12px. Body text is never lighter than weight 400.

### Shape, space, borders

- Phone: card radius **24**, buttons **52px tall pill (radius 26)**, segmented control radius 18 (inner 14), bottom sheet top radius 28, inputs radius 16.
- Desktop and portal: card radius **12**, buttons 40 to 44px tall radius 10 to 12, rail items radius 10.
- Phone page padding: **20px sides**. Row min height 60 to 64px. Card inner padding 2px 18px (rows carry their own vertical padding).
- Every border is **1px**. No shadows at all, including focus and modals. Modals use a `rgba(20,22,58,.45)` scrim.
- Phone artboard is 390 x 844 and the design assumes iPhone safe areas. Portal artboard is 1280 x 800.

### Icons

One consistent **line icon set**, 24px grid, 1.75px stroke, round caps and joins, `currentColor`. If the repo already has an icon library, use it with those settings, otherwise inline SVG. Icons are decorative (`aria-hidden`) when beside text, and labelled when alone. Needed: home, record (document), plus, pill, person, calendar, clock, shield, document, smile (mental health), warning triangle, chevron right, back arrow, close, sun, moon, wind (inhaler), tick, family tree node, copy.

### Motion

Keep it minimal: 150 to 200ms ease-out on colour, opacity and the bottom sheet. Countdown bar drains linearly. Respect `prefers-reduced-motion` (remove all transitions except the countdown value changing).

---

## 3. Base components

Build these once, use everywhere. All must be real `<button>` or `<a>` elements with visible `:focus-visible` (2px ink outline, 2px offset; white on session indigo).

1. **Page header (phone):** 56px high, title Sora 300 at left. Detail screens add a 32px back arrow at left, aligned with the page edge (-6px optical offset).
2. **Demo strip (phone):** 28px high bar at the very top with the text "Demo with sample data", 12px ink-2, bottom hairline. Keep it only while the app runs on sample data. Make it a single component behind a flag.
3. **Card:** surface fill, 1px border-card, radius 24 (phone) or 12 (desktop). Rows inside are separated by 1px border-row, and the last row has no divider.
4. **List row:** two-line left (title 500, caption ink-2), optional right value (Sora 300 or ink-2 caption), optional chevron. The whole row is the tap target.
5. **Tick-in-circle toggle:** 24px ring. Off = 1.5px ring in ring-off, empty. On = accent fill with a white tick. No words. It is `role="switch"` (or a checkbox) with an accessible name, 44px hit area. On session indigo the on state is white fill with indigo tick.
6. **Segmented control (radiogroup):** white container with 1px border-control, 4px padding. Selected segment is accent fill with white text, others are transparent with segment-text. 40px tall segments. Used for Current/Past, All/Infections/Conditions, record tabs.
7. **Primary button:** accent fill, white text 600, 52px pill on phone. Secondary: outlined 1px border-control, ink text. Text button: accent text 600, no border, 44px tall. On session indigo: primary is white fill with indigo text, secondary is a text link in white.
8. **Tab bar (phone):** 68px, white, top hairline. Five slots: Home, Record, centre Add (48px filled accent circle, white plus), Medications, Profile. Active item is accent 600, inactive ink-2 500. Hide the tab bar during focused task flows (share code, approve, session, upload) as the current app already does.
9. **Bottom sheet:** white, top radius 28, 40x4 grab handle in border-control, scrim as above, close button 36px at top right, content scrolls, max height about 75 percent of the viewport.
10. **Step chart (strength history):** a stepped line in accent (2.5px), a 10px accent dot at each period start, and the strength label above each dot (12px 600). Y axis is not drawn. It must fit its container (phone about 318px wide, portal detail about 270px) and never scroll horizontally. Compute positions from data. Points are HTML or SVG, labelled for screen readers by a visually hidden list or table of the same values.
11. **Range bar (blood results):** 6px track in border-row, shaded normal band in range-band, a dot for the value. Dot and value text turn #9A4A0A when below or above range. Always show the number and the word "low" or "high" too, never colour alone.
12. **Countdown:** Sora 300 numerals `mm:ss`, plus a 3px bar that drains (accent on white, white on session indigo) over a border-row track. `role="progressbar"` with min/max/now, and announce at 5 min, 1 min and 10 s only (not every second).
13. **Empty and error states:** one line of ink-2 text, one text-button action, no illustration.

---

## 4. Data and behaviour changes (do these before the UI that needs them)

Inspect the existing schema first and extend it. Names below are suggestions, follow existing conventions.

### 4.1 Medications

- `medications`: id, patient_id, name, status (`current` | `past`), schedule text (for example "Morning", "As needed"), unit (`mg`, `mcg`).
- `medication_periods` (new): id, medication_id, strength (number), start_date, end_date (null while current), prescribed_by (doctor id or text), note (the patient's own "how it felt" text, nullable), note_shared (boolean, default false).
- A medication's current strength is the period with a null end date. A past medication has every period ended and `status = past` with an end date shown on the list.
- Editing strength creates a **new period** and closes the previous one on the same date, it never overwrites. UI: "Log a strength change" (strength, date, prescriber, optional note).
- Seed the demo with the Concerta history below and the other medications.

**Concerta (Dr Hennessy for every period):** 18mg Jan 2024 to Mar 2024, "Barely noticed it. A little more focus in the morning, gone by lunch." / 27mg Mar to Jun 2024, "Better focus through the morning. Appetite dropped." / 36mg Jun to Oct 2024, "Steady all day. Good for work." / 45mg Oct 2024 to Feb 2025, "Too much. Racing heart and trouble sleeping." / 36mg Feb 2025 to now, "Back on 36. Smoother and sleeping better."

**Other current:** Levothyroxine 25mcg then 50mcg (Dr Walsh), Warfarin 5mg (Dr O'Mahony, "8 days left" supply flag), Salbutamol 100mcg as needed (Dr Hennessy).
**Past:** Doxycycline 100mg 2 to 9 Aug 2026, Prednisolone 20mg 9 to 14 Feb 2026, Nitrofurantoin 100mg 12 to 17 Sep 2025, Cetirizine 10mg 1 Apr to 30 Sep 2024, all Dr Hennessy.

### 4.2 Full timeline (new)

`health_events`: id, patient_id, type (`infection` | `condition`), title, date (month precision is fine), doctor (name and practice), outcome (`Resolved`, `Settled`, `Ongoing`, `Seasonal`, `Managed`), notes, and a link to the prescriptions given (medication period ids or free text lines with strength and duration). Seed the nine demo events: Chest infection Aug 2026, Asthma flare Feb 2026, UTI Sep 2025, Hay fever Apr 2024, Tonsillitis Nov 2023, Hypothyroidism diagnosed Mar 2022 (Dr Walsh), Covid-19 Dec 2020, Atrial fibrillation diagnosed Jun 2019 (Dr O'Mahony), Glandular fever Feb 2018. Penicillin allergy means antibiotics in the seed data must be non-penicillin.

### 4.3 Visits with detail (new)

`visits` need a detail payload with two kinds:
- **Text** (GP visit, follow-up): reason, assessment, plan (and prescription fields when it is a prescription).
- **Result** (blood test): rows of name, value, unit, reference low and high. Seed: Blood count and INR, 2 Nov: Haemoglobin 128, White cells 6.2, Platelets 245, INR 2.4, Ferritin 18 (flagged low).
Upcoming items (Cardiology 29 Dec, INR blood test 25 Nov) are not clickable. Past items are.

### 4.4 Family history and insurance

- `relatives`: id, patient_id, relation (Mum, Dad, Dad's dad, etc.), conditions[] with age at diagnosis where known. The tree is drawn from these, 7 relatives in the demo (Mum: Type 2 diabetes, Dad: Atrial fibrillation, Dad's dad: Heart attack at 61).
- `insurance_connections`: provider, member number (store masked, show `•••• 4821`), plan name, renewal date, `include_in_shares` boolean. Connecting is OAuth style sign in with the provider. **Trace never sees or stores the user's password.** Manual policy entry is the fallback. Read only, disconnect any time. If no provider integration exists yet, build the full UI against a mock adapter and mark it clearly in code.

### 4.5 Share scopes (important)

Scopes become: **Safety info (allergies, blood type), Medications, Conditions, Recent visits, Care team** (the original set) plus new tiles **Full timeline, Documents, Family history, Insurance, Mental health, Medication notes**.
- Defaults: the original five are on. Full timeline, Documents, Family history, Insurance, Mental health and Medication notes are **off by default**. "Medication notes" controls whether the patient's feel notes on strength periods are visible to the doctor (strength, dates and prescriber follow the Medications scope; only the free text is gated). Confirm this default with the owner in your final report.
- **Enforce scopes on the server.** The doctor portal must only receive data in granted scopes, not receive everything and hide it in the UI. Add a test that requests an ungranted scope and expects a denial.
- A denied or ungranted section in the portal renders as a dimmed "Not shared" row in the rail (section 6.3). It is not clickable and its data is never fetched.

---

## 5. Phone patient app (390 wide, sample data shown below)

Tab bar on all main screens: Home, Record, Add, Medications, Profile. Screens below match the canvas boards named in brackets.

### 5.1 Home [Phone: Home]
Title area: "Good afternoon" (secondary) and "Jane" in Sora 300, avatar "JD" at right. **Today card** in accent fill: "GP visit today", big "9:30 am" in Sora 300, "Dr Hennessy, Rathmines Medical Centre", and a white pill button "Share record" (the primary entry to sharing). "Coming up" section with a small count ("8 days" for the next item): Warfarin refill 19 Nov, INR blood test 25 Nov, Cardiology 29 Dec, each as date (day numeral Sora 300, month caption) plus title. "Recent" section: Blood count and INR (Result, 2 Nov), Fatigue symptoms (Note, 31 Oct), Warfarin renewed (Prescription, 30 Oct). Bare icons, no icon circles. Rows are links into the matching detail.

### 5.2 Share confirm [Phone: Share confirm]
Header: "Share with Dr Hennessy" with avatars JD and DH. A grid of **scope tiles**, one bare icon and one label per tile, each with a tick-in-circle toggle (section 3.5): Safety info, Medications, Conditions, Recent visits, Full timeline, Care team, Mental health, plus Documents, Family history, Insurance and Medication notes from section 4.5 (the canvas shows seven tiles, add the rest in the same style, in a 2-column grid, off by default). Locked tiles (always shared, for example Safety info if the product keeps it mandatory) use locked-tint with a lock icon, and say why in one short line. Then: "Private by default" line, "For how long" segmented control (15 min, 30 min, 1 hr, until I end it, match the existing options), "Doctor can add notes" toggle, and the primary pill "Create share code". No other explanatory text.

### 5.3 Share code, session mode [Phone: Share code]
Background becomes **session indigo** (#3D4EB8), tab bar hidden. Small line "Next: doctor requests access". Title "Share your record". "Enter this at trace-app-liard-eta.vercel.app/view" (use the real portal URL from config). **Four white digit boxes** with Sora 300 digits. One expiry line: "Expires in 4:59" and a text link "Regenerate". Below, a "Sharing" tick list (what will be shared) and a "Not shared" group with dashed rings. No top "Session active" dot row.

### 5.4 Approve access [Phone: Approve access]
Session indigo behind a **white bottom sheet**. "Access request", "Dr Hennessy wants access", avatar DH, "GP, Rathmines Medical Centre", "30 min". "They will see" with accent ticks for shared items and one line "Not shared: Full timeline, Documents, Family history, Insurance, Mental health." Disclaimer line: "Name and practice are as typed. Trace does not check them." Filled **Allow access** button and a **Deny** text link. Allow and Deny must be visually distinct in weight but equally reachable (Deny is not hidden or tiny, 44px tall).

### 5.5 Session active [Phone: Session active]
Session indigo. Avatar DH, "Dr Hennessy has access", "Rathmines Medical Centre, GP visit". "Time left" with **29:58** big and the draining bar. A compact "Dr Hennessy can see" list. Primary white button **End sharing now**. Small line "Access ends at 3:37pm". When the session ends, return to the normal bright app with a one-line confirmation. Also keep the existing lock screen / Live Activity behaviour if the app has one.

### 5.6 Record [Phone: Record]
Title "Record". Segmented tabs **Timeline | Conditions | Family**. Pinned safety facts at the top as plain text: Penicillin allergy (critical colour with warning icon) and Blood type A+.
- **Timeline tab:** list of visits and results with type caption and date at right (Cardiology follow-up Visit 29 Dec, INR blood test 25 Nov, GP visit 11 Nov, Blood count and INR Result 2 Nov, Fatigue symptoms Note 31 Oct, Warfarin renewed Prescription 30 Oct). Upcoming dates in accent. Past rows open **visit detail** (section 5.9). At the bottom a text link **View full timeline** to 5.8.
- **Conditions tab:** Atrial fibrillation (Dr O'Mahony, since 2019, Managed), Hypothyroidism (Dr Walsh, since 2022, Ongoing), Mild asthma (Dr Hennessy, since childhood, Managed), and "Add a condition".
- **Family tab:** "Family tree" with "7 relatives" and a link into 5.7, a short relatives list (Mum, Type 2 diabetes. Dad, Atrial fibrillation. Dad's dad, Heart attack at 61), "Add a relative".

### 5.7 Family tree [Phone: Family tree]
A real tree diagram: relatives as nodes joined by tree-line connectors (#C4C8E2 / #B1B6D6), Jane at the bottom, parents above, grandparents above them. Nodes are compact text chips with the relation and, when present, a condition label. Tapping a node opens a sheet to view or edit its conditions. "Add a relative" is a primary pill. The diagram must be keyboard and screen reader reachable (provide the same data as a list for assistive tech) and pan or scroll when it is wider than the screen.

### 5.8 Full timeline [Phone: Full timeline]
Back arrow to Record. Title "Timeline". Segmented filter **All | Infections | Conditions**. One card of rows grouped by year: the year in Sora 300 at the start of each group (accent for the current year), title 500, sub line "Aug, Infection". Tap opens a **bottom sheet** with title, "Aug 2026, Infection", then labelled blocks **Seen by**, **Outcome**, **Prescribed** (name plus strength and duration), **Doctor's notes**, and a close button. Nine demo entries from 4.2.

### 5.9 Visit detail (not on the canvas, build it)
Back arrow, title is the visit, caption with date and doctor. **Text kind:** Reason, Assessment, Plan blocks (label 13px ink-2 above 16px ink). **Result kind:** a card of result rows, each with name, value in Sora 300, unit, and the range bar from section 3.11, flagged values labelled "low" or "high". Same pattern in the portal (6.5) so the two stay consistent.

### 5.10 Medications [Phone: Medications]
Title "Medications". Segmented **Current | Past**. One card of rows: name 500, sub line (schedule, for example "Morning, 5 strength changes" for Concerta, "Evening, 8 days left" for warfarin in urgent colour), current strength in Sora 300 at right. Rows with history show a chevron and open 5.11. **Past** rows show "2 Aug to 9 Aug 2026, Dr Hennessy" as the sub line and the strength at right. Text button "Add a medication" at the bottom.

### 5.11 Medication detail [Phone: Concerta strength history]
Back arrow, title "Concerta", caption "Now 36mg, since Feb 2025". A hairline card with the **step chart** (18, 27, 36, 45, 36). Section "History" with a card of periods, newest first: strength in Sora 300 at left, then date range, "Prescribed by Dr Hennessy", and the patient's feel note in body text. Text button "Log a strength change". The same screen works for every medication (one period is fine). Notes are editable by the patient, with a per-note or global "Share with doctors" control that maps to `note_shared` (default off).

### 5.12 Profile and Insurance [Phone: Insurance]
Profile is a list: details, Insurance, Documents, Care team, Mental health, Privacy and security, Share history, Sign out. **Insurance** screen: title "Insurance", one line "Choose your provider and sign in with them. Trace never sees your password.", provider list, text link "Enter policy details manually", small "Read only. You can disconnect any time." Connected state: a card with "Connected", Member number `•••• 4821`, Comprehensive plan, "Renews 1 Mar 2027", tick toggle "Include in shares" with caption "Helpful for hospital stays", and a **Disconnect** text button.

---

## 6. Doctor portal (desktop, 1280 x 800 reference)

The portal is the doctor's view of what the patient chose to share. It is **more serious than the phone** but uses the same tokens. No header bar, no banner. A **left rail** holds navigation and the practice, the content is white, and notes live in a resizable panel on the right.

### 6.1 Enter code [Portal: Enter code]
No header bar. Wordmark "trace" top left in Sora, "Dr Hennessy, Rathmines Medical Centre" top right with the text link "Change details". Centre: title "Enter the patient's code", one line "Ask your patient to generate a share code in their Trace app.", four digit inputs (large, Sora 300), primary button **Continue**, and below it "Requesting as Dr Hennessy." A quiet "What happens next" block with three numbered steps: 1 The patient generates a code. 2 You enter it here. 3 They approve, you read what they chose to share. Footer text links: "Privacy and security", "For your practice", and the "Demo with sample data" note. Real inputs with labels, paste support, auto-advance, and clear error text for a wrong or expired code (build the error and expired states, they are not on the canvas).

### 6.2 Waiting for the patient [Portal: Waiting]
Session indigo full page, white text, **no dot and no "Live" word**. Title "Request sent", "Waiting for the patient to approve", a large countdown "4:59" labelled "Patient has", a "Cancel request" text button. Two quiet status lines with tick states: "Code accepted" (done) and "Waiting for approval" (in progress). A small note: "The patient keeps their code and can still share later." In the real app there is no demo button, remove "Demo: patient approves" unless the app already uses it for demos. Build **denied** and **timed out** states (plain text, one action: try again).

### 6.3 Live record shell [Portal: Live record]
- **Rail (232px wide, session indigo #3D4EB8, full height):** wordmark "trace" at top. Nav buttons in order: **Overview, Recent visits, Medications, Full timeline, Care team, Family history**. Active item = white pill with indigo text, others white text on indigo. Then a hairline divider and the **not shared** group: Documents, Insurance, Mental health, shown dimmed with a dashed ring at right and the words "Not shared" under the name. They are not links. Which items are in which group depends on what the patient approved, so build the rail from the granted scopes. Bottom of the rail: "Dr Hennessy" and "Rathmines Medical Centre".
- **Header (white):** a 56px indigo-filled avatar "JD", then "Jane Doe" in **Sora 300 at 30px** with "35, female, born 12 Mar 1991, Dublin" in caption below. **End session** outlined button at the right. Below, one row of facts with no dividers and no pills: **Allergy** with "Penicillin" in critical colour and a warning icon, **Blood type** "A+", **Shared for 30 min** with "29:54 left" (600). Under the row, the **3px accent draining bar** over a border-row track. Nothing else in the header.
- **Notes panel (right, resizable):** default about 300px. A vertical **drag handle** (separator) lets the doctor pull it wider or push it closed. Snap to a collapsed 56px strip with an open button. The handle is keyboard operable (left and right arrows move it by 24px, Enter toggles collapse), `role="separator"`, with `aria-valuenow`. Fields: Chief complaint, Assessment, Plan, Follow-up (the notes the doctor adds that go into the patient's record when the session ends, only if "Doctor can add notes" was on), and a primary **Save notes**. When the patient did not allow notes, show the panel read-only with one line saying so.
- Page content is calm and airy. Do not add a "Read-only. Shared: ..." line to every page. The rail already says what is shared.
- When the countdown reaches 0 or the patient ends it, the portal drops the data from memory immediately and shows an "Access ended" screen with a button back to Enter code. Do not keep patient data in local storage.

### 6.4 Overview [Portal: Live record, Overview]
Two airy columns (about 2 to 1). **Left:** Conditions (name, sub line "Managed, since 2019"), then **Recent visits** as a ledger: day numeral in Sora 300 with the month small, title, and right-aligned type (Upcoming in accent, Visit, Result, Prescription), with a "View all" link. **Right:** **Medications** list (Concerta 36mg, Levothyroxine 50mcg, Warfarin 5mg, Salbutamol 100mcg) with sun, moon and wind icons for Morning, Evening, As needed, **each row clickable with a chevron**, opening the Medications view with that medication selected. Then **Vitals** as four large Sora numerals with captions: 128/82 blood pressure, 74 heart rate bpm, 58 weight kg, 98% O2 saturation.

### 6.5 Recent visits [Portal: Recent visits]
Two panes. Left list: "Upcoming" (not clickable) and the last three past items as buttons (a 3px accent bar at the left of the selected row, `aria-pressed`). Right detail pane shows the **text kind** (Reason, Assessment, Plan, or prescription fields) or the **result kind** (rows with name, value, range bar, low/high flags), the same patterns as phone 5.9.

### 6.6 Medications [Portal: Medications]
Two panes. Left: **Current | Past** segmented control and a list (name, sub line, strength in Sora 300 at right), selected row has the 3px accent bar. Past rows show the date range as the sub line. Right pane: name in Sora 300 26px, "Now 36mg, since Feb 2025", the **step chart** (about 270px wide, must not clip or scroll sideways), then "History" listing every period with strength, date range, "Prescribed by Dr Hennessy" and, when `note_shared` is true, the patient's note as `Jane: "..."`. If notes are not shared, do not render the label or an empty gap. This is the same data and structure as phone 5.10 and 5.11.

### 6.7 Full timeline [Portal: Full timeline]
Two panes. Left (about 292px): title "Full timeline", **All | Infections | Conditions** filter, a year column in Sora 300 and the title and sub line per entry, selected row marked with the accent bar. Right: title, "Aug 2026, Infection", **Seen by**, **Outcome**, **Prescribed** (name plus detail), **Doctor's notes**. Goes back through the years (2018 onwards in the demo). Rail item "Full timeline" is only active when the patient shared that scope.

### 6.8 Care team and Family history
Not drawn on the canvas, build them in the same two-pane or single-column style: **Care team** is a list of clinicians (name, role, practice, since when, phone or message link if the app stores it). **Family history** shows the family tree (same diagram as phone 5.7) plus a relatives list. Read only.

---

## 7. Pages and states that are not on the canvas (apply the system, do not skip them)

Go through every route in the repo and restyle it with the same tokens and components. At minimum:

- **Sign in, sign up, onboarding (the 9-step sign up):** one question per screen, Sora 300 title, 52px pill primary, progress as a thin 3px accent bar at the top (not dots), no illustrations. Keep all existing steps and logic. Inputs: white, 1px border-control, radius 16, 56px tall, visible labels (not placeholder only), inline error text in critical colour with an icon.
- **Documents (upload and list):** list card with icon, name, date, type. Upload is a focused flow with the tab bar hidden. Empty state is one line plus "Upload a document".
- **Mental health, Care team, Profile settings, Notifications, Privacy and security, Share history (access log):** list-card pattern. Share history rows: doctor, practice, date, duration, what was shared, no data inside.
- **Add flows (the centre plus):** a bottom sheet with plain rows: Add a visit, Add a medication, Add a condition, Add a relative, Upload a document, Log a note. Each form is a full screen with the primary pill pinned at the bottom.
- **Edit medication, edit condition, edit relative:** same form pattern, destructive actions are text buttons in critical colour with a confirm sheet.
- **Patient web (desktop width):** there is no desktop design for the patient app yet. At 1024px and wider, use the same two-pane pattern as the portal (list left, detail right), a left rail in white with indigo active state (not session indigo, that colour stays reserved for sharing sessions), max content width about 1120. Report this as an extrapolation in your final report.
- **404, offline, session expired, permission denied:** centred title, one line, one text button.
- **System UI:** favicon, theme-color meta (#3D4EB8 on session screens, #F7F7FB elsewhere), splash, app icon and PWA manifest colours updated to the new palette if they exist.
- **Email or notification copy** (if the app sends any) follows the same short plain tone.

Do not delete any existing route or feature. If something has no obvious home in the new design, restyle it and list it in "Decisions I made".

---

## 8. Accessibility (non-negotiable)

- Touch targets are at least **44 x 44px** on phone, **32px** on desktop pointer UI. The current app has sub-44px buttons and 10px text, fix those.
- Body text at least 15px, nothing under 12px. Contrast AA as stated in section 2. Focus is always visible. Never rely on colour alone (flags carry words, locked items carry the words "Not shared").
- Semantics already planned: `radiogroup` for segmented controls, `switch` for toggles, `tablist` where tabs change content, `separator` for the resize handle, `progressbar` for countdowns, `dialog` for sheets (focus trap, Escape closes, focus returns), `aria-pressed` on selected list rows, `aria-live="polite"` on the detail panes that change, `aria-current="page"` on the active nav item.
- Charts and the family tree have text equivalents. Dates are real `<time>` elements where practical.
- Test with keyboard only, with VoiceOver on the phone flow and one desktop screen reader pass on the portal, and with reduced motion on.

---

## 9. Build order

1. **Foundation:** tokens, fonts, icon set, base components from section 3, Storybook or a simple `/kitchen-sink` dev route showing every component in every state.
2. **Phone shell and core:** tab bar, Home, Record (three tabs), Profile list.
3. **Sharing flow:** Share confirm with the new scope tiles, code, approve, session active, end-of-session return, and server side scope enforcement from 4.5.
4. **Medications:** data model 4.1, Medications list, medication detail with the step chart, Log a strength change.
5. **Timeline and visits:** data 4.2 and 4.3, Full timeline with bottom sheet, visit detail.
6. **Family and insurance:** data 4.4, family tree diagram, insurance connect and connected states.
7. **Doctor portal:** enter code, waiting, live record shell with rail, header, resizable notes panel, then Overview, Recent visits, Medications, Full timeline, Care team, Family history, and the ended, denied, expired and error states.
8. **Everything else in section 7.**
9. **Patient web layouts** at desktop widths.
10. **Polish and QA:** the checklist below.

Commit after each phase with a clear message.

---

## 10. Verification and acceptance

Test at **390 x 844** (phone), **768** (tablet), **1024**, **1280 x 800** (portal reference) and **1440**. For each phase, take screenshots and compare against the canvas. Check:

- [ ] No box-shadow anywhere (`grep` the CSS), no gradients, no icon-in-circle tiles.
- [ ] Every colour comes from a token, no stray hex values.
- [ ] Sora 300 is used for titles and numerals, Inter for everything else, no other fonts load.
- [ ] Session indigo appears only for sharing session screens (phone code, session active, approve backdrop, portal waiting, portal rail).
- [ ] The step chart never clips or scrolls sideways at 390 or in the portal pane.
- [ ] Medication history: Concerta shows exactly 18, 27, 36, 45, 36 in order with dates, prescriber and notes, on phone and portal.
- [ ] Past medications list shows start and end dates, prescriber and strength on phone and portal.
- [ ] Full timeline filter works, entries open sheet (phone) or detail pane (portal) with Seen by, Outcome, Prescribed, Doctor's notes.
- [ ] Recent visits: past rows open detail (text and result kinds), upcoming rows do not.
- [ ] Overview medication rows open the Medications view with that medication selected.
- [ ] Not-shared items in the portal are never fetched and cannot be reached by URL. Server test passes.
- [ ] Medication notes are hidden from the portal unless `note_shared` is on.
- [ ] Notes panel resizes by drag, by keyboard, and collapses to the 56px strip.
- [ ] Countdown reaches zero, the portal clears data and shows "Access ended".
- [ ] Keyboard only pass, screen reader pass, reduced motion pass, contrast pass.
- [ ] No em dashes in UI copy. No "Live" stamp. No header banner on the portal.
- [ ] Lighthouse accessibility score 95 or higher on the main screens.

Existing tests must still pass. Add tests for: strength period creation closing the previous period, scope enforcement, countdown expiry, and the segmented controls.

---

## 11. Final report format

Reply when done with:
1. Phases completed and commit list.
2. **Decisions I made** (anything not on the canvas, plus the patient web layout extrapolation).
3. **Deviations from the canvas** and why.
4. Contrast tokens you adjusted, if any.
5. Open questions for the owner: default for "Medication notes" sharing, whether Full timeline should be a default-on scope, and whether insurance uses a real provider integration yet.
6. Screenshots (before and after) of: Home, Share confirm, Session active, Medications, Concerta detail, Full timeline, and the portal overview, medications and timeline views.

Canvas board names to find each reference screen: Phone: Home, Share confirm, Record, Family tree, Insurance, Medications, Concerta strength history, Full timeline, Share code, Approve access, Session active. Portal: Enter code, Waiting, Live record (with Overview, Recent visits, Medications, Full timeline views).
