/**
 * Draws the home screen icons (PNG) from the favicon's "t" (src/app/icon.svg).
 * Run with `node scripts/make-icons.mjs` after changing the glyph or a colour.
 *
 *   patient app: white "t" on accent      (src/app/apple-icon.png, public/icons/trace-*.png)
 *   portal:      white "t" on ink         (src/app/view/apple-icon.png, public/icons/portal-*.png)
 *
 * Apple touch icons and "maskable" icons are full squares (the phone rounds
 * them itself; a transparent corner would turn black on iOS). The "any" icons
 * keep the favicon's rounded corners. The glyph sits inside the maskable safe
 * zone (the middle 80%) at every size.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACCENT = "#5468D4"; // --accent
const INK = "#14163A"; // --ink
const GLYPH = "M13 7v14.5a3.5 3.5 0 0 0 3.5 3.5H20M9 12.5h11";

const svg = (fill, rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">` +
  `<rect width="32" height="32" rx="${rounded ? 8 : 0}" fill="${fill}"/>` +
  `<path d="${GLYPH}" fill="none" stroke="#FFFFFF" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const jobs = [
  { out: "src/app/apple-icon.png", size: 180, fill: ACCENT, rounded: false },
  { out: "src/app/view/apple-icon.png", size: 180, fill: INK, rounded: false },
  { out: "public/icons/trace-192.png", size: 192, fill: ACCENT, rounded: true },
  { out: "public/icons/trace-512.png", size: 512, fill: ACCENT, rounded: true },
  { out: "public/icons/trace-maskable-512.png", size: 512, fill: ACCENT, rounded: false },
  { out: "public/icons/portal-192.png", size: 192, fill: INK, rounded: true },
  { out: "public/icons/portal-512.png", size: 512, fill: INK, rounded: true },
  { out: "public/icons/portal-maskable-512.png", size: 512, fill: INK, rounded: false },
];

const preinstalled = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(job.fill, job.rounded)}</body></html>`,
  );
  const file = path.join(root, job.out);
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(job.out);
}
await browser.close();
