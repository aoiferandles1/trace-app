import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

/**
 * Trace on a phone's home screen: the two manifests (the patient app and the
 * doctor's portal are two apps), the tags iOS reads, the icons, and /demo on
 * a phone, where there is no framed phone, only a way into each side.
 *
 * None of this talks to the database, so the file needs no demo sign-in.
 */

type Manifest = {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; purpose?: string }[];
};

for (const app of [
  { page: "/", manifest: "/manifest.webmanifest", name: "Trace", start: "/", touchIcon: /^\/apple-icon\.png/ },
  { page: "/view", manifest: "/view/manifest.webmanifest", name: "Trace Portal", start: "/view", touchIcon: /^\/view\/apple-icon\.png/ },
]) {
  test(`${app.page} can be saved to a home screen as "${app.name}"`, async ({ page, request }) => {
    await page.goto(app.page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", app.manifest);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", app.name);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", app.touchIcon);

    const res = await request.get(app.manifest);
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as Manifest;
    expect(manifest.short_name).toBe(app.name);
    expect(manifest.start_url).toBe(app.start);
    expect(manifest.scope).toBe(app.start);
    expect(manifest.display).toBe("standalone");
    // Chrome asks for a 192 and a 512; Android masks the maskable one.
    expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`).sort()).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
    for (const icon of manifest.icons) {
      const png = await request.get(icon.src);
      expect(png.ok(), icon.src).toBe(true);
      expect(png.headers()["content-type"]).toBe("image/png");
    }
    const touch = await request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"))!);
    expect(touch.ok()).toBe(true);
  });
}

test("the tab bar clears the home indicator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A phone with a 34px home indicator (env(safe-area-inset-bottom) is 0 in a desktop browser).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 34 } });
  await page.goto("/kit/patient");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav).toBeVisible();
  expect(await nav.evaluate((el) => getComputedStyle(el).paddingBottom)).toBe("34px");
});

test("/demo on a phone: no framed phone, a way into each side", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1, name: "Try both sides of a GP visit" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "How to try it" }).getByRole("listitem")).toHaveCount(3);

  const patient = page.getByRole("link", { name: /^Open Jane's app/ });
  await expect(patient).toHaveAttribute("href", "/");
  await expect(patient).toHaveAttribute("target", "trace-patient");
  const portal = page.getByRole("link", { name: /^Open the doctor's portal/ });
  await expect(portal).toHaveAttribute("href", "/view?demo=1");
  await expect(portal).toHaveAttribute("target", "trace-portal");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);

  // 320px: still one column, nothing cut off.
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(portal).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("/demo from 700px keeps the framed phone", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.goto("/demo");
  await expect(page.locator('iframe[title="Patient app, on a phone"]')).toBeVisible();
  await expect(page.getByRole("link", { name: /^Open the doctor's portal/ })).toHaveAttribute("target", "_blank");
});

test("/demo: the laptop frame only from 1280, drawn at the portal's desktop width (H2, H3)", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/demo");
  await expect(page.locator('iframe[title="Patient app, on a phone"]')).toBeVisible();
  await expect(page.locator('iframe[title="Doctor\'s portal, on a laptop"]')).toHaveCount(0);
  await expect(page.getByText("tap Allow access on the phone", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  const laptop = page.locator('iframe[title="Doctor\'s portal, on a laptop"]');
  await expect(laptop).toBeVisible();
  await expect(laptop).toHaveAttribute("style", /width: 1024px/);
  // Scaled to at least 70%, so the portal's 13px text stays above 9px.
  const scale = await laptop.evaluate((el) => el.getBoundingClientRect().width / 1024);
  expect(scale).toBeGreaterThan(0.7);
});
