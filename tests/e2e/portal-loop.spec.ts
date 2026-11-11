import { expect, test as base } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { DOCTOR, newDoctor, submitCode } from "../helpers/doctor";
import { DemoPatient } from "../helpers/patient";

/**
 * The share loop, portal side, against the real database (PLAN.md section
 * 12, end-to-end tests 1 to 6 and 10). The patient is driven from test code
 * (tests/helpers/patient.ts); the doctor is a real browser on /view.
 *
 * One anonymous patient for the whole file (sign-ins are capped at 30 an
 * hour), re-seeded before each test. Tests run in order in one worker, since
 * a patient has at most one live share. Desktop project only.
 */

const test = base.extend<object, { patient: DemoPatient }>({
  patient: [
    async ({}, use) => {
      const patient = await DemoPatient.signIn();
      await use(patient);
      await patient.dispose();
    },
    { scope: "worker" },
  ],
});

test.describe.configure({ mode: "serial" });
// Only in the desktop project (the phone project's viewport is 390 wide).
// Checked from a built-in fixture, so the skipped project never signs in.
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "The loop runs once, in the desktop project");

test.beforeEach(async ({ patient }) => {
  await patient.reset();
});

test("happy path: code, Allow, read the record, notes reach the patient's record", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser, { remember: false });

  // Name step, pre-filled by the demo flag.
  await page.goto("/view?demo=1");
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue(DOCTOR.name);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // Code step.
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Patient's share code" }).fill(share.code);
  await page.getByRole("button", { name: "Continue" }).click();

  // Waiting, and the patient sees exactly who typed it.
  await expect(page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();
  await expectNoAxeViolations(page);
  const requested = await patient.waitForStatus("requested");
  expect(requested.clinician_name).toBe(DOCTOR.name);
  expect(requested.clinician_role).toBe(DOCTOR.role);
  expect(requested.clinician_practice).toBe(DOCTOR.practice);

  // Nothing about the patient reaches the portal before Allow.
  const before = await page.request.get("/api/portal/record?section=overview");
  expect(await before.json()).toEqual({ record: null });

  await patient.respond(true);

  // c-opening, then the overview.
  await expect(page.getByRole("heading", { name: "Opening Jane's record." })).toBeVisible({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/view\/session$/, { timeout: 8_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByText("Penicillin allergy").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Atrial fibrillation").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Warfarin 5mg").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Personal note added")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Live session" })).toContainText("Access expires in");
  await expectNoAxeViolations(page);

  // Below 1024px the layout stacks without scrolling sideways.
  for (const width of [1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `scrolls sideways at ${width}`).toBeLessThanOrEqual(0);
  }
  await expectNoAxeViolations(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // The other sections.
  const nav = page.getByRole("navigation", { name: "Record sections" });
  await nav.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(main.getByText("Blood test, full blood count and INR").filter({ visible: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await nav.getByRole("link", { name: "Medications" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Medications" })).toBeVisible();
  await expect(main.getByText("Needs regular INR blood tests.").filter({ visible: true })).toBeVisible();
  await page.getByRole("tab", { name: /Expired/ }).click();
  await expect(main.getByText("Clarithromycin 500mg").filter({ visible: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await nav.getByRole("link", { name: "Care team" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Care team" })).toBeVisible();
  await expect(main.getByText("Boots, Rathmines").filter({ visible: true })).toBeVisible();
  await expectNoAxeViolations(page);

  // Notes autosave.
  await page.getByLabel("Chief complaint").fill("Ongoing fatigue over the past 6 weeks");
  await page.getByLabel("Plan").fill("Repeat INR in 2 weeks");
  await expect(page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible({ timeout: 8_000 });

  // c-end, then end.
  await page.getByRole("region", { name: "Live session" }).getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "End session with Jane Doe" })).toBeVisible();
  await expect(main.getByText("Ongoing fatigue over the past 6 weeks").filter({ visible: true })).toBeVisible();
  await expectNoAxeViolations(page);
  await main.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { name: "You ended the session." })).toBeVisible();
  await expect(page.getByText("Your session notes were saved to the patient's record.")).toBeVisible();
  await expectNoAxeViolations(page);

  // The notes are on Jane's timeline and in her access log.
  const ended = await patient.session();
  expect(ended?.status).toBe("ended");
  const entries = await patient.entries();
  const notes = entries.find((e) => e.kind === "session_notes");
  expect(notes?.body).toContain("Ongoing fatigue over the past 6 weeks");
  expect(notes?.body).toContain("Repeat INR in 2 weeks");
  expect(notes?.clinician).toBe(DOCTOR.name);
  const events = (await patient.accessEvents(ended!.id)).map((e) => e.event);
  expect(events).toEqual(expect.arrayContaining(["code_generated", "requested", "approved", "section_viewed", "notes_saved", "ended"]));

  // And the record is gone for good.
  const after = await page.request.get("/api/portal/record?section=overview");
  expect(await after.json()).toEqual({ record: null });
  await context.close();
});

test("deny: the portal says the patient chose not to share", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await expect(page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();
  await patient.waitForStatus("requested");
  await patient.respond(false);
  await expect(page.getByRole("heading", { name: "Your patient chose not to share their record." })).toBeVisible({
    timeout: 6_000,
  });
  await expectNoAxeViolations(page);
  expect(await (await page.request.get("/api/portal/record?section=overview")).json()).toEqual({ record: null });
  await context.close();
});

test("cancel and withdraw: the doctor cancels, then the patient withdraws the code", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await expect(page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();
  await patient.waitForStatus("requested");

  // Doctor cancels: the patient keeps the same code.
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  const kept = await patient.waitForStatus("code_issued");
  expect(kept.code).toBe(share.code);

  // The doctor tries again; the patient withdraws before answering.
  await page.getByRole("textbox", { name: "Patient's share code" }).fill(share.code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();
  await patient.waitForStatus("requested");
  await patient.end();
  await expect(page.getByRole("heading", { name: "Your patient withdrew the code." })).toBeVisible({ timeout: 6_000 });
  await expectNoAxeViolations(page);
  await context.close();
});

test("scope: switches off hide their sections", async ({ browser, patient }) => {
  const share = await patient.shareCode({ share_conditions: false, share_care_team: false, allow_notes: false });
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 10_000 });
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: /Conditions/ })).toHaveCount(0);
  await expect(main.getByText("Atrial fibrillation")).toHaveCount(0);
  await expect(main.getByText(/Not included in this share:.*Active conditions/)).toBeVisible();
  // Medications always travel.
  await expect(main.getByText("Warfarin 5mg").filter({ visible: true })).toBeVisible();
  // No notes panel when the patient did not allow notes.
  await expect(page.getByRole("heading", { name: "Session notes" })).toHaveCount(0);
  // Care team is locked in the sidebar, and the record route returns no care team.
  const nav = page.getByRole("navigation", { name: "Record sections" });
  await expect(nav.getByRole("link", { name: /Care team/ })).toHaveCount(0);
  await expect(nav.getByText("Care team")).toBeVisible();
  const team = await (await page.request.get("/api/portal/record?section=care_team")).json();
  expect(team.record.care_team).toBeNull();
  const conditions = await (await page.request.get("/api/portal/record?section=conditions")).json();
  expect(conditions.record.conditions).toBeNull();
  await expectNoAxeViolations(page);
  await context.close();
});

test("scope: mental health stays hidden, every medication shows, a personal note never appears", async ({
  browser,
  patient,
}) => {
  await patient.addCondition({ name: "Generalised anxiety", status: "ongoing", is_mental_health: true });
  await patient.addEntry({
    kind: "visit",
    title: "Counselling session",
    occurs_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    is_mental_health: true,
  });
  const share = await patient.shareCode({ share_full_timeline: true, share_mental_health: false });
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 10_000 });
  const main = page.getByRole("main");

  await expect(main.getByText("Atrial fibrillation").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Generalised anxiety")).toHaveCount(0);
  for (const med of ["Warfarin 5mg", "Levothyroxine 50mcg", "Salbutamol 100mcg"]) {
    await expect(main.getByText(med)).toBeVisible();
  }

  await page.getByRole("navigation", { name: "Record sections" }).getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(main.getByText("Every entry Jane chose to share").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Cardiology review").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Counselling session")).toHaveCount(0);
  await expect(page.getByText("Personal note added")).toHaveCount(0);
  await expect(page.getByText("Fatigue symptoms")).toHaveCount(0);

  // The same through the record route, every section.
  for (const section of ["overview", "conditions", "timeline", "medications", "care_team"]) {
    const body = JSON.stringify(await (await page.request.get(`/api/portal/record?section=${section}`)).json());
    expect(body).not.toContain("Generalised anxiety");
    expect(body).not.toContain("Counselling session");
    expect(body).not.toContain("Fatigue symptoms");
  }
  const meds = (await (await page.request.get("/api/portal/record?section=medications")).json()).record.medications;
  expect(meds.current).toHaveLength(3);
  expect(meds.expired).toHaveLength(2);
  await context.close();
});

test("the patient ends early: the portal loses the record within 5 seconds", async ({ browser, patient }) => {
  const share = await patient.shareCode();
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 10_000 });
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

  // A direct call for record data now returns nothing, for every section.
  for (const section of ["overview", "conditions", "timeline", "medications", "care_team"]) {
    const res = await page.request.get(`/api/portal/record?section=${section}`);
    expect(await res.json()).toEqual({ record: null });
  }
  // The notes saved before the patient ended still reached the record.
  const notes = (await patient.entries()).find((e) => e.kind === "session_notes");
  expect(notes?.body).toContain("Rate controlled");
  await context.close();
});

test("the patient adds time: the portal's countdown moves on", async ({ browser, patient }) => {
  const share = await patient.shareCode({ duration_kind: "30m" });
  const { context, page } = await newDoctor(browser);
  await submitCode(page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  const banner = page.getByRole("region", { name: "Live session" });
  await expect(banner).toContainText(/Access expires in (29|30):\d\d/, { timeout: 10_000 });
  await patient.extend(15);
  await expect(banner).toContainText(/Access expires in 4\d:\d\d/, { timeout: 7_000 });
  await context.close();
});
