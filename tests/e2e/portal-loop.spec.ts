import { expect, test as base } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { DOCTOR, newDoctor, submitCode } from "../helpers/doctor";
import { PortalPatient } from "../helpers/portal-patient";

/**
 * The share loop, portal side, against the real database. The patient is
 * driven from test code with the redesign's seed and share call
 * (tests/helpers/portal-patient.ts); the doctor is a real browser on /view.
 *
 * One anonymous patient for the whole file (sign-ins are capped at 30 an
 * hour), re-seeded before each test. Tests run in order in one worker, since
 * a patient has at most one live share. Desktop project only.
 */

const test = base.extend<object, { patient: PortalPatient }>({
  patient: [
    async ({}, use) => {
      const patient = await PortalPatient.signIn();
      await use(patient);
      await patient.dispose();
    },
    { scope: "worker" },
  ],
});

test.describe.configure({ mode: "serial" });
// Only in the desktop project. Checked from a built-in fixture, so the skipped project never signs in.
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "The loop runs once, in the desktop project");

test.beforeEach(async ({ patient }) => {
  await patient.reset();
});

const WAITING = "Waiting for the patient to approve";

test("happy path: code, Allow, read every view, notes reach the patient's record", async ({ browser, patient }) => {
  test.setTimeout(120_000);
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser, { remember: false });
  // The doctor's browser must never talk to Supabase, only to /api/portal.
  const hosts = new Set<string>();
  context.on("request", (r) => hosts.add(new URL(r.url()).host));

  // Name step, pre-filled by the demo flag.
  await page.goto("/view?demo=1");
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue(DOCTOR.name);
  await page.getByRole("button", { name: "Continue" }).click();

  // Code step.
  await expect(page.getByRole("heading", { name: "Enter the patient's code" })).toBeVisible();
  await expect(page.getByText("Requesting as Dr Hennessy.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Patient's share code" }).fill(share.code);
  await page.getByRole("button", { name: "Continue" }).click();

  // Waiting, and the patient sees exactly who typed it.
  await expect(page.getByRole("heading", { name: WAITING })).toBeVisible();
  await expectNoAxeViolations(page);
  const requested = await patient.waitForStatus("requested");
  expect(requested.clinician_name).toBe(DOCTOR.name);
  expect(requested.clinician_role).toBe(DOCTOR.role);
  expect(requested.clinician_practice).toBe(DOCTOR.practice);

  // Nothing about the patient reaches the portal before Allow.
  const before = await page.request.get("/api/portal/record?section=overview");
  expect(await before.json()).toEqual({ record: null });

  await patient.respond(true);

  // The record opens on the Overview.
  await expect(page).toHaveURL(/\/view\/session$/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Jane Doe" })).toBeVisible({ timeout: 10_000 });
  const main = page.getByRole("main");
  await expect(main.getByText("35, female, born 12 Mar 1991, Dublin").filter({ visible: true })).toBeVisible();
  const facts = main.locator("dl").first();
  await expect(facts).toContainText("Allergy");
  await expect(facts).toContainText("Penicillin");
  await expect(facts).toContainText("Blood type");
  await expect(facts).toContainText("A+");
  await expect(facts).toContainText(/Shared for 30 min\s*(29|30):\d\d left/);
  await expect(page.getByRole("progressbar", { name: "Time left" })).toBeVisible();
  await expect(main.getByText("Atrial fibrillation").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Managed, since 2019").filter({ visible: true })).toBeVisible();
  for (const med of ["Concerta", "Levothyroxine", "Warfarin", "Salbutamol"]) {
    await expect(main.getByRole("link", { name: new RegExp(`^${med}`) })).toBeVisible();
  }
  await expect(main.getByText("128/82").filter({ visible: true })).toBeVisible();
  // A personal note is never shown to a doctor; no banner, no Live stamp.
  await expect(page.getByText("Fatigue symptoms")).toHaveCount(0);
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Patient record" });
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);

  // Usable at 1024 and 768 without scrolling sideways.
  for (const width of [1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `scrolls sideways at ${width}`).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Recent visits: past rows open text and result detail; upcoming rows are not buttons.
  await nav.getByRole("link", { name: "Recent visits" }).click();
  await expect(nav.getByRole("link", { name: "Recent visits" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 3, name: "GP visit" })).toBeVisible();
  await expect(main.getByText("Tired for three weeks").filter({ visible: true })).toBeVisible();
  await expect(main.getByRole("button", { name: /INR blood test/ })).toHaveCount(0);
  await expect(main.getByText("INR blood test").filter({ visible: true })).toBeVisible();
  await main.getByRole("button", { name: /Blood count and INR/ }).click();
  await expect(main.getByRole("button", { name: /Blood count and INR/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 3, name: "Blood count and INR" })).toBeVisible();
  await expect(main.getByText("18 µg/L, low").filter({ visible: true })).toBeVisible();
  await expect(main.getByRole("img", { name: /Ferritin 18 µg\/L, low/ })).toBeVisible();
  await expect(main.getByText("Older visits are in the full timeline.").filter({ visible: true })).toBeVisible();
  await page.waitForTimeout(250);
  await expectNoAxeViolations(page);

  // Medications: the step chart's values in order, prescriber, no notes (Medication notes is off).
  await nav.getByRole("link", { name: "Medications" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Concerta" })).toBeVisible();
  await expect(main.getByText("Now 36mg, since Feb 2025").filter({ visible: true })).toBeVisible();
  const chart = main.locator("table").filter({ hasText: "Strength" });
  await expect(chart.locator("tbody tr td:first-child")).toHaveText(["18mg", "27mg", "36mg", "45mg", "36mg"]);
  await expect(main.getByText("Prescribed by Dr Hennessy").filter({ visible: true }).first()).toBeVisible();
  await expect(main.getByText(/Jane: “/)).toHaveCount(0);
  await expect(main.getByText("Back on 36", { exact: false })).toHaveCount(0);
  await page.getByRole("radio", { name: "Past" }).click();
  await expect(main.getByRole("button", { name: /Doxycycline/ })).toContainText("2 Aug 2026 to 9 Aug 2026");
  await expect(page.getByRole("heading", { level: 3, name: "Doxycycline" })).toBeVisible();
  await expect(main.getByText("Stopped 9 Aug 2026").filter({ visible: true })).toBeVisible();
  await page.waitForTimeout(250);
  await expectNoAxeViolations(page);

  // Overview's medication rows open Medications with that one selected.
  await nav.getByRole("link", { name: "Overview" }).click();
  await main.getByRole("link", { name: /^Warfarin/ }).click();
  await expect(page).toHaveURL(/\/view\/session\/medications\?id=/);
  await expect(page.getByRole("heading", { level: 3, name: "Warfarin" })).toBeVisible();
  await expect(main.getByRole("button", { name: /^Warfarin/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("radio", { name: "Current" })).toHaveAttribute("aria-checked", "true");

  // Care team.
  await nav.getByRole("link", { name: "Care team" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Care team" })).toBeVisible();
  await expect(main.getByText("Dr O'Mahony").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Pharmacy, Rathmines").filter({ visible: true })).toBeVisible();
  await page.waitForTimeout(250);
  await expectNoAxeViolations(page);

  // The views this share left out are dimmed rows, not links.
  for (const name of ["Full timeline", "Family history", "Documents", "Insurance", "Mental health"]) {
    await expect(nav.getByRole("link", { name })).toHaveCount(0);
    await expect(nav.getByText(name)).toBeVisible();
  }

  // Notes autosave.
  await page.getByLabel("Chief complaint").fill("Ongoing fatigue over the past 6 weeks");
  await page.getByLabel("Plan").fill("Repeat INR in 2 weeks");
  await expect(page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible({ timeout: 8_000 });

  // End session: the step before, then the end.
  await main.getByRole("link", { name: "End session" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "End session with Jane Doe" })).toBeVisible();
  await expectNoAxeViolations(page);
  await main.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { name: "You ended the session." })).toBeVisible();
  await expect(page.getByText("Access ended")).toBeVisible();
  await expect(page.getByText("Your session notes were saved to the patient's record.")).toBeVisible();
  await expect(page.getByText("Jane Doe")).toHaveCount(0);
  await expectNoAxeViolations(page);

  // The notes are on Jane's timeline and in her access log.
  const ended = await patient.session();
  expect(ended?.status).toBe("ended");
  const notes = (await patient.entries()).find((e) => e.kind === "session_notes");
  expect(notes?.body).toContain("Ongoing fatigue over the past 6 weeks");
  expect(notes?.body).toContain("Repeat INR in 2 weeks");
  expect(notes?.clinician).toBe(DOCTOR.name);
  const events = await patient.accessEvents(ended!.id);
  expect(events.map((e) => e.event)).toEqual(
    expect.arrayContaining(["code_generated", "requested", "approved", "section_viewed", "notes_saved", "ended"]),
  );
  const viewed = events.filter((e) => e.event === "section_viewed").map((e) => (e.detail as { section: string }).section);
  expect(new Set(viewed)).toEqual(new Set(["overview", "recent_visits", "medications", "care_team"]));

  // And the record is gone for good.
  for (const section of ["overview", "medications", "recent_visits"]) {
    expect(await (await page.request.get(`/api/portal/record?section=${section}`)).json()).toEqual({ record: null });
  }

  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  expect([...hosts]).not.toContain(supabaseHost);
  expect([...hosts].filter((h) => h.includes("supabase"))).toEqual([]);
  await context.close();
});

test("deny: the portal says the patient chose not to share", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await expect(page.getByRole("heading", { name: WAITING })).toBeVisible();
  await patient.waitForStatus("requested");
  await patient.respond(false);
  await expect(page.getByRole("heading", { name: "Your patient chose not to share their record." })).toBeVisible({
    timeout: 6_000,
  });
  await expectNoAxeViolations(page);
  expect(await (await page.request.get("/api/portal/record?section=overview")).json()).toEqual({ record: null });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("textbox", { name: "Patient's share code" })).toBeFocused();
  await context.close();
});

test("cancel and withdraw: the doctor cancels, then the patient withdraws the code", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await expect(page.getByRole("heading", { name: WAITING })).toBeVisible();
  await patient.waitForStatus("requested");

  // Doctor cancels: the patient keeps the same code.
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByRole("heading", { name: "Enter the patient's code" })).toBeVisible();
  const kept = await patient.waitForStatus("code_issued");
  expect(kept.code).toBe(share.code);

  // The doctor tries again; the patient withdraws before answering.
  await page.getByRole("textbox", { name: "Patient's share code" }).fill(share.code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: WAITING })).toBeVisible();
  await patient.waitForStatus("requested");
  await patient.end();
  await expect(page.getByRole("heading", { name: "Your patient withdrew the code." })).toBeVisible({ timeout: 6_000 });
  await expectNoAxeViolations(page);
  await context.close();
});

test("the patient ends early: the portal loses the record within 5 seconds", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(page.getByRole("heading", { level: 1, name: "Jane Doe" })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Assessment").fill("Rate controlled");
  await expect(page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible({ timeout: 8_000 });

  await patient.end();
  const endedAt = Date.now();
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 6_000 });
  expect(Date.now() - endedAt).toBeLessThan(6_000);
  await expect(page.getByText("Penicillin")).toHaveCount(0);
  await expect(page.getByText("Jane Doe")).toHaveCount(0);
  await expect(page.getByText("Your session notes were saved to the patient's record.")).toBeVisible();
  await expectNoAxeViolations(page);

  for (const section of ["overview", "conditions", "recent_visits", "medications", "care_team"]) {
    const res = await page.request.get(`/api/portal/record?section=${section}`);
    expect(await res.json()).toEqual({ record: null });
  }
  const notes = (await patient.entries()).find((e) => e.kind === "session_notes");
  expect(notes?.body).toContain("Rate controlled");
  await context.close();
});

test("the patient adds time: the header's countdown moves on", async ({ browser, patient }) => {
  const share = await patient.shareCode({ duration_kind: "30m" });
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  const facts = page.getByRole("main").locator("dl").first();
  await expect(facts).toContainText(/(29|30):\d\d left/, { timeout: 10_000 });
  const { data, error } = await patient.client.rpc("extend_session", { minutes: 15 });
  expect(error).toBeNull();
  expect(data).toBeTruthy();
  await expect(facts).toContainText(/4\d:\d\d left/, { timeout: 7_000 });
  await context.close();
});

/**
 * Slow (about 5 minutes), so opt-in: E2E_SLOW=1. The patient never answers:
 * the request times out on the database clock, and a second doctor typing
 * the same code is told it expired. The paused state and the countdown
 * reaching zero cannot be reached faster than the shortest share (30 min),
 * so they use stand-in responses in portal-states.spec.ts and are covered by
 * supabase/tests/05_time_transitions.sql.
 */
test("slow: the request times out, then the same code is expired", async ({ browser, patient }) => {
  test.skip(!process.env.E2E_SLOW, "Set E2E_SLOW=1 to run (takes about 5 minutes)");
  test.setTimeout(8 * 60_000);
  const share = await patient.shareCode();
  const first = await newDoctor(browser);
  await submitCode(first.page, share.code);
  await expect(first.page.getByRole("heading", { name: WAITING })).toBeVisible();
  await patient.waitForStatus("requested");

  await expect(first.page.getByRole("heading", { name: "Your patient didn't answer in time." })).toBeVisible({
    timeout: 6 * 60_000,
  });
  await expectNoAxeViolations(first.page);

  const second = await newDoctor(browser);
  await submitCode(second.page, share.code);
  await expect(second.page.getByText("That code has expired.", { exact: false })).toBeVisible();
  await expectNoAxeViolations(second.page);
  await first.context.close();
  await second.context.close();
});
