import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

/**
 * Acceptance check for the UI kit (Phase 1): /kit and the two shell demos
 * pass axe at phone and desktop widths, the page does not scroll sideways,
 * and the access request sheet behaves as a modal dialog.
 */

test.describe("UI kit", () => {
  test("/kit has no axe violations", async ({ page }) => {
    await page.goto("/kit");
    await expect(page.getByRole("heading", { level: 1, name: "UI kit" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("/kit/patient has no axe violations", async ({ page }) => {
    await page.goto("/kit/patient");
    await expect(page.getByRole("heading", { level: 1, name: "Record" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("/kit/portal has no axe violations", async ({ page }) => {
    await page.goto("/kit/portal");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("no horizontal scroll", async ({ page }) => {
    for (const path of ["/kit", "/kit/patient", "/kit/portal"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test("access request sheet is a modal that traps and returns focus", async ({ page }) => {
    await page.goto("/kit");
    const opener = page.getByRole("button", { name: "Open the access request" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Dr Hennessy wants access" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page, "dialog");

    // Focus is inside the dialog, and Tab cannot leave it.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")));
      expect(inside).toBe(true);
    }

    // Escape does nothing: the patient must answer.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Deny access" }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.getByText("Last answer: denied")).toBeVisible();
  });

  test("code input is one field that accepts a pasted code", async ({ page }) => {
    await page.goto("/kit");
    const input = page.getByRole("textbox", { name: "Patient's share code" });
    await input.focus();
    await input.fill("72a94");
    await expect(input).toHaveValue("7294");
    await expect(input).toHaveAttribute("inputmode", "numeric");
  });

  test("switch rows toggle from the label", async ({ page }) => {
    await page.goto("/kit");
    const sw = page.getByRole("switch", { name: "Mental health history" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await page.getByText("Mental health history", { exact: true }).click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
  });
});
