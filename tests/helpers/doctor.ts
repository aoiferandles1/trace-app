import type { Browser, BrowserContext, Page } from "@playwright/test";
import { randomInt } from "node:crypto";

/**
 * The doctor's side in tests: a fresh browser context is a fresh portal
 * token (the httpOnly cookie), so lockouts never leak between tests.
 *
 * Code guesses are also capped per IP hash (20 an hour). Every doctor
 * context gets its own made-up X-Forwarded-For address from the 198.18.0.0/15
 * benchmarking range, so test runs never share an IP hash with each other or
 * with real use. (The portal hashes whatever IP the request reports; on
 * Vercel that header is set by the platform, not the browser.)
 */

export const DOCTOR = { name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" };

export function testIp(): string {
  return `198.${18 + randomInt(2)}.${randomInt(256)}.${1 + randomInt(254)}`;
}

export async function newDoctor(
  browser: Browser,
  opts: { remember?: boolean; viewport?: { width: number; height: number } } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    extraHTTPHeaders: { "x-forwarded-for": testIp() },
  });
  if (opts.remember !== false) {
    await context.addInitScript((c) => {
      window.localStorage.setItem("trace.portal.clinician", JSON.stringify(c));
    }, DOCTOR);
  }
  const page = await context.newPage();
  return { context, page };
}

/** From /view to the waiting screen with the given code. Assumes remembered details. */
export async function submitCode(page: Page, code: string) {
  await page.goto("/view");
  const input = page.getByRole("textbox", { name: "Patient's share code" });
  await input.fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}
