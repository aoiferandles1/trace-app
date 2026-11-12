import path from "node:path";
import { newDoctor, submitCode } from "../helpers/doctor";
import { expect, test } from "../helpers/portal-patient";

/**
 * Screenshots of the redesigned portal at the boards' size (1280 x 800),
 * against the local database (tests/support/local-supabase), for comparison with PortalEntryB, PortalWaitB
 * and PortalRecordE. Opt-in: E2E_SCREENS=1 (they overwrite the files in
 * docs/redesign/screens/after/). Desktop project only.
 */

const OUT = path.resolve(__dirname, "../../docs/redesign/screens/after");
const SIZE = { width: 1280, height: 800 };

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Desktop project only");
test.skip(!process.env.E2E_SCREENS, "Set E2E_SCREENS=1 to write the screenshots");

test("screens at 1280 x 800", async ({ browser, patient }) => {
  test.setTimeout(180_000);
  await patient.reset();
  const share = await patient.shareCode({ share_family_history: true, share_full_timeline: true, share_medication_notes: true });
  const { context, page } = await newDoctor(browser, { viewport: SIZE });
  const shot = async (name: string) => {
    await page.waitForTimeout(400);
    // The development build's corner badge is not part of the screen.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  };

  await page.goto("/view?demo=1");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Enter the patient's code" })).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 400 } });
  await shot("portal-enter-code");

  await submitCode(page, share.code);
  await expect(page.getByRole("heading", { name: "Waiting for the patient to approve" })).toBeVisible();
  await shot("portal-waiting");

  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(page.getByRole("heading", { level: 1, name: "Jane Doe" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Atrial fibrillation")).toBeVisible();
  await shot("portal-overview");

  const nav = page.getByRole("navigation", { name: "Patient record" });
  await nav.getByRole("link", { name: "Recent visits" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "GP visit" })).toBeVisible();
  await shot("portal-recent-visits");
  await page.getByRole("button", { name: /Blood count and INR/ }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Blood count and INR" })).toBeVisible();
  await shot("portal-recent-visits-result");

  await nav.getByRole("link", { name: "Medications" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Concerta" })).toBeVisible();
  await shot("portal-medications");

  await nav.getByRole("link", { name: "Full timeline" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Chest infection" })).toBeVisible();
  await shot("portal-full-timeline");

  await nav.getByRole("link", { name: "Care team" }).click();
  await expect(page.getByText("Dr O'Mahony")).toBeVisible();
  await shot("portal-care-team");

  await nav.getByRole("link", { name: "Family history" }).click();
  await expect(page.getByText("Contains other people's health information.")).toBeVisible();
  await shot("portal-family-history");

  await page.getByRole("radio", { name: "Heart" }).click();
  await shot("portal-family-history-heart");

  await page.getByRole("separator", { name: /Resize session notes/ }).focus();
  await page.keyboard.press("Enter");
  await nav.getByRole("link", { name: "Overview" }).click();
  await shot("portal-overview-notes-collapsed");

  await patient.end();
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 8_000 });
  await shot("portal-access-ended");
  await context.close();
});
