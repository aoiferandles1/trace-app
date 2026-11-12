/**
 * The values the end-to-end tests run with: a local stand-in for Supabase
 * (tests/support/local-supabase/) and the app built against it. None of
 * these is a real secret; they exist only on this machine while the tests
 * run. `.env.local` is never read in this mode (playwright.config.ts).
 */

export const APP_PORT = Number(process.env.E2E_PORT ?? 3100);
export const SUPABASE_PORT = Number(process.env.E2E_SUPABASE_PORT ?? 54329);
export const SUPABASE_URL = `http://127.0.0.1:${SUPABASE_PORT}`;

export const LOCAL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local-e2e-only",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${APP_PORT}`,
  PORTAL_SERVER_SECRET: "local-e2e-portal-secret-not-used-anywhere-else",
  CRON_SECRET: "local-e2e-cron-secret",
  IP_HASH_SALT: "local-e2e-ip-hash-salt",
} as const;

/** The stand-in signs its tokens with this (HS256). */
export const LOCAL_JWT_SECRET = "local-e2e-jwt-secret-at-least-32-characters-long";

/** Every emailed sign-in code is this one in the stand-in (no email is sent). */
export const LOCAL_EMAIL_CODE = "123456";
