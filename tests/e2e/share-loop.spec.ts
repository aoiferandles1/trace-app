import { expect, test, type Page, type Route } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { clientFor, deleteUser, expectNoSideScroll, reseed, signInDemo, statePath } from "./helpers/patient";
import { DOCTOR, newDoctor, submitCode } from "../helpers/doctor";

/**
 * The share loop with BOTH sides in real browsers (PLAN.md section 12): the
 * patient app at phone size, and the doctor's portal in a second browser
 * context. Runs once, in the desktop project.
 *
 * One demo patient for the file (anonymous sign-ins are capped at 30 an hour
 * for this machine), signed in through "Try the demo" and reused; the record
 * is reset with seed_demo_record() before each test. Each doctor is a fresh
 * context, so a fresh portal token and a made-up IP (tests/helpers/doctor.ts).
 *
 * Time's up cannot be reached against the real database (the shortest share
 * is 30 minutes and tests cannot move its clock), so that screen is tested
 * with stand-in session data at the end of this file.
 */

test.describe.configure({ mode: "serial" });

const PHONE = { width: 390, height: 844 };
let file = "";

test.beforeAll(async ({ browser }, info) => {
  if ((info.project.use.viewport?.width ?? 0) < 1024) return;
  file = statePath(`share-${info.project.name}`);
  await signInDemo(browser, file, info.project.use.baseURL!);
});

test.afterAll(async () => {
  if (file) await deleteUser(file);
});

test.use({ viewport: PHONE, storageState: async ({}, provide) => provide(file || undefined!) });

test.beforeEach(async ({}, info) => {
  // Once, in the desktop project (the patient pages are drawn at phone size by test.use).
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "Runs once, in the desktop project");
  await reseed(clientFor(file));
});

async function home(page: Page) {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /, Jane$/ })).toBeVisible({ timeout: 20_000 });
}

/** The code on /share/code, read from its screen reader text. */
async function readCode(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { name: "Your code is ready." })).toBeVisible();
  const text = await page.getByText(/^Your code: \d \d \d \d$/).textContent();
  return text!.replace(/\D/g, "");
}

/** From whatever screen is open: generate a code with the defaults and return it. */
async function generateFrom(page: Page, entry: "card" | "profile"): Promise<string> {
  if (entry === "card") {
    await home(page);
    await page.getByRole("link", { name: "Share your record now" }).click();
  } else {
    await page.goto("/profile");
    await page.getByRole("link", { name: "Share my record" }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "Share Record" })).toBeVisible();
  await page.getByRole("button", { name: "Generate share code" }).click();
  await page.waitForURL(/\/share\/code$/);
  return readCode(page);
}

test("happy path: the appointment-day card to notes on the timeline and in the access log", async ({ page, browser }) => {
  // p-apptday: today's seeded 9:30 GP visit drives the card.
  await home(page);
  await expect(page.getByText(/^Today · 9:30am$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "GP visit · Dr Hennessy" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Upcoming/ })).toHaveCount(0);
  await expect(page.getByText("Demo · sample data").first()).toBeVisible();
  await expectNoAxeViolations(page);

  // p-prefs, with the GP visit defaults.
  await page.getByRole("link", { name: "Share your record now" }).click();
  await expect(page).toHaveURL(/\/share\?appointment=/);
  await expect(page.getByRole("heading", { name: "Confirm preferences" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Active conditions" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: "Full timeline" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "Mental health history" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("radio", { name: /30 min/ })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Documents" })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Insurance" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
  await page.getByRole("button", { name: "Generate share code" }).click();

  // p-code.
  await page.waitForURL(/\/share\/code$/);
  const code = await readCode(page);
  await expect(page.getByText(/^Show this to your doctor to enter it at .+\/view$/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Sharing preferences" }).getByText("3 active")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // The doctor, in a second browser.
  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  await expect(doctor.page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();

  // p-request over the code screen: who, how long, exactly what.
  const sheet = page.getByRole("dialog", { name: "Dr Hennessy wants access" });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByText("GP · Rathmines Medical Centre")).toBeVisible();
  await expect(sheet.getByText("30 min")).toBeVisible();
  await expect(sheet.getByText("Sharing your GP visit profile for this appointment.")).toBeVisible();
  for (const item of ["Critical safety", "Medications", "Active conditions", "Recent visits (last 3)", "Care team", "Can add session notes to your record"]) {
    await expect(sheet.getByRole("listitem").filter({ hasText: item })).toBeVisible();
  }
  await expect(sheet.getByText("Full timeline, documents, insurance and mental health not included")).toBeVisible();
  // Focus is inside the sheet, on the request, not on Allow.
  await expect(sheet.locator("#access-request-body")).toBeFocused();
  await page.waitForTimeout(300); // the sheet slides up; let it settle before axe measures
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Allow access" }).click();

  // p-active.
  await page.waitForURL(/\/session$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible();
  await expect(page.getByText("Rathmines Medical Centre · GP visit")).toBeVisible();
  await expect(page.getByRole("region", { name: "Dr Hennessy can see" }).getByText("3 diagnoses")).toBeVisible();
  await expect(page.getByText(/^Access ends automatically at \d{1,2}:\d{2}(am|pm)$/)).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // The portal opens the record.
  await expect(doctor.page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 15_000 });

  // p-home-live: the banner and the Sharing in progress card.
  await page.getByRole("link", { name: "Minimise. Back to Home" }).click();
  await expect(page.getByRole("link", { name: /Sharing in progress.*Dr Hennessy · GP visit/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Dr Hennessy can see your record.*View session/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Share your record now" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  // The banner is on other screens too, and Profile hides "Share my record".
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /Dr Hennessy can see your record/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Access log" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Share my record" })).toHaveCount(0);

  // The doctor writes notes and ends; the patient's /session moves on by itself.
  await page.getByRole("link", { name: /Dr Hennessy can see your record/ }).click();
  await page.waitForURL(/\/session$/);
  await doctor.page.getByLabel("Chief complaint").fill("Ongoing fatigue over the past 6 weeks");
  await doctor.page.getByLabel("Plan").fill("Repeat INR in 2 weeks");
  await expect(doctor.page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible({ timeout: 8_000 });
  await doctor.page.getByRole("region", { name: "Live session" }).getByRole("button", { name: "End session" }).click();
  await expect(doctor.page.getByRole("heading", { level: 1, name: "End session with Jane Doe" })).toBeVisible();
  await doctor.page.getByRole("main").getByRole("button", { name: "End session" }).click();
  await expect(doctor.page.getByRole("heading", { name: "You ended the session." })).toBeVisible();

  // p-ended.
  await page.waitForURL(/\/session\/ended\?id=/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Session ended" })).toBeVisible();
  await expect(page.getByText("Dr Hennessy ended the session and no longer has access to your record.")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Dr Hennessy · GP" })).toBeVisible();
  await expectNoAxeViolations(page);

  // Session notes, from the ended screen.
  await page.getByRole("link", { name: "View session notes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Session notes" })).toBeVisible();
  await expect(page.getByText("Ongoing fatigue over the past 6 weeks").filter({ visible: true })).toBeVisible();

  // On the timeline.
  await page.goto("/record");
  await expect(page.getByRole("link", { name: /Session notes/ })).toBeVisible({ timeout: 20_000 });

  // Home is back to normal: that visit's share has ended.
  await home(page);
  await expect(page.getByRole("link", { name: "Share your record now" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Upcoming.*INR blood test/ })).toBeVisible();

  // The access log.
  await page.goto("/access-log");
  const entry = page.getByRole("article", { name: /Dr Hennessy · GP/ }).first();
  await expect(entry).toBeVisible({ timeout: 20_000 });
  await expect(entry.getByText("Ended", { exact: true })).toBeVisible();
  for (const line of ["You made a share code", "Dr Hennessy typed the code and asked for access", "You allowed access", "Viewed the overview", "Session notes added to your record", "Dr Hennessy ended the session"]) {
    await expect(entry.getByText(line)).toBeVisible();
  }
  await expectNoAxeViolations(page);
  await doctor.context.close();
});

test("deny, with the request arriving over another screen", async ({ page, browser }) => {
  const db = clientFor(file);
  const { data: share, error } = await db.rpc("create_share_code", {});
  expect(error).toBeNull();
  const code = (share as { code: string }).code;

  // The patient is reading their medications, not the code screen.
  await page.goto("/meds");
  await expect(page.getByRole("heading", { level: 1, name: "My medication" })).toBeVisible({ timeout: 20_000 });

  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  const sheet = page.getByRole("dialog", { name: "Dr Hennessy wants access" });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  // Started without an appointment: the stand-in line.
  await expect(sheet.getByText("Sharing your GP visit profile. This share is not linked to an appointment.")).toBeVisible();
  // A real modal: the page behind is inert while the sheet is open.
  expect(await sheet.evaluate((d) => d.matches(":modal"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Deny", exact: true }).click();
  await page.waitForURL(/\/home$/);
  await expect(sheet).toBeHidden();
  await expect(doctor.page.getByRole("heading", { name: "Your patient chose not to share their record." })).toBeVisible({ timeout: 8_000 });
  expect(await (await doctor.page.request.get("/api/portal/record?section=overview")).json()).toEqual({ record: null });
  await doctor.context.close();
});

test("the patient ends early: the portal closes within seconds", async ({ page, browser }) => {
  const code = await generateFrom(page, "card");
  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  await page.getByRole("dialog", { name: "Dr Hennessy wants access" }).getByRole("button", { name: "Allow access" }).click();
  await expect(doctor.page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "End sharing now" }).click();
  const endedAt = Date.now();
  await page.waitForURL(/\/session\/ended\?id=/);
  await expect(page.getByText("Dr Hennessy no longer has access to your record.")).toBeVisible();
  await expect(doctor.page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 6_000 });
  expect(Date.now() - endedAt).toBeLessThan(6_000);
  await expect(doctor.page.getByText("Penicillin")).toHaveCount(0);
  expect(await (await doctor.page.request.get("/api/portal/record?section=overview")).json()).toEqual({ record: null });
  await doctor.context.close();
});

test("the patient ends after the doctor's notes autosaved: the ended screen and the access log agree", async ({ page, browser }) => {
  // Ending writes the session row twice in one transaction (ended, then the
  // notes entry's id), and both realtime updates carry the same updated_at.
  // Hold back the first one so it lands last, as it did in a live run: the
  // ended screen must still find the notes.
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      const text = typeof m === "string" ? m : m.toString();
      if (/"status": ?"ended"/.test(text) && /"notes_entry_id": ?null/.test(text)) setTimeout(() => ws.send(m), 1_500);
      else ws.send(m);
    });
  });
  const code = await generateFrom(page, "card");
  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  await page.getByRole("dialog", { name: "Dr Hennessy wants access" }).getByRole("button", { name: "Allow access" }).click();
  await expect(doctor.page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 15_000 });

  // The doctor types; the draft autosaves. The patient has not left /session.
  await doctor.page.getByLabel("Chief complaint").fill("Tired for six weeks");
  await expect(doctor.page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(1_500); // the autosave's realtime update reaches the phone first

  await page.getByRole("button", { name: "End sharing now" }).click();
  await page.waitForURL(/\/session\/ended\?id=/);
  // The end writes the notes in the same transaction: the screen must say so, and keep saying so.
  const notesRow = page.getByRole("definition").filter({ has: page.getByRole("link", { name: "View session notes" }) });
  await expect(notesRow).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(page.getByText("None written")).toHaveCount(0);
  await expect(notesRow).toBeVisible();
  await expect(doctor.page.getByText("Your session notes were saved to the patient's record.")).toBeVisible({ timeout: 8_000 });

  // A reload reads the same thing.
  await page.reload();
  await expect(page.getByRole("link", { name: "View session notes" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "View session notes" }).click();
  await expect(page.getByText("Tired for six weeks").filter({ visible: true })).toBeVisible();
  await doctor.context.close();
});

test("share from Profile on a day with no appointment", async ({ page, browser }) => {
  // Remove today's visit: no appointment today.
  const db = clientFor(file);
  const { data: visits } = await db.from("entries").select("id, occurs_at").eq("kind", "visit");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
  const todays = (visits ?? []).filter(
    (v) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(v.occurs_at)) === today,
  );
  expect(todays.length).toBe(1);
  expect((await db.from("entries").delete().eq("id", todays[0].id)).error).toBeNull();

  await home(page);
  await expect(page.getByRole("link", { name: "Share your record now" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Upcoming.*INR blood test/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /share/i })).toHaveCount(0);

  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Share my record" })).toBeVisible({ timeout: 20_000 });
  await expectNoAxeViolations(page);
  const code = await generateFrom(page, "profile");

  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  const sheet = page.getByRole("dialog", { name: "Dr Hennessy wants access" });
  await expect(sheet.getByText("This share is not linked to an appointment.", { exact: false })).toBeVisible({ timeout: 10_000 });
  await sheet.getByRole("button", { name: "Allow access" }).click();
  await page.waitForURL(/\/session$/);
  await expect(doctor.page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "End sharing now" }).click();
  await page.waitForURL(/\/session\/ended\?id=/);
  await expect(doctor.page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 6_000 });
  await doctor.context.close();
});

test("regenerate replaces the code; the old one stops working", async ({ page, browser }) => {
  const first = await generateFrom(page, "card");
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByText(/^Your code: /)).not.toHaveText(`Your code: ${first.split("").join(" ")}`);
  const second = await readCode(page);
  expect(second).not.toBe(first);
  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, first);
  await expect(doctor.page.getByText(/Wrong code/)).toBeVisible();
  await doctor.context.close();
});

test("a second demo visitor gets a separate record", async ({ page, browser }, info) => {
  // A note only the first visitor has.
  const db = clientFor(file);
  const { error } = await db.from("entries").insert({ kind: "note", title: "Only in sandbox one", occurs_at: new Date().toISOString() });
  expect(error).toBeNull();

  // A brand-new visitor: an empty browser (contexts made in a test inherit test.use's storageState).
  const other = statePath(`share-second-${info.project.name}`);
  const fresh = await browser.newContext({ viewport: PHONE, storageState: { cookies: [], origins: [] } });
  const welcome = await fresh.newPage();
  await welcome.goto("/");
  await welcome.getByRole("button", { name: "Try the demo" }).click();
  await welcome.waitForURL("**/home", { timeout: 60_000 });
  await fresh.storageState({ path: other });
  await fresh.close();
  try {
    const ctx = await browser.newContext({ viewport: PHONE, storageState: other });
    const second = await ctx.newPage();
    await second.goto("/record");
    await expect(second.getByRole("heading", { level: 1, name: "Record" })).toBeVisible({ timeout: 20_000 });
    await expect(second.getByRole("link", { name: /Personal note added/ })).toBeVisible();
    await expect(second.getByText("Only in sandbox one")).toHaveCount(0);
    const me = (await db.auth.getUser()).data.user!.id;
    const them = (await clientFor(other).auth.getUser()).data.user!.id;
    expect(them).not.toBe(me);
    // Reading the first visitor's rows directly returns nothing.
    const { data: theirs } = await clientFor(other).from("entries").select("id").eq("user_id", me);
    expect(theirs).toEqual([]);
    await ctx.close();

    await page.goto("/record");
    await expect(page.getByRole("link", { name: /Only in sandbox one/ })).toBeVisible({ timeout: 20_000 });
  } finally {
    await deleteUser(other);
  }
});

test("reset demo puts Jane's record back", async ({ page }) => {
  const db = clientFor(file);
  await db.from("entries").insert({ kind: "note", title: "Remove me on reset", occurs_at: new Date().toISOString() });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Reset demo" }).click();
  const sheet = page.getByRole("dialog", { name: "Reset the demo?" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Reset demo" }).click();
  await page.waitForURL(/\/home$/);
  // Home must take taps: the confirm sheet must not stay open as a modal on the hidden Profile screen.
  expect(await page.evaluate(() => document.querySelectorAll("dialog[open]").length)).toBe(0);
  await page.getByRole("link", { name: "Record", exact: true }).click({ timeout: 5_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Record" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Personal note added/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Remove me on reset/ })).toHaveCount(0);
});

test("/demo runs the loop inside its two frames", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: file, extraHTTPHeaders: { "x-forwarded-for": "198.19.200.7" } });
  const page = await ctx.newPage();
  const res = await page.goto("/demo");
  // Only Trace may frame Trace.
  expect(res!.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(res!.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(res!.headers()["referrer-policy"]).toBe("no-referrer");
  expect(res!.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.getByRole("heading", { level: 1, name: "Try both sides of a GP visit" })).toBeVisible();
  await expectNoSideScroll(page);

  const phone = page.frameLocator('iframe[title="Patient app, on a phone"]');
  const laptop = page.frameLocator('iframe[title="Doctor\'s portal, on a laptop"]');

  // Already signed in as the demo patient: the phone opens Home.
  await phone.getByRole("link", { name: "Share your record now" }).click({ timeout: 30_000 });
  await phone.getByRole("button", { name: "Generate share code" }).click();
  const text = await phone.getByText(/^Your code: \d \d \d \d$/).textContent({ timeout: 15_000 });
  const code = text!.replace(/\D/g, "");

  // The portal's name step is pre-filled in the demo.
  await expect(laptop.getByLabel("Your name")).toHaveValue(DOCTOR.name, { timeout: 15_000 });
  await expect(laptop.getByLabel(/Practice/)).toHaveValue(DOCTOR.practice);
  await laptop.getByRole("button", { name: "Continue" }).click();
  await laptop.getByRole("textbox", { name: "Patient's share code" }).fill(code);
  await laptop.getByRole("button", { name: "Continue" }).click();

  await phone.getByRole("dialog", { name: "Dr Hennessy wants access" }).getByRole("button", { name: "Allow access" }).click({ timeout: 10_000 });
  await expect(laptop.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 15_000 });
  // The two frames did not disturb each other: the phone is still Jane's live session.
  await expect(phone.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible();
  await expectNoAxeViolations(page);

  await phone.getByRole("button", { name: "End sharing now" }).click();
  await expect(laptop.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 6_000 });

  // Narrower than 1100px: the phone alone, with the portal one tab away.
  await page.setViewportSize({ width: 900, height: 1000 });
  await expect(page.locator('iframe[title="Doctor\'s portal, on a laptop"]')).toHaveCount(0);
  const link = page.getByRole("link", { name: /Open the doctor's portal/ });
  await expect(link).toHaveAttribute("href", "/view?demo=1");
  await expect(link).toHaveAttribute("target", "_blank");
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  await ctx.close();
});

test("the cleanup cron refuses callers without the secret", async ({ request }) => {
  // Only the refusals are tested: a real call would delete every demo user
  // older than a day, which is the job itself, not something a test should do.
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup", { headers: { authorization: "Bearer not-the-secret" } })).status()).toBe(401);
});

/* ---------- Time's up and the timer announcements: stand-in session data ---------- */

function standIn(overrides: Record<string, unknown>) {
  const now = Date.now();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    patient_id: "00000000-0000-4000-8000-000000000002",
    status: "active",
    code: "4837",
    code_expires_at: new Date(now - 30 * 60_000).toISOString(),
    share_conditions: true,
    share_recent_visits: true,
    share_full_timeline: false,
    share_care_team: true,
    share_mental_health: false,
    allow_notes: true,
    duration_kind: "30m",
    appointment_entry_id: null,
    clinician_name: "Dr Hennessy",
    clinician_role: "GP",
    clinician_practice: "Rathmines Medical Centre",
    requested_at: new Date(now - 31 * 60_000).toISOString(),
    request_expires_at: new Date(now - 26 * 60_000).toISOString(),
    approved_at: new Date(now - 30 * 60_000).toISOString(),
    expires_at: new Date(now + 25 * 60_000).toISOString(),
    paused_at: null,
    ended_at: null,
    ended_by: null,
    chief_complaint: null,
    assessment: null,
    plan: null,
    follow_up: null,
    notes_updated_at: null,
    notes_entry_id: null,
    created_at: new Date(now - 32 * 60_000).toISOString(),
    updated_at: new Date(now).toISOString(),
    closes_at: null,
    ...overrides,
  };
}

/** Answers the patient's session functions with stand-in data instead of the database. */
async function standInSession(page: Page, current: () => unknown, extend?: () => unknown) {
  const json = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/rest/v1/rpc/my_share_session", (route) => json(route, current()));
  if (extend) await page.route("**/rest/v1/rpc/extend_session", (route) => json(route, extend()));
}

test("Time's up (stand-in data): extend brings the session back", async ({ page }) => {
  const now = Date.now();
  let session: unknown = standIn({
    status: "paused",
    expires_at: new Date(now - 60_000).toISOString(),
    paused_at: new Date(now - 60_000).toISOString(),
    closes_at: new Date(now + 29 * 60_000).toISOString(),
    chief_complaint: "Ongoing fatigue",
  });
  const extended = standIn({ status: "active", expires_at: new Date(now + 15 * 60_000).toISOString(), updated_at: new Date(now + 1000).toISOString() });
  await standInSession(page, () => session, () => {
    session = extended;
    return extended;
  });

  await home(page);
  await expect(page.getByRole("link", { name: /Dr Hennessy's access is paused.*View session/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Time's up.*Access paused · Decide now/ })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/session");
  await expect(page.getByRole("heading", { level: 1, name: "Time's up." })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Dr Hennessy's access has been paused. Your record is no longer visible until you decide.")).toBeVisible();
  await expect(page.getByText("29 of 29 min")).toBeVisible();
  await expect(page.getByRole("button", { name: /Save and end.*Session notes saved · access closed/ })).toBeVisible();
  await expect(page.getByText(/^If you don't decide, the session closes at /)).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: /add 15 minutes/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Dr Hennessy can see your record again." })).toBeAttached();
});

test("timer announcements (stand-in data): 5 minutes and 1 minute left, never every second", async ({ page }) => {
  // 5:03 left, so the 5-minute mark passes a few seconds in.
  let expiresAt = new Date(Date.now() + 5 * 60_000 + 3_000).toISOString();
  await standInSession(page, () => standIn({ expires_at: expiresAt }));
  await page.goto("/session");
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible({ timeout: 20_000 });
  const live = page.locator('[aria-live="polite"]').last();
  await expect(live).toHaveText("5 minutes of sharing left.", { timeout: 8_000 });

  // Then 1:03 left.
  expiresAt = new Date(Date.now() + 60_000 + 3_000).toISOString();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible({ timeout: 20_000 });
  await expect(live).toHaveText("1 minute of sharing left.", { timeout: 8_000 });
  // The ticking countdowns are never in a live region.
  const ticking = await page.locator('[aria-live], [role="status"], [role="alert"]').allTextContents();
  expect(ticking.join(" ")).not.toMatch(/\d+:\d{2}/);
});

test("a phone whose clock is 10 minutes slow still counts down from the database's time (stand-in data)", async ({ page }) => {
  const realNow = Date.now();
  // The device clock is 10 minutes behind; it keeps running from there.
  await page.clock.install({ time: realNow - 10 * 60_000 });
  // 25 minutes left by the database's clock (the Supabase responses carry the real Date header).
  await standInSession(page, () => standIn({ expires_at: new Date(realNow + 25 * 60_000).toISOString() }));
  await page.goto("/session");
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible({ timeout: 20_000 });
  // By the device clock alone this would read 34 or 35 minutes.
  await expect(page.getByText(/^2[45] min \d+ sec$/)).toBeVisible({ timeout: 8_000 });
});

test("offline: the session screen says it could not load, then recovers on its own", async ({ page }) => {
  await page.route("**/rest/v1/rpc/my_share_session", (route) => route.abort("internetdisconnected"));
  await page.goto("/session");
  const alert = page.getByRole("alert").filter({ hasText: "This couldn't load. Check your connection and try again." });
  await expect(alert).toBeVisible({ timeout: 20_000 });
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  await expectNoAxeViolations(page);
  // Back online: the next automatic read works, and with no live share the screen goes Home.
  await page.unroute("**/rest/v1/rpc/my_share_session");
  await page.waitForURL(/\/home$/, { timeout: 10_000 });
});
