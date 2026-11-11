import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { DOCTOR, newDoctor } from "../helpers/doctor";
import { fakeRecord, mockPortal, statusOf } from "../helpers/portal-mocks";

/**
 * Portal screens and states that need no patient: the loading and name
 * steps, wrong and locked codes (against the real database, each with a
 * fresh portal token and its own test IP so nothing locks anyone else out),
 * the accordion, and, through mocked /api/portal responses, the states that
 * take real minutes to reach (expired code, request timed out, access paused,
 * ended by the patient or the timer). Runs at phone and desktop widths.
 */

test("name step: errors in words, remembered for next time", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { remember: false, viewport: viewport ?? undefined });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: "Who is asking?" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your name, as your patient knows you.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await expectNoAxeViolations(page);

  await page.getByLabel("Your name").fill("Dr Test");
  await page.getByLabel(/^Role/).fill("GP");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  await expect(page.getByText("Requesting as Dr Test, GP.")).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Dr Test");

  // Remembered: a reload skips the name step.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  await context.close();
});

test("loading screen shows first and passes axe", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await page.route("**/api/portal/status", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/view");
  await expect(page.getByRole("heading", { level: 1, name: /trace/ })).toBeVisible();
  await expect(page.getByText("Loading the portal")).toBeAttached();
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
    await page.getByRole("button", { name: /Continue|Try again/ }).click();
    const waiting = page.getByRole("heading", { name: "Waiting for patient to approve." });
    const wrong = page.getByRole("heading", { name: "That code doesn't match." });
    const locked = page.getByRole("heading", { name: "Too many attempts." });
    await expect(waiting.or(wrong).or(locked)).toBeVisible();
    if (await waiting.isVisible()) {
      await page.getByRole("button", { name: "Cancel request" }).click();
      test.skip(true, "A random guess matched a live code; cancelled it.");
    }
  }

  await guess("0000");
  await expect(page.getByText("Wrong code. 4 tries left before a 15 minute pause.")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("heading", { name: "That code doesn't match." })).toBeFocused();
  await expectNoAxeViolations(page);

  // "Try again" clears the boxes.
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();

  for (const code of ["0001", "0002", "0003", "0004"]) await guess(code);
  await expect(page.getByRole("heading", { name: "Too many attempts." })).toBeVisible();
  await expect(page.getByText(/Code entry is paused for this browser until \d{1,2}:\d\d\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter a new code" })).toBeDisabled();
  await expectNoAxeViolations(page);

  // Still locked after a reload: the database remembers the token.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Too many attempts." })).toBeVisible();
  await context.close();
});

test("the accordion opens each item and passes axe", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  const section = page.locator("#first-time");
  for (const name of ["How it works", "What you'll see", "For your practice", "Privacy and security"]) {
    const button = section.getByRole("button", { name });
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(section.getByRole("region", { name })).toBeVisible();
  }
  // One open at a time; the last one clicked is Privacy and security.
  await expect(section.getByRole("button", { name: "How it works" })).toHaveAttribute("aria-expanded", "false");
  await expect(section).toContainText("This is not end-to-end encryption.");
  await expectNoAxeViolations(page);

  // "Need help?" moves to the accordion.
  await page.getByRole("link", { name: "Need help?" }).click();
  await expect(section).toBeFocused();
  await context.close();
});

test("mocked: expired code", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, {
    status: () => statusOf("none"),
    code: () => ({ result: "expired", attempts_left: 4, locked_until: null, request_expires_at: null }),
  });
  await page.goto("/view");
  await page.getByRole("textbox", { name: "Patient's share code" }).fill("1234");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "This code has expired." })).toBeVisible();
  await expect(page.getByText("Codes last 5 minutes. Ask your patient for a new one.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Enter a new code" }).click();
  await expect(page.getByRole("textbox", { name: "Patient's share code" })).toBeFocused();
  await context.close();
});

test("mocked: the request times out while waiting", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const set = await mockPortal(page, { status: () => statusOf("requested") });
  await page.goto("/view");
  await expect(page.getByRole("heading", { name: "Waiting for patient to approve." })).toBeVisible();
  await expect(page.getByText(/Patient has [34]:\d\d to respond/)).toBeVisible();
  set({ status: () => statusOf("expired") });
  await expect(page.getByRole("heading", { name: "Your patient didn't answer in time." })).toBeVisible({ timeout: 5000 });
  await expectNoAxeViolations(page);
  await context.close();
});

test("mocked: access pauses, the record disappears, then comes back", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const active = { status: () => statusOf("active"), record: () => fakeRecord() };
  const set = await mockPortal(page, active);
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByText("Latex allergy").filter({ visible: true })).toBeVisible();

  set({ status: () => statusOf("paused"), record: () => null });
  await expect(page.getByRole("heading", { name: "Time's up on this share." })).toBeVisible({ timeout: 7000 });
  await expect(page.getByText("Latex allergy")).toHaveCount(0);
  await expect(page.getByText("Test Patient")).toHaveCount(0);
  await expect(page.getByText(/If nothing changes, the session closes at \d{1,2}:\d\d\./)).toBeVisible();
  // The doctor can still finish their notes.
  await expect(page.getByLabel("Chief complaint")).toBeEditable();
  await expectNoAxeViolations(page);

  set(active);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 7000 });
  await expect(page.getByText("Latex allergy").filter({ visible: true })).toBeVisible();
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
  await context.close();
});

test("mocked: no session on /view/session goes back to /view", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  await mockPortal(page, { status: () => statusOf("none") });
  await page.goto("/view/session");
  await expect(page).toHaveURL(/\/view$/);
  await expect(page.getByRole("heading", { name: "Enter the patient's code." })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(DOCTOR.name);
  await context.close();
});
