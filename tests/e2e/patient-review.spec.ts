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
  await page.getByRole("link", { name: "Share your record" }).click();
  const create = page.getByRole("button", { name: "Create share code" });
  await create.click();
  await expect(page.getByRole("button", { name: /Your code: \d \d \d \d\. Copy it/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to what you share" }).click();
  await expect(create).toBeVisible();
  await expect(create).toBeEnabled();
  await expect(create).not.toHaveAttribute("aria-busy", "true");
  // The live code is pointed to, and a new one replaces it.
  await expect(page.getByText(/still works/)).toBeVisible();
  await create.click();
  await expect(page.getByRole("button", { name: /Your code: \d \d \d \d\. Copy it/ })).toBeVisible({ timeout: 20_000 });
  await expectNoAxeViolations(page);
  await clientFor(file).rpc("end_session");
});

test("F1: log vitals, see them listed, edit them; axe on the new screens", async ({ page }) => {
  await page.goto("/record");
  await page.getByRole("link", { name: "Vitals" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vitals" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Log vitals" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log vitals" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save vitals" }).click();
  await expect(page.getByText("Enter at least one reading.")).toBeVisible();
  await page.getByRole("textbox", { name: /top number/ }).fill("1288");
  await page.getByRole("textbox", { name: /bottom number/ }).fill("82");
  await page.getByRole("button", { name: "Save vitals" }).click();
  await expect(page.getByText("Enter a number from 50 to 260, no decimals.")).toBeVisible();
  await page.getByRole("textbox", { name: /top number/ }).fill("124");
  await page.getByRole("textbox", { name: /Heart rate/ }).fill("70");
  await page.getByRole("button", { name: "Save vitals" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vitals" })).toBeVisible();
  const readings = page.getByRole("list", { name: "Readings" });
  await expect(readings.getByRole("link").first()).toHaveText(/124\/82, heart rate 70/);
  await readings.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit vitals" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /top number/ })).toHaveValue("124");
  await expectNoAxeViolations(page);
});

test("F3: search the record by word and by kind", async ({ page }) => {
  await page.goto("/record");
  await page.getByRole("link", { name: "Search your record" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Search your record" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("searchbox", { name: "Search" }).fill("warfarin");
  const matches = page.getByRole("list", { name: "Matches" });
  await expect(matches.getByRole("link", { name: /^Warfarin/ }).first()).toBeVisible();
  await page.getByRole("radio", { name: "Medications" }).click();
  await expect(matches.getByRole("link")).toHaveCount(1);
  await matches.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Warfarin" })).toBeVisible();
});

test("A3: an empty Add a relative chooses nobody, and a second Mum is refused", async ({ page }) => {
  await page.goto("/record/family");
  await page.getByRole("link", { name: "Add a relative" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a relative" })).toBeVisible();
  await page.getByRole("button", { name: "Save relative" }).click();
  await expect(page.getByText("Choose who this is.")).toBeVisible();
  await page.getByRole("combobox", { name: "Who" }).selectOption("mother");
  // A typed condition name suggests its group (B14).
  await page.getByRole("textbox", { name: "Condition 1" }).fill("Heart attack");
  await expect(page.getByRole("combobox", { name: "Group" })).toHaveValue("heart");
  await page.getByRole("button", { name: "Save relative" }).click();
  await expect(page.getByText("Mum is already in your family history. Edit Mum there instead.")).toBeVisible();
});

test("A6: a strength change logged by mistake can be undone", async ({ page }) => {
  const db = clientFor(file);
  const med = (await db.from("medications").select("id").eq("name", "Levothyroxine").single()).data!.id;
  await page.goto(`/meds/${med}`);
  await expect(page.getByRole("heading", { level: 1, name: "Levothyroxine" })).toBeVisible();
  await expect(page.getByText(/^Now 50mcg/)).toBeVisible();
  await page.getByRole("button", { name: "Undo this change" }).click();
  const sheet = page.getByRole("dialog", { name: "Undo the change to 50mcg?" });
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Undo change" }).click();
  await expect(page.getByText(/^Now 25mcg/)).toBeVisible();
  // Every field the form takes is on the screen (A7).
  await expect(page.getByRole("term")).toContainText(["How often"]);
});

test("A39: a photo over 3 MB is made smaller before upload", async ({ page }) => {
  await page.goto("/profile/documents/upload");
  await expect(page.getByRole("heading", { level: 1, name: "Upload a document" })).toBeVisible();
  // A real 1 x 1 PNG padded past 3 MB (the bytes after the image are ignored by the decoder).
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .getByLabel("File", { exact: true })
    .setInputFiles({ name: "phone photo.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]) });
  await expect(page.getByText(/^JPEG, \d+ KB, made smaller from 3 MB$/)).toBeVisible();
});

test("H6, E28, B23: the demo strip opens the doctor's side; Profile has no middle dots; demo sign out asks first", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Open the doctor's side" })).toHaveAttribute("href", "/view?demo=1");
  await expect(page.getByText(/·/)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign out of the demo?" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Stay in the demo" }).click();
  await expect(sheet).toBeHidden();
});

test("F10, F4: the printable record and the email screen", async ({ page }) => {
  await page.goto("/profile/privacy");
  await page.getByRole("link", { name: /Print your record/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your record to print" })).toBeVisible();
  await expect(page.getByText(/^Warfarin 5mg/)).toBeVisible();
  await expectNoAxeViolations(page);
  // A demo has no email to change.
  await page.goto("/profile/email");
  await expect(page.getByRole("heading", { level: 1, name: "Change email" })).toBeVisible();
  await expect(page.getByText("The demo has no email to change.")).toBeVisible();
  await expectNoAxeViolations(page);
});
