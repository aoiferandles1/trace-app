# Trace app: notes for agents

Trace is a health record a patient owns and shares with a doctor only when they say so. Designed by Aoife Randles; this repo is the working MVP. `PLAN.md` is the build plan (section 0 overrides the rest). Read it before starting a phase. Also read `AGENTS.md`: this is Next.js 16, which differs from older versions (Middleware is now `src/proxy.ts`, Cache Components is on). The docs for the installed version are in `node_modules/next/dist/docs/`.

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
src/app/                 Routes (App Router). globals.css = tokens, fonts.ts = Sora + DM Sans
src/app/kit/             Dev-only UI kit (every component, every state) + /kit/patient, /kit/portal shell demos
src/components/ui/       Generic pieces used by both apps (Button, TextField, Switch, Pill, BottomSheet...)
src/components/patient/  Patient app pieces (TabBar, ScreenHeader, TimelineItem, MedicationCard...)
src/components/portal/   Clinician portal pieces (PortalHeader, PortalSidebar, LiveBanner, SessionNotesPanel...)
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
- Portal screens: `src/app/view/...`, wrapped in `PortalShell`.
- A component used by one screen only lives next to it in `_components/`. Move it to `src/components/` once a second screen needs it.
- The routes and Figma frames are in PLAN.md section 6. Every new screen and every new string goes in `docs/REVIEW.md`.

## Patient app (Phases 3 and 4)

- Signed-in routes live in `src/app/(patient)/`; sign-up steps 3 to 7 in `src/app/signup/(account)/`. Both layouts wrap `PatientSessionGate` (`src/components/patient/PatientSession.tsx`) in `<Suspense>`. The gate checks the session in the browser and redirects (signed out to `/`, unfinished sign-up to its step by `profiles.onboarding_step`). Every page there exports a wrapper that renders its screen inside `<SessionReady>`, and reads the user with `usePatientSession()` (`userId`, `email`, `profile`, `setProfile`, `reloadProfile`).
- Screens frame themselves with `TabScreen` (the five tabs) or `SubScreen` (details and forms) from `(patient)/_components/Screens.tsx`. Both render `LiveBannerSlot`, the seam for the live share banner.
- Data: the browser Supabase client, loaded with `useLoad()` (`src/lib/useLoad.ts`). Dates and "today" are Irish time: use `src/lib/dates.ts`.
- Next.js keeps earlier screens in the page, hidden. Element ids must be unique per screen instance (forms use `useId()`), and tests should prefer `getByRole` (it skips hidden elements) or add `.filter({ visible: true })`.
- Tests: `tests/e2e/patient.spec.ts` signs in once per project with "Try the demo" and reuses the session (anonymous sign-ins are capped); `helpers/patient.ts` gives a Node Supabase client as that user for `seed_demo_record()` resets. Run with `E2E_PORT=3000` while your dev server is on 3000.

## Shells

```tsx
<PatientShell
  banner={live && <LiveShareBanner clinicianName="Dr Hennessy" timeLeft="24:12" />}
  header={<ScreenHeader title="Record" />}
  tabBar={<TabBar />}            // only on the five main screens
  footer={<Button fullWidth size="lg">Continue</Button>}  // sticky bottom action (sign-up)
>
  ...screen content (rendered inside <main id="main">)...
</PatientShell>
```

Full width up to 480px, a centred 430px column above. No fake iOS status bar. `tone="indigo"` for the full-bleed indigo screens (p-active, p-paused).

`PortalShell` takes `header`, `sidebar`, `notes`, `footer`, children. From 1024px: 256px sidebar, fluid record, 330px notes, both side columns sticky. Below 1024px it stacks and the sidebar becomes a row of section tabs. Without `sidebar`/`notes` (name and code steps) it is one column; `tone="indigo"` for c-code's background. It renders the "Skip to the record" link.

## Supabase

- Client Components: `import { createClient } from "@/lib/supabase/client"`. Runs as the signed-in user under RLS.
- Server Components, Server Actions, Route Handlers: `const supabase = await createClient()` from `@/lib/supabase/server`. Create one per request.
- To check who is signed in on the server use `supabase.auth.getClaims()`, never `getSession()`.
- Cache Components is on: anything that reads cookies (the server client does) must render inside `<Suspense>`, and must not be awaited at the top of a layout. See `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.
- The portal's browser never talks to Supabase. Portal route handlers call the `portal_*` functions through the server client with `portalServerSecret()` (from `@/lib/server-env`) as the first argument.
- `src/proxy.ts` only refreshes sessions; it redirects nobody. Protect pages in the pages/layouts. It skips `/kit`, `/view` and `/api/portal`.
- When the generated database types land, pass them as the client generic (`createBrowserClient<Database>`).

## Styling conventions

- Tailwind v4, tokens in `src/app/globals.css`. Names mirror the Figma variables: `Text/Tertiary` is `--text-tertiary` and the utility `text-text-tertiary`; `Surface/Card` is `bg-surface-card`; radii `rounded-card`, `rounded-pill`; shadows `shadow-sm`, `shadow-card`. Tailwind's default colours, radii and shadows are switched off, so only Trace tokens exist. No raw hex in components (one-off rgba tints copied from Figma are the exception; comment them).
- Type: `text-h3 font-medium`, `text-body-sm`, `text-label font-medium uppercase` and so on (sizes, line heights and tracking come with the token; add the weight). Sora display text adds `font-display font-light`.
- Spacing is Tailwind's 4px scale: Figma 8/12/16/24/32/48 are `2/3/4/6/8/12`.
- Text colour rules: `text-text-primary` for main text, `text-text-tertiary` for anything secondary that carries meaning. `text-text-secondary` (#8A94A3, 3:1) is for decoration only. Indigo text is `text-indigo-text` (#4258CB), never `text-brand-indigo` (#5B7AE8 fails AA). Filled buttons use `bg-interactive-primary` (Indigo/Accessible).
- Field outlines and switch tracks use `border-border-control`, not `border-border-default` (3:1 non-text contrast).
- Interaction states: use the `hovered:` and `pressed:` variants (defined in globals.css), not `hover:`/`active:`. They also respond to `data-force="hover"` / `"press"` / `"focus"`, which is how /kit pins states.
- Focus: a global 2px `:focus-visible` outline. Inside a dark surface add the `on-dark` class so the ring turns white. Do not remove outlines.
- Small controls keep their Figma size but get a 44px tap target with the `hit-area` utility.
- `cn()` in `@/lib/cn` only joins classes; it does not merge. Pass `className` for layout (margin, width, grid), not to restyle a component. If a component needs a new look, add a prop.
- Icons: `lucide-react`, decorative (`aria-hidden="true"`) next to text, otherwise inside an `IconButton` with a `label`.
- Copy: short, plain, no em dashes, in the voice of the existing screens. Use corrected values from PLAN.md section 11, never the Figma mistakes.

## Accessibility (PLAN.md section 10, WCAG 2.2 AA)

- Every field has a visible label (`label` prop). Errors are words, passed as `error`; they are tied to the field with `aria-describedby`.
- Status is never colour alone: pills, the LIVE marker and the critical strip carry words.
- Timers: never put a ticking countdown in a live region. Announce session start, 5 minutes left, 1 minute left and ended in a polite region (`formatCountdownSpoken` helps).
- `BottomSheet` is a modal `<dialog>`; focus moves in, Tab wraps inside, and focus returns to the opener on close.
- Every new screen gets a Playwright test that runs `expectNoAxeViolations(page)`. The /kit test is in `tests/e2e/kit.spec.ts`.
- Record every contrast or design substitution in `docs/REVIEW.md`.

## Git

Work on `claude/charming-goodall-sivzpd`. Commit at each working checkpoint with a clear message; never push or open a pull request (the supervising session does). Keep the tree clean between steps.
