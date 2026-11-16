import path from "node:path";
import type { Page } from "@playwright/test";
import { LOCAL_ENV } from "../support/local-env";
import { DOCTOR, testIp } from "../helpers/doctor";
import { expect, test } from "./helpers/patient";

/**
 * Screenshots for the Trace case study on Aoife's portfolio (aoiferandles.com/trace/),
 * at 2x: the phone at 390 x 844 (780 x 1688 files, the size of the case study's
 * Figma exports), the portal and the patient app on a computer at 1680 x 1050 (a full laptop screen, so the screenshots read at normal scale).
 * One GP visit through the real loop: the patient on the phone, the doctor in a
 * second browser. Opt-in: E2E_PORTFOLIO_OUT=<folder> (PNGs, written there; the
 * portfolio converts them to WebP). Phone project only.
 *
 *   E2E_PORTFOLIO_OUT=/some/folder npx playwright test portfolio-shots --project=phone
 */

const OUT = process.env.E2E_PORTFOLIO_OUT ?? "";
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1680, height: 1050 };

test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Phone project only");
test.skip(!OUT, "Set E2E_PORTFOLIO_OUT=<folder> to write the screenshots");

function shooter(page: Page) {
  return async (name: string) => {
    await page.waitForTimeout(500);
    // The development build's corner badge is not part of the screen.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    // The test server's address, as the real one reads (the share code screen names the portal's address).
    await page.evaluate((site) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.nodeValue?.includes(site)) n.nodeValue = n.nodeValue.replaceAll(site, "trace.aoiferandles.com");
      }
    }, new URL(LOCAL_ENV.NEXT_PUBLIC_SITE_URL).host);
    await page.screenshot({ path: path.join(path.resolve(OUT), `${name}.png`) });
  };
}

test("the case study's screens", async ({ browser, demo }) => {
  test.setTimeout(300_000);
  const patientCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, storageState: demo.storageState });
  const page = await patientCtx.newPage();
  const shot = shooter(page);
  const h1 = (name: string | RegExp) => page.getByRole("heading", { level: 1, name });

  // The phone, around the record.
  await page.goto("/record");
  await expect(h1("Record")).toBeVisible({ timeout: 20_000 });
  await shot("record");
  await page.goto("/meds");
  await expect(page.getByRole("link", { name: /^Concerta/ })).toBeVisible({ timeout: 20_000 });
  await shot("medications");
  await page.getByRole("link", { name: /^Concerta/ }).click();
  await expect(h1("Concerta")).toBeVisible();
  await shot("concerta-detail");
  await page.goto("/record/timeline");
  await expect(page.getByRole("button", { name: /Chest infection/ })).toBeVisible({ timeout: 20_000 });
  await shot("full-timeline");
  await page.getByRole("button", { name: /Chest infection/ }).click();
  await expect(page.getByRole("dialog", { name: "Chest infection" })).toBeVisible();
  await page.waitForTimeout(300);
  await shot("full-timeline-sheet");
  await page.goto("/record/family");
  await expect(h1("Family history")).toBeVisible({ timeout: 20_000 });
  await shot("family-tree");
  await page.goto("/profile/documents");
  await expect(h1("Documents")).toBeVisible({ timeout: 20_000 });
  await shot("documents");

  // The GP visit, both sides. Home on the day of the visit.
  await page.goto("/home");
  await expect(h1(/Jane/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Share record/ }).first()).toBeVisible();
  await shot("home-visit-day");

  const doctorCtx = await browser.newContext({
    viewport: WIDE,
    deviceScaleFactor: 2,
    extraHTTPHeaders: { "x-forwarded-for": testIp() },
  });
  const doc = await doctorCtx.newPage();
  const docShot = shooter(doc);
  await doc.goto("/view");
  await expect(doc.getByRole("textbox", { name: /name/i }).first()).toBeVisible({ timeout: 20_000 });
  await docShot("portal-name");
  await doctorCtx.addInitScript((c) => {
    window.localStorage.setItem("trace.portal.clinician", JSON.stringify(c));
  }, DOCTOR);

  await page.getByRole("link", { name: /Share record/ }).first().click();
  await expect(h1("Share with Dr Hennessy")).toBeVisible();
  // Family history on too, so the doctor's tree can be shown.
  await page.getByRole("switch", { name: /Family history/ }).click();
  await shot("share-confirm");
  await page.getByRole("button", { name: "Create share code" }).click();
  await expect(page.getByText(/^Your code:/)).toBeVisible({ timeout: 15_000 });
  const code = (await page.getByText(/^Your code:/).textContent())!.replace(/\D/g, "");
  expect(code).toHaveLength(4);
  await shot("share-code");

  await doc.goto("/view");
  await expect(doc.getByRole("heading", { name: "Enter the patient's code" })).toBeVisible({ timeout: 20_000 });
  await doc.locator("body").click({ position: { x: 5, y: 400 } });
  await docShot("portal-enter-code");
  await doc.getByRole("textbox", { name: "Patient's share code" }).fill(code);
  await expect(doc.getByRole("heading", { name: "Waiting for the patient to approve" })).toBeVisible({ timeout: 15_000 });
  await docShot("portal-waiting");

  await expect(page.getByRole("dialog", { name: /wants access/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await shot("approve-access");
  await page.getByRole("button", { name: "Allow access" }).click();
  await expect(h1("Dr Hennessy has access")).toBeVisible({ timeout: 20_000 });
  await shot("session-active");

  await expect(doc.getByRole("heading", { level: 1, name: "Jane Doe" })).toBeVisible({ timeout: 20_000 });
  await expect(doc.getByText("Atrial fibrillation")).toBeVisible();
  await docShot("portal-overview");
  const nav = doc.getByRole("navigation", { name: "Patient record" });
  await nav.getByRole("link", { name: "Recent visits" }).click();
  await doc.getByRole("button", { name: /Blood count and INR/ }).click();
  await expect(doc.getByRole("heading", { level: 3, name: "Blood count and INR" })).toBeVisible();
  await docShot("portal-recent-visits-result");
  await nav.getByRole("link", { name: "Medications" }).click();
  await expect(doc.getByRole("heading", { level: 3, name: "Concerta" })).toBeVisible();
  await docShot("portal-medications");
  await nav.getByRole("link", { name: "Full timeline" }).click();
  await expect(doc.getByRole("heading", { level: 3, name: "Chest infection" })).toBeVisible();
  await docShot("portal-full-timeline");
  await nav.getByRole("link", { name: "Family history" }).click();
  await expect(doc.getByText("Contains other people's health information.")).toBeVisible();
  await doc.getByRole("radio", { name: "Heart" }).click();
  await docShot("portal-family-history-heart");
  await nav.getByRole("link", { name: "Overview" }).click();
  await expect(doc.getByText("Mild asthma").filter({ visible: true }).first()).toBeVisible();

  // The patient's Home while the doctor has access.
  await page.goto("/home");
  await expect(h1(/Jane/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/has access/).first()).toBeVisible({ timeout: 20_000 });
  await shot("home-live");

  // The patient ends it: both sides at once.
  await page.goto("/session");
  await expect(h1("Dr Hennessy has access")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "End sharing now" }).click();
  await page.getByRole("dialog", { name: "End sharing now?" }).getByRole("button", { name: "End sharing" }).click();
  await page.waitForURL(/\/home/, { timeout: 20_000 });
  await expect(page.getByText(/no longer has access/).first()).toBeVisible({ timeout: 20_000 });
  await shot("home-ended");
  await page.getByRole("link", { name: "View summary" }).first().click();
  await expect(h1(/ended/i)).toBeVisible({ timeout: 20_000 });
  await shot("session-ended");
  await expect(doc.getByRole("heading", { name: /ended the session/ })).toBeVisible({ timeout: 20_000 });
  await docShot("portal-access-ended");
  await doctorCtx.close();

  // An ordinary day: the visit moves to tomorrow, so Home shows the share card and today's medicines.
  const { error } = await demo.db
    .from("entries")
    .update({ occurs_at: new Date(Date.now() + 86_400_000).toISOString() })
    .eq("id", demo.appointmentEntryId);
  expect(error).toBeNull();
  await page.goto("/home");
  await expect(page.getByText("Today's medicines")).toBeVisible({ timeout: 20_000 });
  await shot("home-everyday");
  await page.getByRole("button", { name: /^Add/ }).last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(400);
  await shot("add-sheet");
  await patientCtx.close();

  // The patient app on a computer.
  const deskCtx = await browser.newContext({ viewport: WIDE, deviceScaleFactor: 2, storageState: demo.storageState });
  const desk = await deskCtx.newPage();
  const deskShot = shooter(desk);
  await desk.goto("/meds");
  await desk.getByRole("link", { name: /^Concerta/ }).first().click();
  await expect(desk.getByRole("heading", { level: 1, name: "Concerta" })).toBeVisible({ timeout: 20_000 });
  await deskShot("desktop-medications");
  await desk.goto("/record/timeline");
  await desk.getByRole("button", { name: /Chest infection/ }).first().click();
  await expect(desk.getByRole("heading", { name: "Chest infection" }).first()).toBeVisible({ timeout: 20_000 });
  await deskShot("desktop-timeline");
  await desk.goto("/home");
  await expect(desk.getByRole("heading", { level: 1, name: /Jane/ })).toBeVisible({ timeout: 20_000 });
  await deskShot("desktop-home");
  await deskCtx.close();
});
