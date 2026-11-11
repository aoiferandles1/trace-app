# Trace

A health record you own and share with a doctor only when you say so. You make a 4-digit code, the doctor types it into a web page, you see who is asking and tap Allow, and they read a scoped, read-only copy of your record with a timer running. Either side can end it, and the doctor's notes come back to your record.

Trace is a portfolio project by Aoife Randles (UX/UI design), not a medical service. The design and research are written up at [aoiferandles.com/trace](https://aoiferandles.com/trace/).

## Live

| Address | What it is |
|---|---|
| https://trace-app-liard-eta.vercel.app | The patient app (phone first). Sign in with an invited email, or tap "Try the demo" for a private copy of Jane Doe's sample record. |
| https://trace-app-liard-eta.vercel.app/view | The doctor's portal. No account: the doctor types their name and practice, then the patient's code. |
| https://trace-app-liard-eta.vercel.app/demo | Both sides on one screen: the patient app in a phone frame and the portal in a laptop frame. |

## What it does

- **Patient app** (redesigned, November 2026): sign up (invite only) or try the demo; Home, Record (timeline, conditions, family), the full timeline, visit detail, medications with each one's strength history, the family tree, insurance (a stand-in provider sign-in), documents (PDF, JPEG or PNG), care team, profile; the Add sheet; share from the appointment-day card on Home or from "Share my record" on Profile; approve or deny each request; watch and end a live session; share history; export and delete. From 1024px wide it has a white rail and two panes.
- **Doctor's portal:** name step, code entry, waiting, then the shared record with a rail built from what the patient shared (overview, recent visits, medications, full timeline, care team, family history, documents, mental health), a countdown, and a resizable notes panel whose notes go back to the patient's record when the session ends.
- **Rules that hold:** nothing opens until the patient taps Allow; critical safety information and medications are always shared; personal notes never are; insurance is never shared; mental health, documents and family history stay out unless switched on for that share; a patient's notes on a medication's strengths reach the doctor only when the share includes Medication notes and the patient shared that note. The database enforces all of this; the portal never talks to it directly and never fetches a section that was not shared.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres with row-level security, Auth, Realtime) through `@supabase/ssr`, Playwright with axe for end-to-end and accessibility tests. Hosted on Vercel; the database is in Supabase's Ireland region.

## Run it

```bash
cp .env.example .env.local   # then fill in the six values (never commit them)
npm install
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server. `/kit` shows every UI component in every state (development only). |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types and TypeScript |
| `npm run test:e2e` | The Playwright suite, with axe on every screen. Starts `next dev` on port 3100 unless something is already running there (`E2E_PORT=3000` to use your own dev server). |

About the tests:

- They run against the real Supabase project, as demo (anonymous) users they create and delete themselves. Supabase allows about 30 anonymous sign-ins an hour from one address, so run single files while working (`npx playwright test tests/e2e/share-loop.spec.ts`) and the whole suite occasionally. If sign-ins start failing with a rate-limit error, wait.
- Database rules have their own SQL tests in `supabase/tests/` (each runs in a transaction that rolls back); see `supabase/README.md`.
- No test sends email or calls the daily cleanup with the real secret.
- Two opt-in specs write the redesign's screenshots: `E2E_SCREENS=1 npx playwright test tests/e2e/patient-screens.spec.ts tests/e2e/portal-screens.spec.ts` (390 x 844 and 1280 x 800, into `docs/redesign/screens/after/`; one demo sign-in each).

## Operations

All of these are done in the Supabase dashboard (project `trace`) or the Vercel dashboard. Never put an email address, key or health data in this repository.

**Invite someone.** Trace is invite-only. In Supabase, open the SQL editor and run:

```sql
insert into private.allowed_emails (email) values (lower('their@email.address'));
```

They can then use "Create your record". Supabase's built-in email only reaches members of the Supabase organisation and is heavily rate limited; before inviting anyone else, set up custom SMTP in Supabase (Authentication, Emails). To remove an invite: `delete from private.allowed_emails where email = lower('their@email.address');` (their account, if made, stays until they delete it).

**The daily cleanup.** Vercel runs `GET /api/cron/cleanup` once a day (04:17 UTC, set in `vercel.json`), signed with `CRON_SECRET`. It deletes demo users older than 24 hours with everything they own, old code-guess records and stale portal sessions. Real accounts are never touched. It also keeps the free Supabase project from pausing for inactivity. If it fails, Vercel shows it under the project's Cron Jobs and logs.

**If the Supabase project pauses.** Free projects pause after about a week with no activity (the daily cleanup normally prevents this). The app and the demo then show connection errors on every screen. In the Supabase dashboard, open the project and choose Restore; it takes a few minutes, and nothing is lost. Then check the cron job is still running in Vercel.

**Environment variables** (in Vercel and in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the address shown on the code screen), and the server-only `PORTAL_SERVER_SECRET`, `CRON_SECRET` and `IP_HASH_SALT`. There is no Supabase secret key anywhere. Rotating the portal secret is in `supabase/README.md`, section 9.

**Anonymous sign-ins** must stay switched on in Supabase (Authentication, Sign In / Providers) for the demo to work. If they are off, "Try the demo" says the demo is switched off.

## Docs

- `docs/REVIEW.md`: everything waiting for the designer's review: differences from Figma and the redesign's boards, new screens, new copy, reworded claims, what was left out and the open questions.
- `docs/redesign/`: the redesign brief, the supervisor's notes, the approved boards, the final report (`REPORT.md`) and before and after screenshots.
- `PLAN.md`: the build plan and the decisions behind it.
- `CLAUDE.md`: conventions for anyone (or any agent) working on the code.
- `supabase/README.md`: the database contract: tables, functions, errors and operations.
