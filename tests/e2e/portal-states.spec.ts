import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { DOCTOR, newDoctor } from "../helpers/doctor";
import { mockPortal, SCOPE, statusOf } from "../helpers/portal-mocks";

/**
 * Portal screens and states that need no patient: the loading and name
 * steps, wrong and locked codes (against the real database, each with a
 * fresh portal token and its own test IP so nothing locks anyone else out),
 * the about page, and, through stand-in /api/portal responses (made-up
 * data, never the seed), the states that take real minutes to reach
 * (expired code, request timed out, the countdown reaching zero, access
 * paused, ended by the patient or the timer) and the notes panel. Runs at
 * phone and desktop widths unless a test says otherwise.
 */

const ENTRY = "Enter the patient's code";
const WAITING = "Waiting for the patient to approve";

test("name step: errors in words, remembered for next time", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { remember: false, viewport: viewport ?? undefined });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your name, as your patient knows you.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await expectNoAxeViolations(page);

  await page.getByLabel("Your name").fill("Dr Test");
  await page.getByLabel(/^Role/).fill("GP");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await expect(page.getByText("Requesting as Dr Test.")).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Dr Test");

  // "Change details" goes back to the name step, filled in.
  await page.getByRole("button", { name: "Change details" }).click();
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Dr Test");
  await page.getByRole("button", { name: "Continue" }).click();

  // Remembered: a reload skips the name step.
  await page.reload();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await context.close();
});

test("loading screen shows first and passes axe", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await page.route("**/api/portal/status", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/view");
  await expect(page.getByRole("heading", { level: 1, name: "Clinical Access Portal" })).toBeAttached();
  await expect(page.getByText("Loading the portal")).toBeVisible();
  await expectNoAxeViolations(page);
  await context.close();
});

test("wrong code, then too many attempts, against the database", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await page.goto("/view");
  const input = page.getByRole("textbox", { name: "Patient's share code" });

  // Codes are random, so a guess could in theory match someone's live code.
  // If it ever does, cancel at once so nobody's phone keeps the request.
  async function guess(code: string) {
    await input.fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    const waiting = page.getByRole("heading", { name: WAITING });
    const wrong = page.getByText(/That code doesn't match|Too many attempts/);
    await expect(waiting.or(wrong)).toBeVisible();
    if (await waiting.isVisible()) {
      await page.getByRole("button", { name: "Cancel request" }).click();
      test.skip(true, "A random guess matched a live code; cancelled it.");
    }
  }

  await guess("0000");
  await expect(page.getByText("That code doesn't match. 4 tries left before a 15 minute pause.")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  // Focus is back in the field, which carries the message, and the boxes are empty.
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await expectNoAxeViolations(page);

  // Typing again clears the message.
  await input.pressSequentially("1");
  await expect(page.getByText(/That code doesn't match/)).toHaveCount(0);

  for (const code of ["0001", "0002", "0003", "0004"]) await guess(code);
  await expect(page.getByText(/Too many attempts\. Code entry is paused on this browser until \d{1,2}:\d\d\./)).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expectNoAxeViolations(page);

  // Still locked after a reload: the database remembers the token.
  await page.reload();
  await expect(page.getByText(/Too many attempts\./)).toBeVisible();
  await context.close();
});

test("the footer links lead to the portal's privacy and practice notes", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("A portfolio project, not a medical service");
  await page.getByRole("link", { name: "For your practice" }).click();
  await expect(page).toHaveURL(/\/view\/about#practice$/);
  await expect(page.getByRole("heading", { level: 2, name: "For your practice" })).toBeVisible();
  await expect(page.getByText("This is not end-to-end encryption.", { exact: false })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Back to the portal" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();

  // The demo says so instead.
  await page.goto("/view?demo=1");
  await expect(page.getByRole("contentinfo")).toContainText("Demo with sample data");
  await context.close();
});

test("mocked: expired code", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, {
    status: () => statusOf("none"),
    code: () => ({ result: "expired", attempts_left: 4, locked_until: null, request_expires_at: null }),
  });
  await page.goto("/view");
  const input = page.getByRole("textbox", { name: "Patient's share code" });
  await input.fill("1234");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code has expired. Codes last 5 minutes. Ask your patient for a new one.")).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expectNoAxeViolations(page);
  await context.close();
});

test("mocked: waiting, then the request times out", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("requested") });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: WAITING })).toBeVisible();
  // PortalWaitB: "Patient has" over the large countdown, and the three steps.
  await expect(page.getByText("Patient has", { exact: true })).toBeVisible();
  await expect(page.getByText(/^[34]:\d\d$/)).toBeVisible();
  const steps = page.getByRole("list", { name: "Progress" });
  await expect(steps.getByRole("listitem")).toHaveText(["Code accepted", "Waiting for approval", "Open record"]);
  await expect(steps.locator('[aria-current="step"]')).toHaveText("Waiting for approval");
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
  await expectNoAxeViolations(page);

  set({ status: () => statusOf("expired") });
  await expect(page.getByRole("heading", { name: "Your patient didn't answer in time." })).toBeVisible({ timeout: 5000 });
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("textbox", { name: "Patient's share code" })).toBeFocused();
  await context.close();
});

test("mocked: the countdown reaches zero and the record leaves at once", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  // Stand-in: a session with 4 seconds left. The database pauses it when the
  // time passes (supabase/tests/05_time_transitions.sql); here the status
  // keeps saying "active" for 3 more seconds, so what clears the record is
  // the portal's own countdown, not the poll.
  const expiresAt = Date.now() + 4000;
  await mockPortal(page, {
    status: () =>
      Date.now() < expiresAt + 3000
        ? statusOf("active", { expires_at: new Date(expiresAt).toISOString() })
        : statusOf("paused"),
  });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  await expect(page.getByText("Latex").filter({ visible: true })).toBeVisible();

  await page.waitForFunction((t) => Date.now() >= t + 500, expiresAt);
  await expect(page.getByText("Test Patient")).toHaveCount(0);
  await expect(page.getByText("Latex")).toHaveCount(0);
  await expect(page.getByText("Test condition")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Time's up on this share." })).toBeVisible({ timeout: 6000 });
  await expect(page.getByText("Test Patient")).toHaveCount(0);
  // Nothing about the patient was kept in browser storage.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain("Test");
  expect(stored).not.toContain("Latex");
  await expectNoAxeViolations(page);
  await context.close();
});

test("mocked: access pauses, the record disappears, then comes back", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const active = { status: () => statusOf("active") };
  const set = await mockPortal(page, active);
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  await expect(page.getByText("Latex").filter({ visible: true })).toBeVisible();

  set({ status: () => statusOf("paused"), record: null });
  await expect(page.getByRole("heading", { name: "Time's up on this share." })).toBeVisible({ timeout: 7000 });
  await expect(page.getByText("Latex")).toHaveCount(0);
  await expect(page.getByText("Test Patient")).toHaveCount(0);
  await expect(page.getByText(/If nothing changes, the session closes at \d{1,2}:\d\d\./)).toBeVisible();
  // The doctor can still finish their notes.
  await expect(page.getByLabel("Chief complaint")).toBeEditable();
  await expectNoAxeViolations(page);

  set(active);
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible({ timeout: 7000 });
  await expect(page.getByText("Latex").filter({ visible: true })).toBeVisible();
  await context.close();
});

test("mocked: ended with notes allowed but none written says so", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("active") });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  // After the end the database no longer says whether notes were allowed.
  set({ status: () => statusOf("ended", { ended_by: "patient", notes_saved_to_record: false }) });
  await expect(page.getByText("No session notes were written, so nothing was added to the record.")).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText("Access ended")).toBeVisible();
  await context.close();
});

test("mocked: ended by the patient and by the timer", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, {
    status: () => statusOf("ended", { ended_by: "patient", notes_saved_to_record: true }),
  });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible();
  await expect(page.getByText("Your session notes were saved to the patient's record.")).toBeVisible();
  await expectNoAxeViolations(page);

  set({ status: () => statusOf("ended", { ended_by: "timeout", allow_notes: false }) });
  await page.reload();
  await expect(page.getByRole("heading", { name: "The session has closed." })).toBeVisible();
  await expectNoAxeViolations(page);
  // One way on: back to the code.
  set({ status: () => statusOf("none") });
  await page.getByRole("link", { name: "Enter a new code" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await context.close();
});

test("mocked: no session on /view/session goes back to /view", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("none") });
  await page.goto("/view/session");
  await expect(page).toHaveURL(/\/view$/);
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(DOCTOR.name);
  await context.close();
});

test("mocked: notes typed but not saved when the patient ends stay on screen to copy", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("active") });
  // The connection drops: every notes save fails.
  await page.route("**/api/portal/notes", (route) => route.abort("internetdisconnected"));
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  await page.getByLabel("Chief complaint").fill("Chest pain on exertion");
  await expect(page.getByText("Notes could not be saved. Check your connection and try Save notes again.")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByLabel("Chief complaint")).toHaveValue("Chest pain on exertion");

  set({ status: () => statusOf("ended", { ended_by: "patient", notes_saved_to_record: false }) });
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText(/were not saved before the session ended/)).toBeVisible();
  await expect(page.getByLabel("Notes not saved")).toHaveValue("Chief complaint: Chest pain on exertion");
  await expect(page.getByText("No session notes were written, so nothing was added to the record.")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await context.close();
});

test("mocked: notes not allowed shows the panel read-only, with one line", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("active", { allow_notes: false, notes: null }) });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  const notes = page.getByRole("complementary", { name: "Session notes" });
  await expect(notes.getByRole("heading", { name: "Session notes" })).toBeVisible();
  await expect(notes).toContainText("Test did not allow notes for this session.");
  await expect(notes.getByRole("textbox")).toHaveCount(0);
  await expect(notes.getByRole("button", { name: "Save notes" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await context.close();
});

async function notesWidth(page: Page) {
  return page.getByRole("complementary", { name: "Session notes" }).evaluate((el) => Math.round(el.getBoundingClientRect().width));
}

test("mocked: the notes panel resizes by drag and by keyboard, and collapses to a strip", async ({ browser, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "The handle exists from 1024px");
  const { context, page } = await newDoctor(browser, { viewport: { width: 1440, height: 900 } });
  await mockPortal(page, { status: () => statusOf("active") });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  const handle = page.getByRole("separator", { name: /Resize session notes/ });
  await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  await expect(handle).toHaveAttribute("aria-valuenow", "300");
  expect(await notesWidth(page)).toBe(300);

  // Drag: 100px to the left makes the panel 100px wider.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "400");
  expect(await notesWidth(page)).toBe(400);

  // Drag it nearly shut: it snaps to the collapsed strip.
  const box2 = (await handle.boundingBox())!;
  await page.mouse.move(box2.x + 5, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + 5 + 330, box2.y + box2.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("button", { name: "Open session notes" })).toBeVisible();
  expect(await notesWidth(page)).toBe(56);

  // Keyboard: Enter opens, arrows move 24px, Enter closes.
  await handle.focus();
  await page.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-valuenow", "320");
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", "344");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "296");
  await expect(page.getByLabel("Chief complaint")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByLabel("Chief complaint")).toBeHidden();

  // The strip's button opens it again and focus moves to the panel's collapse button.
  await page.getByRole("button", { name: "Open session notes" }).click();
  await expect(page.getByRole("button", { name: "Collapse session notes" })).toBeFocused();
  await expect(page.getByLabel("Chief complaint")).toBeVisible();
  await page.getByRole("button", { name: "Collapse session notes" }).click();
  await expect(page.getByRole("button", { name: "Open session notes" })).toBeFocused();
  await expectNoAxeViolations(page);
  await context.close();
});

test("mocked: an ungranted view's URL shows Not shared and asks for nothing", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("active", { scope: { ...SCOPE, full_timeline: false } }) });
  await page.goto("/view/session/timeline");
  await expect(page.getByRole("heading", { level: 1, name: "Test Patient" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Full timeline" })).toBeVisible();
  await expect(page.getByText("Test did not share this part of the record.")).toBeVisible();
  await expect(page.getByText("Test infection")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(set.requested).not.toContain("full_timeline");
  await expectNoAxeViolations(page);
  await context.close();
});
