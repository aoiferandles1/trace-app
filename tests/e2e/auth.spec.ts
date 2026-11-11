import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { expectNoSideScroll } from "./helpers/patient";

/**
 * Phase 3 screens that need no account: welcome, the email and code steps,
 * sign in, terms, the link routes, and the redirects for signed-out visitors.
 *
 * No test sends a sign-in email. The only addresses typed are at example.com
 * (reserved, never delivered), and Supabase refuses them before sending: the
 * invite trigger refuses the sign-up, and sign in never creates an account.
 */

test.describe("Welcome and sign-up, signed out", () => {
  test("welcome screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your health record, owned by you." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your record" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "I already have an account" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
    await expect(page.getByText("Trace is a portfolio project by Aoife Randles, not a medical service.")).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoSideScroll(page);
  });

  test("email step checks the address and refuses an uninvited one", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1, name: "What's your email address?" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Sign-up progress" })).toHaveAttribute("aria-valuetext", "Step 1 of 7");
    await expectNoAxeViolations(page);

    const email = page.getByRole("textbox", { name: "Email address" });
    await email.fill("not an email");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter an email address like name@example.ie")).toBeVisible();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");

    await email.fill("not-invited@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Trace is invite-only for now.")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/signup$/);
    await expectNoAxeViolations(page);
  });

  test("code step shows six boxes as one field, and needs an email first", async ({ page }) => {
    await page.goto("/signup/verify");
    await page.waitForURL(/\/signup$/);

    await page.evaluate(() => sessionStorage.setItem("trace:pending-email", "someone@example.com"));
    await page.goto("/signup/verify");
    await expect(page.getByRole("heading", { level: 1, name: "Check your email." })).toBeVisible();
    await expect(page.getByText("We sent a 6-digit code to someone@example.com")).toBeVisible();
    await expect(page.getByText("Or open the link in the email on this device.")).toBeVisible();
    const code = page.getByRole("textbox", { name: "6-digit code" });
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");
    await expect(code).toHaveAttribute("inputmode", "numeric");
    await expect(page.getByRole("button", { name: "Didn't get it? Resend code" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoSideScroll(page);
  });

  test("sign in refuses an email with no account", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back." })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("textbox", { name: "Email address" }).fill("no-account@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/We couldn't find an account for that email|Trace is invite-only for now\./),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("terms and the link pages", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto("/auth/confirm");
    await page.waitForURL(/\/auth\/link-expired$/);
    await expect(page.getByRole("heading", { level: 1, name: "That link didn't work." })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email");
    await page.waitForURL(/\/auth\/link-expired$/);
  });

  test("signed-out visitors are sent away from the record and the later steps", async ({ page }) => {
    for (const path of ["/home", "/record", "/meds", "/add/note", "/profile"]) {
      await page.goto(path);
      await page.waitForURL((url) => url.pathname === "/");
    }
    await page.goto("/signup/about");
    await page.waitForURL((url) => url.pathname === "/signup");
  });
});
