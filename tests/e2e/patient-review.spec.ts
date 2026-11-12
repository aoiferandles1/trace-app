import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { clientFor, reseed, signInDemoOnce, statePath } from "./helpers/patient";

/**
 * Fixes from the November 2026 review of the patient app, driven the way the
 * bugs showed up: by clicking through the app (client-side navigation), so
 * Next.js keeps earlier screens alive and hidden with their state.
 *
 * Phone project only, with its own demo user (reused while its token works).
 */

test.describe.configure({ mode: "default" });

let file = "";

test.beforeAll(async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "Phone project only: one demo sign-in");
  file = statePath(`review-${info.project.name}`);
  await signInDemoOnce(browser, file, info.project.use.baseURL!);
});

test.use({ storageState: async ({}, provide) => provide(file) });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "phone", "Phone project only");
  await reseed(clientFor(file));
});

/** The tab bar's Home (a dispatched click: in dev, Next's indicator sits over that corner at 390). */
async function goHome(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).dispatchEvent("click");
  await expect(page.getByRole("heading", { level: 1, name: /^Good / })).toBeVisible();
}

async function openAdd(page: Page, row: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: row }).click();
  await expect(page.getByRole("heading", { level: 1, name: row })).toBeVisible();
}

test("A1/A2: a form opened again after a save is empty and not busy", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });

  await openAdd(page, "Add a condition");
  await page.getByRole("textbox", { name: "Condition" }).fill("Migraine");
  await page.getByRole("button", { name: "Save condition" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Record" })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Migraine")).toBeVisible();

  // Back to Home by the tab bar, then the same form again.
  await goHome(page);
  await openAdd(page, "Add a condition");
  await expect(page.getByRole("textbox", { name: "Condition" })).toHaveValue("");
  const save = page.getByRole("button", { name: "Save condition" });
  await expect(save).toBeEnabled();
  await expect(save).not.toHaveAttribute("aria-busy", "true");
  await page.getByRole("textbox", { name: "Condition" }).fill("Eczema");
  await save.click();
  await expect(page.getByRole("tabpanel").getByText("Eczema")).toBeVisible();

  // A medication: the form that used to reopen holding the last one.
  await goHome(page);
  await openAdd(page, "Add a medication");
  await page.getByRole("textbox", { name: "Name" }).fill("Ibuprofen");
  await page.getByRole("button", { name: "Save medication" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Medications" })).toBeVisible();
  await goHome(page);
  await openAdd(page, "Add a medication");
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save medication" })).not.toHaveAttribute("aria-busy", "true");

  // Browser Back after a save does not return to the filled form (B13).
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Add a medication" })).toHaveCount(0);
});

test("A1: an edit form opened again shows the saved values", async ({ page }) => {
  await page.goto("/record?tab=conditions");
  await page.getByRole("link", { name: /Mild asthma/ }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Condition" }).fill("Asthma");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Asthma" })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("textbox", { name: "Condition" })).toHaveValue("Asthma");
  await page.getByRole("textbox", { name: "Condition" }).fill("Mild asthma");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mild asthma" })).toBeVisible();
});

test("A11: Create share code works again after Back from the code", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Share my record" }).click();
  const create = page.getByRole("button", { name: "Create share code" });
  await create.click();
  await expect(page.getByRole("button", { name: /Your code: .*Copy it/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to what you share" }).click();
  await expect(create).toBeVisible();
  await expect(create).toBeEnabled();
  await expect(create).not.toHaveAttribute("aria-busy", "true");
  // The live code is pointed to, and a new one replaces it.
  await expect(page.getByText(/still works/)).toBeVisible();
  await create.click();
  await expect(page.getByRole("button", { name: /Your code: .*Copy it/ })).toBeVisible({ timeout: 20_000 });
  await expectNoAxeViolations(page);
  await clientFor(file).rpc("end_session");
});
