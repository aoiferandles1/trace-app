# Trace redesign: final report

For Aoife, 11 November 2026. This follows section 11 of your brief. The list to work through is `docs/REVIEW.md`; screenshots are in `docs/redesign/screens/`.

Nothing has been deployed. The live site still runs the old design, held there by the file `.deploy-hold`.

## 1. Phases and commits

All ten phases are on the branch `claude/charming-goodall-sivzpd`.

| Phase | What it covered | Commits |
|---|---|---|
| Database | Strength periods, full timeline, visit detail, family, insurance, documents, new scopes, new demo record | 2bb502d, 12e6929, 3209cb9, merged 305eb75 |
| 1. Foundation | Colours, Inter and Sora, icons, base components, component sheet (`/kit`) | 9307fe4, d88187e, 6b67ac2, a2d485d, 8b50bfe, 7a7f37c, 71e38a6 |
| 2. Core | Home, Record, Profile | d9aa6ef, 4892f1f |
| 3. Sharing | Share confirm, code, request, session, return to Home | 2d53842, c58c148, d1a6c2a, 95e4de3, 2aa4de7, f7ef653 |
| 4. Medications | List, strength history and chart, strength changes, notes | abefeda, d3fb2a6 |
| 5. Timeline and visits | Full timeline and sheet, visit detail | ab1034e, dfae7dc |
| 6. Family and insurance | Family tree, insurance, documents | f51afe1, b6adb45, fc74611, 880c195, 27d4ef6, a380715, ad7fa92, 58e8fef |
| 7. Portal | Enter code, waiting, live record, every view and state | 1278b41, e9e0df1, e530f1c, 19ac15b, 51ea912, 6c3e62f, merged e5af74e |
| 8. Everything else | Add sheet, condition detail, ended summary, error pages | 99d405b, 69ad861, db165d6 |
| 9. Patient web | The patient app on a computer | 61b8cd4, 6ee45b1, 423a930, 479bd3c, f81923b, d634008 |
| 10. Polish and QA | Fixes, screenshots, documents | 89ce4e5, c0a2e8e, 9a9db68, dc2a2cd, 6f50e3a, a95f3de |

The history also holds commits whose message starts with "WIP": checkpoints saved while a phase was in progress. The phase commits above are the reviewed ones.

Phase 10 fixed, most serious first:

- On a phone, the access request could push Deny off screen once your longer default share was on. Allow and Deny now always stay visible.
- The strength chart's last "36mg" was crossed by the line from 45mg. Labels now move clear of the line for any history.
- The portal's "128/82" and "74" ran together.
- The timeline's year touched its title.
- A dozen 1 to 18px drifts from the boards (the code screen's top gap and row height, Record's timeline link, the demo strip's hairline, sheet spacing, the gap under the wordmark in both rails, portal list captions).

## 2. Decisions I made

**The patient app on a computer is an extrapolation; there is no board for it** (W1 to W9 in REVIEW.md):

- From 1024px a white rail replaces the tab bar.
- Content is at most 1120px wide.
- Record, Medications and Full timeline become two panes, like the portal; everything else is one 640px column.
- An empty right pane shows one line ("Choose a medication to see its history") and does not open the first item.
- Forms and sharing keep the phone's centred column.

Please approve it or draw a desktop board.

Other decisions:

- The today card shows only on a visit day; while sharing it shows the time left (E1, E2).
- Coming up tiles open their item (E3).
- Share confirm has ten tiles, and is titled "Share your record" when started from Profile (E11, E12).
- A Back to Home chevron on the session screens (E17).
- Medication rows always open; their screens can edit and share notes (M2, M4).
- Edit and "Add to your timeline" on the timeline (T1).
- Result values shown as captions, as in the portal (Q11).
- Faded relatives keep readable names (F2).
- Insurance sign-in is a marked stand-in (I2).
- Documents built from the brief's rules, with files kept in the database behind the same gate as the rest of the record (Q13).
- The Add sheet's seven rows, and two forms renamed to match them: "Add a visit" and "Log a note" (A1, A2).
- Portal: "Change details" where the board puts it (P1), a one-step End session confirmation (P6), the vitals date (P9), "Earlier" visits (P10), stacking below 1024px (P16), "Not shared" headings on the Overview (P13).
- Chart labels go under their dot when the line runs through them (X1).

## 3. Deviations from the boards

- **Your decisions:** insurance is never shared, Full timeline and Medication notes start on, and refills are urgent at 5 days (so the demo's warfarin tile, 8 days away, is plain).
- **The data:** 4 active medications (the code board says 3), a pharmacy in the care team, 4 strength changes for Concerta (the board says 5), and Levothyroxine has a change.
- **Accessibility:** darker field outlines, full white text on the accent card, readable faded names, 44px tap areas, Deny always visible.
- **Boards against the brief:** where they disagree the build follows the boards (B1 to B14).
- **Boards that can't be followed exactly:** the today card overflows its own padding on the board (X6); the boards' chart labels overlap the line (X1); the approve backdrop is the usual scrim, which comes out at the board's colour (B8).
- **Left as documented:** the portal's Cancel request and Continue rows sit a few pixels off the board because they keep their larger tap targets.

## 4. Contrast tokens adjusted

- `ring-off` #9096BE to #878DB3 (3.2:1).
- New `border-field` #878DB3 (3.2:1) on text fields and code boxes. The boards draw them with the 1.3:1 control border.
- White at 80% on accent to full white.

Nothing was lightened.

## 5. Open questions

The three from the brief:

- **Medication notes:** on by default (you decided 11 Nov).
- **Full timeline:** on by default (you decided 11 Nov).
- **Insurance provider integration:** not real; it is a stand-in. Insurance is also never shared.

Still open (defaults in REVIEW.md section 6):

- B3: the 56px share button.
- Q4, Q10: sample data.
- Q11: result values in Sora.
- Q12: an undo for strength changes.
- Q13: PDFs download; whether a shared PDF should open in desktop Chrome instead.
- Q14: timeline Edit.
- Q7 and X10: the session chevron and its direction.
- Q8: a Mental health row in Profile.
- Q9: sharing from Home.
- X9: "Live now" as plain text in Share history.
- X1: chart labels.
- W1 to W9, with W4 and W7: the patient app on a computer.
- Whether the demo's warfarin refill should move to 5 days or fewer, so the urgent state shows in demos.
- The older first-build questions still listed there.

## 6. Screenshots

Before is the live old design, after is this build, at the same sizes (phone 390 x 844, portal 1280 x 800). Paths are under `docs/redesign/screens/`.

| Screen | Before | After |
|---|---|---|
| Home | before/home.png | after/home.png |
| Share confirm | before/share-confirm.png | after/share-confirm.png |
| Session active | before/session-active.png | after/session-active.png |
| Medications | before/medications.png | after/medications.png |
| Concerta detail | The old app has no medication screen | after/concerta-detail.png |
| Full timeline | The old app has none; its Timeline tab is before/timeline.png | after/full-timeline.png |
| Portal overview | before/portal-overview.png | after/portal-overview.png |
| Portal medications | before/portal-medications.png | after/portal-medications.png |
| Portal timeline | before/portal-timeline.png | after/portal-full-timeline.png |

More after screens are in the same folder (record, family tree, insurance, the code and request screens, the other portal views), and the patient app on a computer is in `after/desktop/` at 768, 1024, 1280 and 1440.

## 7. What was checked, and what was not

Checked:

- Lint, typecheck and the production build pass.
- The full browser test run: 140 passed, 0 failed, 48 skipped by design (opt-in screenshot runs and tests that belong to one project).
- Lighthouse accessibility: 100 on the 32 screens audited (patient phone, patient desktop, portal).
- Every line of the brief's section 10 at 390, 768, 1024, 1280 and 1440, except the screen reader line.
- All 14 boards against the built screens: nine by measuring text position, size, weight and colour, five by side-by-side image. Care team has no board.
- Sharing, in the browser with a live session: a section that isn't shared is not fetched and can't be reached by its address; the portal's API refuses it; nothing is returned after the session ends; nothing about the patient is left in browser storage; file routes send the three safety headers; no server secret is in the client bundle.

Not checked:

- **Nine of the ten database test files were not re-run in the final pass** (one passed, 8 of 8). The database tool asks for a confirmation before running them and nobody answered. The database itself has not changed since the redesign's database work was merged.
- A screen reader (VoiceOver, or one on desktop). The accessibility tree was checked instead.
- Real phones.
- Real email sign-up; no real account exists yet.
- A shared PDF opening in desktop Chrome.
- A real 30 minute share running out (the test uses a stand-in response).

One demo test account was left behind during QA; the daily cleanup removes it.
