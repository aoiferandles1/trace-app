import { createChunks, DEFAULT_COOKIE_OPTIONS, stringToBase64URL } from "@supabase/ssr";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { test as base, expect, type Page } from "@playwright/test";
import type { Database } from "../../../src/lib/supabase/database.types";
import { LOCAL_ENV, SUPABASE_URL } from "../../support/local-env";

/**
 * Helpers for the patient-app tests, against the local stand-in for Supabase
 * (tests/support/local-supabase/), which has no sign-in cap. So every test
 * gets its own anonymous demo user, seeded with Jane Doe
 * (seed_demo_record_v2()), and the browser starts signed in as that user:
 * the same cookie @supabase/ssr writes after "Try the demo". Tests in a file
 * run in parallel and never share a record. (auth.spec.ts presses the real
 * "Try the demo" button.)
 *
 *   import { test, expect } from "./helpers/patient";
 *   test("...", async ({ page, demo }) => { ... demo.db.rpc(...) ... });
 */

export type DemoUser = {
  userId: string;
  session: Session;
  /** A Supabase client acting as this user (row-level security applies). */
  db: SupabaseClient<Database>;
  /** A Playwright storage state signed in as this user. */
  storageState: { cookies: Cookie[]; origins: [] };
  /** The id of today's 9:30 GP visit (the seed's appointment). */
  appointmentEntryId: string;
};

type Cookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
};

/** The cookie(s) @supabase/ssr keeps the session in: `sb-<ref>-auth-token`, "base64-" + base64url JSON, chunked. */
export function sessionCookies(session: Session): Cookie[] {
  const key = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  const appHost = new URL(LOCAL_ENV.NEXT_PUBLIC_SITE_URL).hostname;
  return createChunks(key, value).map((c) => ({
    name: c.name,
    value: c.value,
    domain: appHost,
    path: DEFAULT_COOKIE_OPTIONS.path ?? "/",
    expires: Math.floor(Date.now() / 1000) + 24 * 3600,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }));
}

/** The session inside a storage state's @supabase/ssr cookie (as left by "Try the demo"). */
export function sessionFromState(state: { cookies: { name: string; value: string }[] }): Session {
  const parts = state.cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  if (!parts.length) throw new Error("No Supabase session cookie in this storage state");
  const raw = parts.map((c) => c.value).join("");
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8")) as Session;
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(LOCAL_ENV.NEXT_PUBLIC_SUPABASE_URL, LOCAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A Supabase client acting as the user of `session`. */
export function clientAs(session: Session): SupabaseClient<Database> {
  return createClient<Database>(LOCAL_ENV.NEXT_PUBLIC_SUPABASE_URL, LOCAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A new anonymous demo user with Jane Doe's record, as "Try the demo" makes one. */
export async function newDemoUser(): Promise<DemoUser> {
  const { data, error } = await anonClient().auth.signInAnonymously();
  if (error || !data.session || !data.user) throw new Error(`signInAnonymously failed: ${error?.message}`);
  const db = clientAs(data.session);
  const seed = await db.rpc("seed_demo_record_v2");
  if (seed.error) throw new Error(`seed_demo_record_v2 failed: ${seed.error.message}`);
  return {
    userId: data.user.id,
    session: data.session,
    db,
    storageState: { cookies: sessionCookies(data.session), origins: [] },
    appointmentEntryId: (seed.data as { appointment_entry_id: string }).appointment_entry_id,
  };
}

/** Playwright's test with `demo`: a fresh seeded demo user per test, and the page signed in as it. */
export const test = base.extend<{ demo: DemoUser }>({
  demo: async ({}, provide) => {
    await provide(await newDemoUser());
  },
  storageState: async ({ demo }, provide) => {
    await provide(demo.storageState);
  },
});
export { expect };

/** Resets the user's record to Jane Doe ("Reset demo"). */
export async function reseed(db: SupabaseClient<Database>) {
  const { error } = await db.rpc("seed_demo_record_v2");
  expect(error, error?.message).toBeNull();
}

/** Empties the user's record: a brand-new account, signed up and finished. */
export async function emptyRecord({ db, userId: uid }: Pick<DemoUser, "db" | "userId">) {
  for (const table of [
    "entries",
    "medications",
    "conditions",
    "care_team",
    "vitals",
    "health_events",
    "relatives",
    "documents",
    "insurance_connections",
  ] as const) {
    const { error } = await db.from(table).delete().eq("user_id", uid);
    expect(error, error?.message).toBeNull();
  }
  const { error } = await db
    .from("profiles")
    .update({ allergies: [], implants: [], blood_type: null })
    .eq("id", uid);
  expect(error, error?.message).toBeNull();
}

/** Fails if the page scrolls sideways. */
export async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}
