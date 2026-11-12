import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { APP_PORT, LOCAL_EMAIL_CODE, LOCAL_ENV, LOCAL_JWT_SECRET, SUPABASE_PORT, SUPABASE_URL } from "./tests/support/local-env";

/**
 * End-to-end tests, two modes.
 *
 * `npm run test:e2e` (local, the default): everything except the live smoke,
 * against a local stand-in for Supabase (tests/support/local-supabase/:
 * PGlite running every migration, plus the Auth, PostgREST and Realtime calls
 * the app makes) and a production build of the app pointed at it
 * (`next build` into .next-e2e, then `next start` on 3100). No network, no
 * sign-in cap, the portal's server secret is a local one. `.env.local` is
 * never read: every variable the app needs is set here, and
 * __NEXT_PROCESSED_ENV tells Next.js not to load env files. E2E_SKIP_BUILD=1
 * reuses the last e2e build (after changing only tests).
 *
 * `npm run test:e2e:live` (E2E_LIVE=1): only tests/e2e/live-smoke.spec.ts,
 * against the real project with `.env.local`, through `next dev` on 3200.
 *
 * In this container Chromium is preinstalled at /opt/pw-browsers/chromium;
 * do not run `playwright install`. Elsewhere Playwright's own browser is used.
 */
const LIVE = process.env.E2E_LIVE === "1";
const LIVE_PORT = 3200;
const preinstalled = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined);
const launchOptions = executablePath ? { executablePath } : {};

/** The app's environment in local mode: the stand-in's values, nothing from .env files. */
const appEnv = {
  ...LOCAL_ENV,
  TRACE_E2E: "1",
  __NEXT_PROCESSED_ENV: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: LIVE ? "live-smoke.spec.ts" : "*.spec.ts",
  testIgnore: LIVE ? [] : ["live-smoke.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: LIVE ? 90_000 : 60_000,
  use: {
    baseURL: `http://localhost:${LIVE ? LIVE_PORT : APP_PORT}`,
    trace: "off",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, launchOptions },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions },
    },
  ],
  webServer: LIVE
    ? {
        command: `npx next dev -p ${LIVE_PORT}`,
        url: `http://localhost:${LIVE_PORT}/`,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : [
        {
          command: "node tests/support/local-supabase/server.ts",
          url: `${SUPABASE_URL}/__test/health`,
          env: {
            E2E_SUPABASE_PORT: String(SUPABASE_PORT),
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            PORTAL_SERVER_SECRET: LOCAL_ENV.PORTAL_SERVER_SECRET,
            LOCAL_JWT_SECRET,
            LOCAL_EMAIL_CODE,
          },
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          timeout: 60_000,
        },
        {
          command: process.env.E2E_SKIP_BUILD
            ? `npx next start -p ${APP_PORT}`
            : `npx next build && npx next start -p ${APP_PORT}`,
          url: `http://localhost:${APP_PORT}/kit`,
          env: appEnv,
          reuseExistingServer: !process.env.CI,
          timeout: 600_000,
        },
      ],
});
