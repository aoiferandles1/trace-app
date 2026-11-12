import path from "node:path";
import { newDoctor, submitCode } from "../helpers/doctor";
import { expect, test } from "./helpers/patient";

/**
 * Screenshots of the redesigned patient app at the boards' size (390 x 844),
 * against the local database (its demo seed), for comparison with the phone boards (MainA2,
 * RecordA2, ShareA2, CodeA2, ApproveA2, SessionA2, MedsA2, MedDetailA2,
 * TimelineA2, FamilyA2, InsuranceA2). The sharing screens go through the real
 * loop with a doctor in a second browser. Opt-in: E2E_SCREENS=1 (they
 * overwrite the files in docs/redesign/screens/after/). Phone project only.
 */

const OUT = path.resolve(__dirname, "../../docs/redesign/screens/after");
const SIZE = { width: 390, height: 844 };

test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Phone project only");
test.skip(!process.env.E2E_SCREENS, "Set E2E_SCREENS=1 to write the screenshots");

test.use({ viewport: SIZE });

test("phone screens at 390 x 844", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const shot = async (name: string) => {
    await page.waitForTimeout(500);
    // The development build's corner badge is not part of the screen.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  };
  const h1 = (name: string | RegExp) => page.getByRole("heading", { level: 1, name });

  await page.goto("/home");
  await expect(h1(/Jane/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Share record/ })).toBeVisible();
  await shot("home");

  await page.goto("/record?tab=family");
  await expect(h1("Record")).toBeVisible();
  await expect(page.getByText("7 relatives")).toBeVisible();
  await shot("record");

  await page.goto("/meds");
  await expect(h1("Medications")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Concerta/ })).toBeVisible();
  await shot("medications");
  await page.getByRole("radio", { name: "Past" }).click();
  await expect(page.getByRole("link", { name: /^Doxycycline/ })).toBeVisible();
  await shot("medications-past");
  await page.getByRole("radio", { name: "Current" }).click();
  await page.getByRole("link", { name: /^Concerta/ }).click();
  await expect(h1("Concerta")).toBeVisible();
  await shot("concerta-detail");

  await page.goto("/record/timeline");
  await expect(h1("Timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: /Chest infection/ })).toBeVisible();
  await shot("full-timeline");
  await page.getByRole("button", { name: /Chest infection/ }).click();
  await expect(page.getByRole("dialog", { name: "Chest infection" })).toBeVisible();
  await page.waitForTimeout(300);
  await shot("full-timeline-sheet");

  await page.goto("/record/family");
  await expect(h1("Family history")).toBeVisible();
  await shot("family-tree");

  await page.goto("/profile/insurance");
  await expect(h1("Insurance")).toBeVisible();
  await expect(page.getByRole("button", { name: /VHI/ })).toBeVisible();
  await shot("insurance-choose");
  await page.getByRole("button", { name: /VHI/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("•••• 4821")).toBeVisible();
  await shot("insurance-connected");

  // Sharing: confirm, the code, the doctor's request, the session.
  await page.goto("/home");
  await page.getByRole("link", { name: /Share record/ }).click();
  await expect(h1("Share with Dr Hennessy")).toBeVisible();
  await shot("share-confirm");
  await page.getByRole("button", { name: "Create share code" }).click();
  await expect(h1("Share your record")).toBeVisible({ timeout: 15_000 });
  const code = (await page.getByText(/^Your code:/).textContent())!.replace(/\D/g, "");
  expect(code).toHaveLength(4);
  await shot("share-code");

  const doctor = await newDoctor(browser);
  await submitCode(doctor.page, code);
  await expect(page.getByRole("dialog", { name: /wants access/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await shot("approve-access");
  await page.getByRole("button", { name: "Allow access" }).click();
  await expect(h1("Dr Hennessy has access")).toBeVisible({ timeout: 20_000 });
  await shot("session-active");

  await page.getByRole("button", { name: "End sharing now" }).click();

  // It asks once before ending (A17).

  await page.getByRole("dialog", { name: "End sharing now?" }).getByRole("button", { name: "End sharing" }).click();
  await page.waitForURL(/\/home/, { timeout: 20_000 });
  await doctor.context.close();
});
