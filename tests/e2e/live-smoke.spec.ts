import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { sessionFromState } from "./helpers/patient";

/**
 * The pre-deploy contract check, against the REAL Supabase project:
 * `npm run test:e2e:live` (E2E_LIVE=1, see playwright.config.ts). Everything
 * else runs against the local stand-in; this proves the hosted project still
 * answers the app the way the stand-in does.
 *
 * One anonymous demo user (sign-ins are capped at about 30 an hour), as an
 * ordinary visitor would: "Try the demo" (seed_demo_record_v2), one save
 * through a form, and a share code. The user deletes itself at the end
 * (delete_my_account). Nothing here needs the portal's server secret.
 * Never print the values read from .env.local.
 */

test.describe.configure({ mode: "serial" });
test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Phone project only: one sign-in per run");

function liveClient(accessToken: string) {
  const file = path.resolve(__dirname, "../../.env.local");
  if (existsSync(file)) process.loadEnvFile(file);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and the publishable key must be in .env.local");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test("live: try the demo, save a condition, make a share code, delete the account", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page.waitForURL("**/home", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: /, Jane$/ })).toBeVisible({ timeout: 20_000 });
  const db = liveClient(sessionFromState(await context.storageState()).access_token);

  try {
    // The seed is the one the hosted project has (old or new demo story): read it, do not assume it.
    const { data: meds, error: medsError } = await db.rpc("my_record", { section: "medications" });
    expect(medsError).toBeNull();
    expect((meds as { data: { current: { name: string }[] } }).data.current.map((m) => m.name)).toContain("Concerta");

    // One save through a form.
    await page.goto("/record/conditions/new");
    await expect(page.getByRole("heading", { level: 1, name: "Add a condition" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("textbox", { name: "Condition" }).fill("Live smoke check");
    await page.getByRole("button", { name: "Save condition" }).click();
    await expect(page.getByRole("tabpanel").getByText("Live smoke check")).toBeVisible({ timeout: 20_000 });
    const { data: saved } = await db.from("conditions").select("name").eq("name", "Live smoke check");
    expect(saved).toHaveLength(1);

    // A share code, from Profile.
    await page.goto("/profile");
    await page.getByRole("link", { name: "Share your record" }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: "Create share code" }).click();
    await page.waitForURL(/\/share\/code$/);
    await expect(page.getByText(/^Your code: \d \d \d \d$/)).toBeVisible({ timeout: 15_000 });
    const { data: share } = await db.rpc("my_share_session");
    expect(share).toMatchObject({ status: "code_issued", share_insurance: false });
    expect((await db.rpc("end_session")).error).toBeNull();
  } finally {
    await db.rpc("delete_my_account");
  }
});
