# Trace app: notes for agents

Trace is a health record a patient owns and shares with a doctor only when they say so. Designed by Aoife Randles; this repo is the working MVP. `PLAN.md` is the build plan (section 0 overrides the rest). Read it before starting a phase.

The app is being redesigned. `docs/redesign/SUPERVISOR-NOTES.md` (read first; it wins over the brief where they disagree), `docs/redesign/BRIEF.md` (the spec) and `docs/redesign/canvas/*.dc.html` (the approved boards, every value inline) govern the look. Phase 1 (tokens, fonts, icons, base components, /kit) is done; later phases rebuild each screen against its board, using only what is described under "Design system" below. Also read `AGENTS.md`: this is Next.js 16, which differs from older versions (Middleware is now `src/proxy.ts`, Cache Components is on). The docs for the installed version are in `node_modules/next/dist/docs/`.

## Run it

```bash
npm install
npm run dev         # http://localhost:3000
npm run build       # production build (/kit is a 404 there)
npm run lint
npm run typecheck   # next typegen + tsc
npm run test:e2e    # Playwright + axe; starts `next dev` on :3100 if nothing is running there
```

`.env.local` (git-ignored) holds the six variables listed in `.env.example`. Never print, log or commit their values. There is no Supabase secret key anywhere in this project.

In this container Chromium is preinstalled at `/opt/pw-browsers/chromium` and `playwright.config.ts` uses it. Do not run `playwright install`. `@playwright/test` and `playwright-core` are pinned to 1.63.0 (an `overrides` entry keeps `@axe-core/playwright` on the same version); keep them together.

## Folders

```
src/app/                 Routes (App Router). globals.css = tokens, fonts.ts = Inter + Sora, icon.svg = favicon
src/app/kit/             Dev-only UI kit (every component, every state, phone and desktop) + /kit/patient, /kit/portal shell demos
src/components/ui/       Base components used by both apps (Icon, Button, Card, ListRow, Toggle, SegmentedControl, StepChart...)
src/components/patient/  Patient app pieces (TabBar, PageHeader, TimelineItem, SharedSummaryCard...)
src/components/portal/   Clinician portal pieces (Rail, PortalSidebar, PatientSummaryCard, SessionNotesPanel...)
src/components/layout/   PatientShell, PortalShell
src/lib/supabase/        client.ts (browser), server.ts (server), proxy.ts (session refresh)
src/lib/env.ts           Public env readers; src/lib/server-env.ts holds server-only secrets
src/lib/format.ts        formatCountdown, formatCountdownSpoken, initialsOf
src/proxy.ts             Next.js Proxy: refreshes the Supabase session on patient routes
tests/e2e/               Playwright specs; axe.ts has expectNoAxeViolations()
docs/REVIEW.md           Everything Aoife must check: new screens, new strings, accessibility substitutions
supabase/                Owned by the database work (migrations, SQL tests, generated types). Do not edit from UI work
```

## Where screens go

- Patient screens: `src/app/(patient)/<route>/page.tsx` (route group, so URLs stay `/home`, `/record`...). Wrap each in `PatientShell`.
- Portal screens: `src/app/view/...`: the steps outside a session in `PortalShell`, the live record in `RecordFrame` (see "Doctor's portal").
- A component used by one screen only lives next to it in `_components/`. Move it to `src/components/` once a second screen needs it.
- The routes are in PLAN.md section 6; the redesign's boards are in `docs/redesign/canvas/` (titles in `canvas.json`). Every new screen and every new string goes in `docs/REVIEW.md`.

## Patient app (Phases 3, 4 and 5)

- Signed-in routes live in `src/app/(patient)/`; sign-up steps 3 to 7 in `src/app/signup/(account)/`. Both layouts wrap `PatientSessionGate` (`src/components/patient/PatientSession.tsx`) in `<Suspense>`. The gate checks the session in the browser and redirects (signed out to `/`, unfinished sign-up to its step by `profiles.onboarding_step`). Every page there exports a wrapper that renders its screen inside `<SessionReady>`, and reads the user with `usePatientSession()` (`userId`, `email`, `profile`, `setProfile`, `reloadProfile`).
- Screens frame themselves with `TabScreen` (the five tabs) or `SubScreen` (details and forms) from `(patient)/_components/Screens.tsx`. Both render `DemoMarker` (the "Demo with sample data" strip, demo accounts only) and `LiveBannerSlot`, the seam for the live share banner. `LoadStatus` is the loading line and the load-failed `StateMessage`.
- Data: the browser Supabase client, loaded with `useLoad()` (`src/lib/useLoad.ts`). Dates and "today" are Irish time: use `src/lib/dates.ts`.
- Next.js keeps earlier screens in the page, hidden. Element ids must be unique per screen instance (forms use `useId()`), and tests should prefer `getByRole` (it skips hidden elements) or add `.filter({ visible: true })`.
- The gate reads the cookie session locally, then runs `getClaims()` (local signature check), the profile read and `my_share_session()` in parallel. In the record area it wraps everything in `ShareSessionProvider` (`src/components/patient/ShareSession.tsx`): `useShareSession()` gives `session` (live, else the latest), `loaded`, `refresh()`, `setSession()` and `announce()`. It subscribes to Realtime on the user's `share_sessions`, polls `my_share_session()` every 3 s while anything is live, renders the access request sheet (`AccessRequestSheet`) over any screen when the status is `requested`, and owns the one polite live region for timer milestones. Pages never decide a share has expired; at zero they call `refresh()`.
- Share helpers (types, words, durations, what is shared) are in `src/lib/patient/share.ts`; the session-indigo screens' rows in `src/lib/patient/useShareSummary.ts` and `src/components/patient/SharedSummaryCard.tsx`. Routes: `/share` (`?appointment=<visit id>` from Home's card), `/share/code`, `/session` (active and Time's up), `/session/ended?id=`, `/access-log`.
- Countdowns use `useNow()` (`src/lib/useNow.ts`), which runs on the database's clock: the browser Supabase client measures the offset from every response's `Date` header (`src/lib/serverClock.ts`). Do not count down from `Date.now()` directly.
- Sign out and account deletion call `leaveForWelcome()` (a full page load), so screens Next.js keeps hidden in memory do not keep the previous person's record. A `BottomSheet` closes itself when its screen is hidden; close confirm sheets in state after their action succeeds, or they reopen on Back.
- Ending a session writes the row twice in one transaction with the same `updated_at`; `pick()` in `ShareSession.tsx` keeps the version with `notes_entry_id` on a tie. Do not resolve ties by arrival order.
- Demo accounts (`isAnonymous`) get `DemoMarker` (a `DemoStrip`) at the top of every screen and "Reset demo" in Profile. Real accounts never see the strip. `/demo` (outside the gate) frames `/` and `/view?demo=1`; `next.config.ts` sends `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` on every route. The daily cleanup is `GET /api/cron/cleanup` (Bearer `CRON_SECRET`, scheduled in `vercel.json`); never call it with the real secret from tests.
- Tests: `tests/e2e/patient.spec.ts` signs in once per project with "Try the demo" and reuses the session (anonymous sign-ins are capped); `helpers/patient.ts` gives a Node Supabase client as that user for `seed_demo_record()` resets. Run with `E2E_PORT=3000` while your dev server is on 3000. `tests/e2e/share-loop.spec.ts` drives both sides in real browsers (patient at 390 wide, doctor in a second context), desktop project only; Time's up and the timer announcements use stand-in `my_share_session` responses (`page.route`), since a real share lasts at least 30 minutes. Contexts made inside a test inherit `test.use({ storageState })`: pass `storageState: { cookies: [], origins: [] }` for a brand-new visitor.

## Doctor's portal (Phase 7)

- `/view` (`_components/ViewFlow.tsx`) is every step before the record: loading, the name step (remembered in this browser under `trace.portal.clinician`; `?demo=1` pre-fills Dr Hennessy), the code (wrong, expired and locked are the code step's own error line, not screens), waiting (session indigo, polls `portal_status` every 2 s), declined, timed out, withdrawn. Approval goes straight to `/view/session`. The steps use `PortalShell` + `PortalSplit` (the boards' 520px step and 340px side list, `StepRows`/`StepRow`), `PortalHeader` and `PortalFooter` (`demo` swaps the right-hand note). `/view/about` holds Privacy and security and For your practice.
- `/view/session/*`: `SessionFrame` (the layout) polls every 5 s, loads the overview once for the header (`useSession().overview`), and renders `RecordFrame`: `PortalSidebar` (the rail, built from `VIEWS` in `src/app/view/_lib/sections.ts` and the scope), `PatientSummaryCard` (h1 is the patient's name; facts row; the 3px `Countdown`), the view, then `ResizableNotes` around `SessionNotesPanel`. Views are in `session/_components/Views.tsx`, one route each (`visits`, `medications?id=`, `timeline`, `care-team`, `family`, `documents`, `mental-health`, plus `end`), and load their own section with `useSection(name)`.
- Insurance is personal (Aoife, Nov 2026): it is not in `VIEWS`, has no route, and `SECTIONS` leaves it out, so `/api/portal/record?section=insurance` is `invalid_section` whatever the scope says.
- Not shared means not fetched: the frame checks the view's scope before it mounts it (an ungranted address shows `NotSharedView` and asks for nothing); `/api/portal/record` calls `portal_get_record` with `version: 2` and answers an ungranted section with 403 `not_shared`. To add a view: add it to `VIEWS` (with its scope key), a page under `session/`, and its section to `SECTIONS` in `src/app/api/portal/_lib/portal.ts`.
- Documents open through `/api/portal/document?id=` (the file itself, with its stored type, `nosniff`, a `sandbox` CSP, `no-store`); `next.config.ts` repeats the CSP for that path, since the site-wide header would replace it.
- When access is not active (paused, ended, or the countdown reaching zero, which hides the record at once and asks the database), the frame stops rendering the views, so their data leaves memory; nothing about the patient goes into browser storage. The frame keeps the document titled so Next's route announcer never stores the patient's name (the h1).
- Next keeps earlier views alive and hidden: in tests use `getByRole` or `.filter({ visible: true })`, and state in a view must follow a changed `?id=` (Medications does).
- Tests: `portal-loop` (the real loop), `portal-scopes` (each scope alone, the API refusals, medication notes, documents, mental health), `portal-states` (stand-in responses from `tests/helpers/portal-mocks.ts`: made-up data, time-based states, the notes panel), `portal-screens` (opt-in `E2E_SCREENS=1`, writes `docs/redesign/screens/after/`). They drive the patient with `tests/helpers/portal-patient.ts` (`seed_demo_record_v2`, the new `create_share_code` with all four new scopes named, and the patient app's defaults: Full timeline and Medication notes on, Insurance off).

## Shells

```tsx
<PatientShell
  demo={<DemoMarker />}           // "Demo with sample data", demo accounts only, very top
  banner={<LiveBannerSlot />}     // the live share strip while a doctor has access
  header={<PageHeader title="Record" />}
  tabBar={<TabBar />}             // only on the five main screens
  footer={<Button fullWidth size="lg">Continue</Button>}  // pinned bottom action (sign-up, forms)
>
  ...screen content (inside <main id="main">; add the 20px gutter, px-5)...
</PatientShell>
```

Full width up to 480px, a centred 430px column above. No fake iOS status bar. The frame is one screen tall, as on the boards: the demo strip, banner, footer and tab bar stay put and only `<main>` (with the header inside it) scrolls, so nothing sits under the tab bar. Do not add `sticky` bars inside a screen; use the shell's slots. `tone="session"` for the sharing screens (share code, session active, Time's up): session indigo, white text, white focus rings. Add `<ThemeColor tone="session" />` on those screens so the browser chrome matches.

`PortalShell` takes `header`, `sidebar`, `notes`, `footer`, children, and sets `.desk`, so everything inside takes the desktop token values; `<main>` is a flex column. The portal uses it for the steps outside a session (code, waiting, paused with `notes`, ended): one column, `tone` `ground` (default) or `session` (waiting). The live record uses `RecordFrame` (`src/components/portal/RecordFrame.tsx`, also `.desk`): from 1024px it fills the window, the 232px rail full height, the record (header, then the view, which scrolls inside itself and is a size container, so views lay out by `@min-[600px]:` and the like), then `ResizableNotes` (14px handle and the panel, 300px by default, 56px collapsed). Below 1024px it stacks: the rail as a row of section tabs, the record, the notes. Both render the "Skip to the record" link.

## Supabase

- Client Components: `import { createClient } from "@/lib/supabase/client"`. Runs as the signed-in user under RLS.
- Server Components, Server Actions, Route Handlers: `const supabase = await createClient()` from `@/lib/supabase/server`. Create one per request.
- To check who is signed in on the server use `supabase.auth.getClaims()`, never `getSession()`.
- Cache Components is on: anything that reads cookies (the server client does) must render inside `<Suspense>`, and must not be awaited at the top of a layout. See `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.
- The portal's browser never talks to Supabase. Portal route handlers call the `portal_*` functions through the server client with `portalServerSecret()` (from `@/lib/server-env`) as the first argument.
- `src/proxy.ts` only refreshes sessions; it redirects nobody. Protect pages in the pages/layouts. It skips `/kit`, `/view` and `/api/portal`.
- When the generated database types land, pass them as the client generic (`createBrowserClient<Database>`).

## Design system (BRIEF.md sections 1 to 3)

Calm, indigo, not text heavy. The owner rejected these, so never add them: shadows (cards are a 1px hairline), icons in tinted circles or squares, dot + "Live" stamps, pulsing dots, status pills for decoration, a banner across the portal, gradients, glassmorphism, emoji, illustrations, On/Off words on toggles, decorative dividers between inline facts, repeated explanations. Tints mean only two things: locked or not shared (`locked-tint`) and urgent (`urgent-tint`, `critical-tint`). The only filled circles are avatars and the tab bar's Add.

### Tokens (`src/app/globals.css`)

- Tailwind v4. Tailwind's own colours, radii and shadows are cleared, so only Trace tokens exist, and no shadow utility exists at all. Never write hex or rgba in a component; every colour is a token utility.
- Colour (brief's names): `bg-ground` (page), `bg-surface` (cards, sheets, inputs, tab bar), `text-ink`, `text-ink-2` (secondary that carries meaning, 5.7:1 on ground), `text-segment-text`, `bg-accent` / `text-accent` (actions, active, links, charts, ticks), `accent-alt` (pressed), `bg-session` (sharing screens and the portal rail only), `session-deep` (the approve backdrop), `locked-tint`, `urgent-tint` + `text-urgent`, `critical-tint` + `text-critical`, `border-border-card`, `divide-border-row` / `bg-border-row` (row dividers, bar tracks), `border-border-control` (inputs, segmented), `border-border-tabbar`, `ring-off` (empty tick ring), `switch-off`, `tree-line`, `tree-node`, `tree-faint`, `range-band`, and on session indigo `on-session-border`, `text-on-session-2` (secondary text, 78% white), `on-session-ring`, `on-session-dash`; `bg-scrim` behind dialogs.
- Text on accent and on session indigo is white (`text-white`). On accent, secondary text is white too: white at 80% is only 3.8:1 there.
- Type roles (size, line height and tracking come with the token; add the weight). Sora roles add `font-display font-light`: `text-display-xl` 72, `text-hero` 56, `text-display` 44, `text-countdown` 40, `text-code` (44 phone / 48 portal), `text-numeral-lg` 32, `text-name` 30, `text-wordmark` 28, `text-title` (page title, 28/34 phone, 26/32 portal), `text-title-md` 26 (sheets, portal panes), `text-title-sm` 24 (detail titles), `text-heading` (section heading, 20/26 phone, 22/28 portal), `text-numeral` (strength in a row, 22 phone / 20 portal), `text-year` 20. Inter (`font-normal` 400, `font-medium` 500, `font-semibold` 600; never bold): `text-unit` 18, `text-row-lg` 17/24, `text-body-lg` 16/24, `text-row` 16/22 (row title, 500), `text-body` 15/22, `text-label` 15/20 (tile labels, 600), `text-caption` 14/20 (with `text-ink-2`), `text-meta` 13/18, `text-micro` 12/16. Nothing is smaller than 12px.
- Radii: `rounded-card` (24 phone / 12 portal), `rounded-tile` (20 / 12), `rounded-tile-lg` 22, `rounded-feature` 28 (accent cards), `rounded-strip` 16, `rounded-button` (26 pill / 12), `rounded-control` (18 / 12) and `rounded-segment` (14 / 8) for the segmented control, `rounded-input` (16 / 12), `rounded-code` (18 / 12), `rounded-rail` 12, `rounded-t-sheet` 28, `rounded-full` for avatars and discs.
- Phone and desktop: the context tokens (radii, `--h-button-md`, `--h-segment`, `--h-input`, `text-title`, `text-heading`, `text-numeral`, `text-code`) take their desktop values inside `.desk`; `PortalShell` sets it, `.desk-lg` applies it from 1024px (for the patient web layouts). Never restate a value to get the desktop look; put the screen inside `.desk`.
- Spacing is Tailwind's 4px scale (fractions work: `px-4.5` is 18px). Phone pages have a 20px gutter (`px-5`); cards of rows are `px-4.5 py-0.5`.
- Every border is 1px (the share tiles' 1.5px and the tick ring's 2px are from the boards).
- Motion: 150 to 200ms `ease-out` on colour, opacity and the sheet (`animate-sheet-up`); the countdown bar drains linearly. Reduced motion removes transitions (globals.css).

### Fonts and icons

- `src/app/fonts.ts`: Inter 400/500/600 (`font-sans`, the default) and Sora 300/400/600 (`font-display`) through `next/font/google`, self-hosted. No other font loads.
- `<Icon name="pill" />` from `@/components/ui/Icon`: the boards' own SVG paths on a 24px grid, 1.75px stroke (2px for chevrons, arrows, close, warning), round caps and joins, `currentColor`. `ICON_NAMES` lists them; add a glyph there, drawn on the same grid, rather than importing another set. Icons are decorative (aria-hidden) unless given `label`. lucide-react is gone.

### Components (`src/components/ui/`, shown in every state at /kit)

- `Button` / `ButtonLink` / `buttonClasses()`: `variant` primary | secondary | text | destructive, `size` lg (52) | md (44 phone, 40 portal) | sm (36, 44px tap area), `tone` default | session | onAccent, `fullWidth`, `loading`, `iconLeft`/`iconRight`. One primary per screen. On session indigo the primary is white with ink text and text/secondary buttons are white underlined links.
- `IconButton` / `IconLink`: `icon` (an icon name), `label` (required), `size` 32 | 36 | 40 | 44 (always a 44px target), `tone` default | muted | session | framed.
- `Card` (`padding` rows | md | lg | none, `divided`, `as`), `SectionHeading` (Sora section heading), `SectionLabel` (14px 600 ink-2 group label, `tone="session"`), `Avatar` (`size` 40 to 88, `tone` outline | solid | tint | session | onAccent, `display` for Sora letters).
- Rows: `ListRow` (title, caption, `captionTone`, `icon`, `leading`, `value` with `valueStyle` numeral | caption | accent, `chevron`, `href` or `onClick`), `YearRow` (the timeline's year column), `SelectableRow` (portal two-pane list with the 3px accent bar and `aria-pressed`; `titleSize="lg"` for the medication list), `DayMonth`, `DateTile` + `DateTileRow` (Home's "Coming up"), `DetailBlock` (label over value; `items` for "Prescribed").
- Toggles (`Toggle.tsx`): `TickIndicator`, `TickToggle` (standalone, needs `label`), `ToggleRow` (a whole row is the switch), `ScopeTile` (share tiles: toggle, `locked`, `privateByDefault`, `wide`), `LockIndicator`, `SharedMark`. `Switch.tsx`: `SwitchRow` (label + switch, description may hold a link; `control` tick | track, `surface` plain | tile), `LockedRow`, `SwitchGroup`, the bare track `Switch`. No On/Off words.
- `SegmentedControl`: `options`, `value`, `onChange`, `label`, `mode` radio (radiogroup) | tabs (tablist, with `idBase` and `tabPanelProps(idBase, value)` on the panel), `size` md | lg, `fill={false}` for many options (scrolls inside itself).
- `BottomSheet`: modal `<dialog>`, white, handle, 36px close (unless `dismissible={false}`), scrim, max 75% tall; `eyebrow`, `title`, `actions` (primary full width, then a text button).
- Data: `StepChart` (`periods` oldest first, `unit`, `caption`; fills its container, never scrolls, a hidden table for screen readers), `RangeBar` / `ResultRow` / `resultFlag()`, `Countdown` (`msLeft`, `msTotal`, `tone`, `layout` stacked | inline, `announce` for 5 min / 1 min / 10 s), `ProgressBar` (3px or 6px, `linear`).
- Forms: `TextField`, `TextArea` (`density="compact"` in the portal notes), `SelectField`, `CodeInput` (`size="lg"` for the portal's 112px boxes), `Field` underneath. `CodeDisplay` is the patient's code on session indigo.
- States: `Notice` (`tone` neutral | critical | urgent | locked, `surface="session"`, `live`), `StateMessage` (one ink-2 line and one text button; `tone="error"` is an alert), `PageState` (404 and the like), `DemoStrip`, `ThemeColor`.

### Conventions

- Interaction states: use the `hovered:` and `pressed:` variants (globals.css), not `hover:`/`active:`. They also respond to `data-force="hover"` / `"press"` / `"focus"`, which is how /kit pins states.
- Focus: a global 2px ink `:focus-visible` outline with a 2px gap. On session indigo add `on-session` (shells and the rail do) so the ring is white. Never remove outlines. In a container that clips, inset the ring (`focus-visible:-outline-offset-2`).
- Touch: 44 x 44 on the phone (`hit-area` and `hit-area-square` utilities keep a small control's look), 32px for desktop pointer UI.
- `cn()` in `@/lib/cn` only joins classes; it does not merge. Pass `className` for layout (margin, width, grid), not to restyle a component. If a component needs a new look, add a prop.
- Copy: short, plain, no em dashes. Use the boards' words for the screens they show, and corrected values from PLAN.md section 11, never the old Figma mistakes.

## Accessibility (PLAN.md section 10, WCAG 2.2 AA)

- Every field has a visible label (`label` prop). Errors are words, passed as `error`; they are tied to the field with `aria-describedby`.
- Status is never colour alone: flags say "low" or "high", urgent captions say what is due, locked items say "Not shared" or "Always shared", the safety strip says "allergy".
- Timers: never put a ticking countdown in a live region. The patient side announces session start, 5 minutes left, 1 minute left and ended in ShareSession's polite region; `Countdown announce` gives a component its own (5 min, 1 min, 10 s) where nothing else announces. `formatCountdownSpoken` helps.
- `BottomSheet` is a modal `<dialog>`; focus moves in, Tab wraps inside, and focus returns to the opener on close.
- Every new screen gets a Playwright test that runs `expectNoAxeViolations(page)`, and an entry in `tests/e2e/a11y.spec.ts` (320px reflow, a Tab round checking every stop is visible with an unclipped focus ring). In a container that clips (`overflow-hidden`, a scrolling row), give the ring room or inset it (`focus-visible:-outline-offset-2`). The /kit test is in `tests/e2e/kit.spec.ts`.
- Contrast: every text pairing in the token table passes 4.5:1 and every icon or control edge 3:1, except field and segmented outlines (`border-control`, 1.3:1, as the boards draw them; flagged for Aoife). The kit's Tokens section computes them live. If a new pairing fails, darken the token slightly, never lighten, and record it in `docs/REVIEW.md` with every other substitution.

## Git

Work on `claude/charming-goodall-sivzpd`. Commit at each working checkpoint with a clear message; never push or open a pull request (the supervising session does). Keep the tree clean between steps.
