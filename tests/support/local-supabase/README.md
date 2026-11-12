# Local stand-in for Supabase (tests only)

The end-to-end tests (`npm run test:e2e`) and the database tests (`npm run test:db`) run against this, not the hosted project. Nothing in `src/` imports it.

- **Database** (`db.ts`): [PGlite](https://pglite.dev) 0.3.16, Postgres 17.5 compiled to WebAssembly, in memory. `bootstrap.sql` recreates the parts of Supabase the migrations expect (roles `anon`, `authenticated`, `service_role`; Supabase's default grants on `public`; `extensions.pgcrypto`; `auth.users` with GoTrue's columns; `auth.uid()`, `auth.role()`, `auth.email()`, `auth.jwt()` reading `request.jwt.claims`; the `supabase_realtime` publication). Then every file in `supabase/migrations/` runs in order, unchanged, each in one transaction. About 1.3 s from nothing.
- **HTTP** (`server.ts`, port 54329, 127.0.0.1 only):
  - `/rest/v1` (`rest.ts`): the PostgREST subset `src/` uses. Every request is one transaction as the caller's role with `request.jwt.claims` set, so grants, RLS and `auth.uid()` decide as on the hosted project. JSON comes from Postgres (`json_agg`, `to_json`). Errors in PostgREST's shape and status codes. Unsupported shapes fail loudly (`PGRST100`), so a new kind of query shows up in a test.
  - `/auth/v1` (`auth.ts`): anonymous sign-up (no cap), email codes (nothing is sent; the code is always `123456`, `LOCAL_EMAIL_CODE`), verify, refresh, get and update user, logout. HS256 tokens, so `getClaims()` checks them with `GET /user`. GoTrue's error codes for the cases the app reads (`otp_disabled`, "Database error saving new user").
  - `/realtime/v1/websocket` (`realtime.ts`): Phoenix protocol, `postgres_changes` on every table in `supabase_realtime` (a trigger the stand-in adds, delivered only to subscribers whose role can select the row).
  - `/__test/health` and `POST /__test/sql` (`tests/e2e/helpers/sql.ts`): SQL as the database owner, for what a test cannot wait for (a share's expiry).
- **Settings**: `tests/support/local-env.ts` (ports, a publishable key, a local portal server secret whose SHA-256 is stored as `supabase/README.md` section 9 describes, cron secret, IP salt, JWT secret). None is a real secret.

## Adding to it

- **A new table or function**: nothing to do. Write the migration; the stand-in runs it. Commit the migration before running the tests.
- **A new query shape** (an embedded select, `or=`, an upsert, a `GET` rpc): add it to `rest.ts`, matching PostgREST's behaviour, and say so in its header comment.
- **Something else from Supabase that a migration needs** (a schema, a role, an extension): add it to `bootstrap.sql`. Never edit an applied migration for the stand-in. PGlite's extensions are in `@electric-sql/pglite/contrib/*`; load one in `db.ts`.
- **A new Auth call**: add it to `auth.ts`, with GoTrue's response and error shapes.

## Known differences from the hosted project

- No rate limits, no email, no storage API (the app has none), no `service_role` key.
- Access tokens are HS256 (the hosted project's key type may differ); `getClaims()` takes the `GET /user` path.
- Refresh tokens live in memory; the database starts empty on every start (reuse a running stand-in with Playwright's `reuseExistingServer` outside CI).
- One connection: requests take turns (fast enough for the suite).
- Realtime sends the full old row on UPDATE (the hosted project, without `REPLICA IDENTITY FULL`, sends the key only); the app reads only the new row.
