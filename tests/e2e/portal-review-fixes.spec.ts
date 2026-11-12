import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { newDoctor } from "../helpers/doctor";
import { fakeRecord, mockPortal, statusOf } from "../helpers/portal-mocks";

/**
 * The portal's review fixes (docs/REVIEW.md 1.6), against stand-in
 * /api/portal responses (tests/helpers/portal-mocks.ts, made-up data). The
 * ids in each title are the review checklist's.
 */

const ENTRY = "Enter the patient's code";

async function openRecord(page: Page) {
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
}

const notesField = (page: Page, label: string) => page.getByLabel(label).filter({ visible: true });

test("notes: autosave shows beside the heading, the limit is the database's, Copy is there (C3, C5, D2, F13)", async ({
  browser,
  viewport,
}) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("active") });
  await openRecord(page);
  const notes = page.getByRole("complementary", { name: "Session notes" });
  await notesField(page, "Chief complaint").fill("Cough for a week");
  await expect(notes.getByText(/^Saved \d{1,2}:\d\d$/)).toBeVisible({ timeout: 6_000 });
  // An autosave never spins the button.
  await expect(notes.getByRole("button", { name: "Save notes" })).not.toHaveAttribute("aria-busy", "true");
  await expect(notes.getByRole("button", { name: "Copy notes" })).toBeVisible();

  await expect(notesField(page, "Plan")).toHaveAttribute("maxlength", "5000");
  await notesField(page, "Plan").fill("x".repeat(4600));
  await expect(notes.getByText("4,600 of 5,000 characters")).toBeVisible();
  await expectNoAxeViolations(page);
  await context.close();
});

test("notes: a refused save says why in words (C3)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("active") });
  await page.route("**/api/portal/notes", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "notes_too_long" }) }),
  );
  await openRecord(page);
  await notesField(page, "Assessment").fill("Long");
  await expect(page.getByText("Each notes field holds up to 5,000 characters. Shorten the longest one and save again.")).toBeVisible({
    timeout: 6_000,
  });
  await expect(page.getByRole("complementary", { name: "Session notes" }).getByText("Not saved")).toBeVisible();
  await context.close();
});

test("ending: unsaved notes keep the session open until the doctor chooses (C2), a failed end says so (C8)", async ({
  browser,
  viewport,
}) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("active") });
  await page.route("**/api/portal/notes", (route) => route.abort("internetdisconnected"));
  let ends = 0;
  await page.route("**/api/portal/end", async (route) => {
    ends += 1;
    if (ends === 1) return route.abort("internetdisconnected");
    return route.fallback();
  });
  await openRecord(page);
  await notesField(page, "Chief complaint").fill("Chest pain on exertion");
  await page.getByRole("link", { name: "End session" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "End session with Test Patient" })).toBeVisible();
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await expect(page.getByText("Your latest notes could not be saved, so the session is still open.", { exact: false })).toBeVisible();
  expect(ends).toBe(0);

  // Ending without them: the first try fails (C8), visibly.
  await page.getByRole("button", { name: "End without the latest notes" }).click();
  await expect(page.getByText("The session could not be ended. Check your connection and try again.").filter({ visible: true })).toBeVisible();
  await expectNoAxeViolations(page);

  // The second goes through; the notes are on the ended screen to copy.
  set({ status: () => statusOf("ended", { ended_by: "clinician", notes_saved_to_record: false }) });
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page.getByRole("button", { name: "End without the latest notes" }).click();
  await expect(page.getByRole("heading", { name: "You ended the session." })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByLabel("Notes not saved")).toHaveValue("Chief complaint: Chest pain on exertion");
  await expect(page.getByRole("button", { name: "Copy notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print notes" })).toBeVisible();
  await context.close();
});

test("ended: start, duration and the notes to copy or print (D1, F13)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, {
    status: () =>
      statusOf("active", {
        notes: { chief_complaint: "Headache", assessment: "Tension", plan: null, follow_up: null, updated_at: null },
      }),
  });
  await openRecord(page);
  set({ status: () => statusOf("ended", { ended_by: "patient", notes_saved_to_record: true }) });
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText("Started", { exact: true })).toBeVisible();
  await expect(page.getByText("Duration", { exact: true })).toBeVisible();
  const yours = page.getByRole("region", { name: "Your notes" });
  await expect(yours).toContainText("Chief complaint: Headache");
  await expect(yours).toContainText("Assessment: Tension");
  await expect(yours.getByRole("button", { name: "Print notes" })).toBeVisible();
  await expectNoAxeViolations(page);
  await context.close();
});

test("a failed overview says so, with Try again and End session (C9)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  let fail = true;
  await mockPortal(page, { status: () => statusOf("active") });
  await page.route("**/api/portal/record?section=overview", (route) =>
    fail ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"server_error"}' }) : route.fallback(),
  );
  await page.goto("/view/session");
  await expect(page.getByText("The record could not be loaded.")).toBeVisible();
  await expect(page.getByRole("link", { name: "End session" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  await context.close();
});

test("a failed section has Try again (C11)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  let fail = true;
  await mockPortal(page, { status: () => statusOf("active") });
  await page.route("**/api/portal/record?section=care_team", (route) =>
    fail ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"server_error"}' }) : route.fallback(),
  );
  await page.goto("/view/session/care-team");
  await expect(page.getByText("This part of the record could not be loaded.")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Care team" })).toBeVisible();
  await context.close();
});

test("lost connection is said on screen, in the record and while waiting (C10)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("active") });
  await openRecord(page);
  await page.route("**/api/portal/status", (route) => route.abort("internetdisconnected"));
  await expect(page.getByText("Trace can't be reached. Check your connection; the portal keeps trying.")).toBeVisible({
    timeout: 15_000,
  });
  await page.unroute("**/api/portal/status");
  await expect(page.getByText("Trace can't be reached.", { exact: false })).toHaveCount(0, { timeout: 8_000 });
  await context.close();

  const second = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(second.page, { status: () => statusOf("requested") });
  await second.page.goto("/view");
  await expect(second.page.getByRole("heading", { name: "Waiting for the patient to approve" })).toBeVisible();
  await second.page.route("**/api/portal/status", (route) => route.abort("internetdisconnected"));
  await expect(second.page.getByText("Trace can't be reached.", { exact: false })).toBeVisible({ timeout: 10_000 });
  await second.context.close();
});

test("visits: Overview rows open their visit, which is in the address (C16, C19, F15)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("active") });
  await openRecord(page);
  await page.getByRole("link", { name: /Iron test/ }).click();
  await expect(page).toHaveURL(/\/view\/session\/visits\?id=e-past-2$/);
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByRole("heading", { level: 3, name: "Iron test" })).toBeVisible();
  await expect(details.getByText("Added by Test")).toBeVisible();
  await page.getByRole("button", { name: /Practice visit/ }).click();
  await expect(page).toHaveURL(/\/view\/session\/visits\?id=e-past-1$/);
  await expect(details.getByRole("heading", { level: 3, name: "Practice visit" })).toBeVisible();
  // Stacked (a narrow record area), the detail is brought into view and focused.
  if ((viewport?.width ?? 1440) < 700) await expect(details).toBeFocused();
  await expectNoAxeViolations(page);
  await context.close();
});

test("medications: how it is taken, the prescriber and the refill (F14)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, {
    status: () => statusOf("active"),
    record: (section) => {
      const r = fakeRecord(section) as { data: { current?: Array<Record<string, unknown>> } };
      if (section === "medications" && r.data.current) {
        r.data.current = r.data.current.map((m) => ({ ...m, form: "Tablet", frequency: "once daily", refill_due_on: "2026-12-01", supply_days_left: 8 }));
      }
      return r;
    },
  });
  await page.goto("/view/session/medications");
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByText("Tablet, once daily, morning")).toBeVisible();
  await expect(details.getByText("Prescriber", { exact: true })).toBeVisible();
  await expect(details.getByText("1 Dec 2026, 8 days of supply left")).toBeVisible();
  await context.close();
});

test("the time-left label follows added time; 5 minutes left shows on screen (C18, D3)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const start = Date.now() - 41 * 60_000;
  await mockPortal(page, {
    status: () =>
      statusOf("active", {
        approved_at: new Date(start).toISOString(),
        expires_at: new Date(start + 45 * 60_000).toISOString(),
      }),
  });
  await openRecord(page);
  await expect(page.getByText("Shared for 45 min")).toBeVisible();
  await expect(page.getByText("Less than 5 minutes left.", { exact: false })).toBeVisible();
  await context.close();
});

test("code step: the fourth digit sends the code, and focus stays visible on a wrong code (D4, C21)", async ({
  browser,
  viewport,
}) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  let codes = 0;
  await mockPortal(page, {
    status: () => statusOf("none"),
    code: () => {
      codes += 1;
      return { result: "wrong", attempts_left: 4, locked_until: null, request_expires_at: null };
    },
  });
  await page.goto("/view");
  const input = page.getByRole("textbox", { name: "Patient's share code" });
  await input.pressSequentially("1234");
  await expect(page.getByText(/That code doesn't match/)).toBeVisible();
  expect(codes).toBe(1);
  await expect(input).toBeFocused();
  // The ring is drawn on the next box, even in the error state.
  const ringed = await page.locator('[aria-hidden="true"] > div').evaluateAll((boxes) =>
    boxes.filter((b) => getComputedStyle(b).outlineStyle !== "none" && getComputedStyle(b).outlineWidth !== "0px").length,
  );
  expect(ringed).toBe(1);
  await context.close();
});

test("demo: starts at the code as Dr Hennessy and keeps a real doctor's saved details (D5, H7, C22, C26)", async ({
  browser,
  viewport,
}) => {
  const { context, page } = await newDoctor(browser, { remember: false, viewport: viewport ?? undefined });
  await context.addInitScript(() => {
    if (!window.localStorage.getItem("trace.portal.clinician"))
      window.localStorage.setItem("trace.portal.clinician", JSON.stringify({ name: "Dr Real", role: "GP", practice: "Cork" }));
  });
  const set = await mockPortal(page, { status: () => statusOf("none") });
  await page.goto("/view?demo=1");
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await expect(page.getByText("Requesting as Dr Hennessy.")).toBeVisible();
  await page.getByRole("button", { name: "Change details" }).click();
  await page.getByLabel("Your name").fill("Dr Demo");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Requesting as Dr Demo.")).toBeVisible();
  const saved = await page.evaluate(() => window.localStorage.getItem("trace.portal.clinician"));
  expect(saved).toContain("Dr Real");

  // After a session the demo keeps its footer and its way back.
  set({ status: () => statusOf("ended", { ended_by: "patient", notes_saved_to_record: false }) });
  await page.goto("/view/session");
  await expect(page.getByRole("contentinfo")).toContainText("Demo with sample data");
  await expect(page.getByRole("link", { name: "Enter a new code" })).toHaveAttribute("href", "/view?demo=1");
  await context.close();
});

test("name step: focus in the first field; Change details can be cancelled; Back steps back (D6, C23)", async ({
  browser,
  viewport,
}) => {
  const { context, page } = await newDoctor(browser, { remember: false, viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("none") });
  await page.goto("/view");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.getByLabel("Your name").fill("Dr Test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expect(page).toHaveURL(/\/view$/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await context.close();
});

test("a mistyped portal address stays in the portal (C25)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const res = await page.goto("/view/nothing-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "There is nothing at this address." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the portal" })).toHaveAttribute("href", "/view");
  await expectNoAxeViolations(page);
  await context.close();
});

test("a document that cannot be opened says so in words (C12)", async ({ request }) => {
  const res = await request.get("/api/portal/document?id=00000000-0000-0000-0000-000000000000");
  expect(res.status()).toBe(404);
  expect(res.headers()["content-type"]).toContain("text/html");
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(await res.text()).toContain("This document can't be opened.");
});

test("typing in the notes carries on when the countdown reaches zero and access pauses (C4)", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const expiresAt = Date.now() + 5000;
  await mockPortal(page, {
    status: () =>
      Date.now() < expiresAt + 2500 ? statusOf("active", { expires_at: new Date(expiresAt).toISOString() }) : statusOf("paused"),
  });
  await openRecord(page);
  const field = notesField(page, "Chief complaint");
  await field.click();
  await page.keyboard.type("Abc");
  await page.waitForFunction((t) => Date.now() >= t + 300, expiresAt);
  await expect(page.getByRole("heading", { name: "Checking access" }).or(page.getByRole("heading", { name: "Time's up on this share." }))).toBeVisible();
  await expect(notesField(page, "Chief complaint")).toBeFocused();
  await page.keyboard.type("def");
  await expect(page.getByRole("heading", { name: "Time's up on this share." })).toBeVisible({ timeout: 8_000 });
  await expect(notesField(page, "Chief complaint")).toBeFocused();
  await page.keyboard.type("!");
  await expect(notesField(page, "Chief complaint")).toHaveValue("Abcdef!");
  await context.close();
});
