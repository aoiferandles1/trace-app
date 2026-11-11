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
