import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "../../../src/lib/supabase/database.types";

/**
 * Helpers for the patient-app tests.
 *
 * Anonymous sign-ins are capped (30 an hour from this machine, shared with
 * the portal build), so each Playwright project signs in ONCE, through the
 * real "Try the demo" button, saves the browser session to a file, and every
 * test reuses it. Between tests the record is reset with seed_demo_record_v2(),
 * called from Node with that same session's access token. The user deletes
 * itself at the end (delete_my_account()).
 *
 * Never print the values read from .env.local or the session file.
 */

let envLoaded = false;
function env(name: string): string {
  if (!envLoaded) {
    const file = path.resolve(__dirname, "../../../.env.local");
    if (existsSync(file)) process.loadEnvFile(file);
    envLoaded = true;
  }
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export function statePath(projectName: string): string {
  const dir = path.resolve(__dirname, "../../../test-results/.auth");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `patient-${projectName}.json`);
}

/** Signs in through "Try the demo" and saves the session for the rest of the file. */
export async function signInDemo(browser: Browser, file: string, baseURL: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page.waitForURL("**/home", { timeout: 60_000 });
  await context.storageState({ path: file });
  await context.close();
}

/** The access token inside the saved @supabase/ssr cookie ("base64-" + base64url JSON, maybe chunked). */
function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(file, "utf8")) as { cookies: { name: string; value: string }[] };
  const parts = state.cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = parts.map((c) => c.value).join("");
  const json = Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8");
  return (JSON.parse(json) as { access_token: string }).access_token;
}

/** A Supabase client acting as the saved test user (row-level security applies). */
export function clientFor(file: string): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    global: { headers: { Authorization: `Bearer ${accessToken(file)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resets the test user's record to Jane Doe. */
export async function reseed(db: SupabaseClient<Database>) {
  const { error } = await db.rpc("seed_demo_record_v2");
  expect(error, error?.message).toBeNull();
}

/** Empties the test user's record: a brand-new account, signed up and finished. */
export async function emptyRecord(db: SupabaseClient<Database>) {
  const { data: user } = await db.auth.getUser();
  const uid = user.user!.id;
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

/** Deletes the test user. Safe to call when it is already gone. */
export async function deleteUser(file: string) {
  if (!existsSync(file)) return;
  try {
    await clientFor(file).rpc("delete_my_account");
  } catch {
    // Already deleted (the delete-account test does it through the UI).
  }
}

/** Fails if the page scrolls sideways. */
export async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}
