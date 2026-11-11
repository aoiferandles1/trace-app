import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { clientFor, deleteUser, expectNoSideScroll, reseed, signInDemo, statePath } from "./helpers/patient";
import { newDoctor } from "../helpers/doctor";
import { mockPortal, SCOPE, statusOf } from "../helpers/portal-mocks";

/**
 * Accessibility beyond one axe run per screen (PLAN.md section 10):
 *
 * - Reflow: every screen of both apps at 320 CSS pixels wide (what a 1280px
 *   window shows at 400% zoom, and stricter than 200%) with no sideways
 *   scrolling, and axe at that width.
 * - Keyboard: Tab through each screen once round. Every stop must be visible
 *   on screen with a focus ring, and no ring may be clipped by a parent that
 *   hides its overflow.
 *
 * One demo patient for the file (sign-ins are capped), desktop project only;
 * each test sets its own viewport.
 */

test.describe.configure({ mode: "serial" });

const NARROW = { width: 320, height: 640 };
let file = "";

test.beforeAll(async ({ browser }, info) => {
  if ((info.project.use.viewport?.width ?? 0) < 1024) return;
  file = statePath(`a11y-${info.project.name}`);
  await signInDemo(browser, file, info.project.use.baseURL!);
  await reseed(clientFor(file));
});

test.afterAll(async () => {
  if (file) await deleteUser(file);
});

test.use({ storageState: async ({}, provide) => provide(file || undefined!) });

test.beforeEach(async ({}, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "Runs once, in the desktop project");
});

type Stop = { tag: string; name: string; problem: string };

/**
 * Presses Tab until focus comes back round (or `max` presses) and returns
 * every stop that breaks a rule.
 */
async function walkKeyboard(page: Page, max = 60): Promise<{ stops: number; problems: Stop[] }> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen = new Set<string>();
  const problems: Stop[] = [];
  let stops = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return { lost: true } as const;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      const outline = css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0;
      // Text fields show focus as a 2px indigo border (the Figma field's focused state) instead of an outline.
      const field = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && css.boxShadow !== "none";
      // CodeInput: one transparent input over boxes that draw the digits; the active box carries the ring.
      const boxes = css.opacity === "0" ? el.parentElement?.querySelector('[aria-hidden="true"]') : null;
      const drawn = Boolean(boxes && [...boxes.children].some((c) => getComputedStyle(c).outlineStyle !== "none"));
      const ring = outline || field || drawn;
      const offset = parseFloat(css.outlineOffset) || 0;
      const reach = outline ? Math.max(0, parseFloat(css.outlineWidth) + offset) : 0;
      let clippedBy = "";
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const pc = getComputedStyle(p);
        if (pc.overflowX === "visible" && pc.overflowY === "visible") continue;
        if (p.tagName === "DIALOG" || p.tagName === "MAIN") continue;
        const pr = p.getBoundingClientRect();
        // Scrolling containers clip too, but only on the axis they hide.
        const hideX = pc.overflowX !== "visible";
        const hideY = pc.overflowY !== "visible";
        if (
          (hideX && (r.left - reach < pr.left - 0.5 || r.right + reach > pr.right + 0.5)) ||
          (hideY && (r.top - reach < pr.top - 0.5 || r.bottom + reach > pr.bottom + 0.5))
        ) {
          clippedBy = `${p.tagName.toLowerCase()}.${String(p.className).split(" ").slice(0, 3).join(".")}`;
          break;
        }
      }
      return {
        lost: false,
        key: `${el.tagName}#${el.id}|${el.getAttribute("href") ?? ""}|${(el.textContent ?? "").trim().slice(0, 40)}|${Math.round(r.top + window.scrollY)}`,
        tag: el.tagName.toLowerCase(),
        name: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 50),
        visible: r.width > 0 && r.height > 0 && css.visibility !== "hidden",
        ring,
        clippedBy,
      } as const;
    });
    // Past the last stop, Tab leaves the page for the browser's own controls: one full round done.
    if (info.lost) break;
    // The Next.js development overlay's button (not in production builds).
    if (info.tag === "nextjs-portal") continue;
    if (seen.has(info.key)) break;
    seen.add(info.key);
    stops++;
    if (!info.visible) problems.push({ tag: info.tag, name: info.name, problem: "focused but not visible" });
    else if (!info.ring) problems.push({ tag: info.tag, name: info.name, problem: "no focus ring" });
    else if (info.clippedBy) problems.push({ tag: info.tag, name: info.name, problem: `ring clipped by ${info.clippedBy}` });
  }
  return { stops, problems };
}

async function checkScreen(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300); // transitions settle before axe measures contrast
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  const { stops, problems } = await walkKeyboard(page);
  expect(problems, `${path}: ${JSON.stringify(problems, null, 2)}`).toEqual([]);
  expect(stops, `${path}: nothing to Tab to`).toBeGreaterThan(0);
}

test("patient app: every screen reflows at 320px and works with the keyboard", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(NARROW);
  const db = clientFor(file);
  const entry = (await db.from("entries").select("id").eq("kind", "result").limit(1).single()).data!.id;
  const condition = (await db.from("conditions").select("id").limit(1).single()).data!.id;
  const med = (await db.from("medications").select("id").limit(1).single()).data!.id;
  const person = (await db.from("care_team").select("id").limit(1).single()).data!.id;

  const screens: [string, string | RegExp][] = [
    ["/home", /^Good (morning|afternoon|evening), Jane$/],
    ["/record", "Record"],
    [`/record/${entry}`, "Result"],
    [`/record/${entry}/edit`, /^Edit/],
    [`/record/conditions/${condition}`, "Condition"],
    [`/record/conditions/${condition}/edit`, /^Edit/],
    ["/record/conditions/new", /condition/i],
    ["/meds", "My medication"],
    [`/meds/${med}/edit`, /^Edit/],
    ["/add", "Add to my record"],
    ["/add/note", "Write a note"],
    ["/add/appointment", "Log appointment"],
    ["/add/medication", /medication/i],
    ["/profile", "My profile"],
    ["/profile/edit", /^Edit/],
    ["/profile/care-team/new", /care team/i],
    [`/profile/care-team/${person}`, /./],
    ["/access-log", "Access log"],
    ["/share", "Share Record"],
    ["/terms", "Terms"],
  ];
  for (const [path, heading] of screens) await checkScreen(page, path, heading);
});

test("patient app: the share loop screens at 320px, and the request sheet with the keyboard alone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(NARROW);
  await checkScreen(page, "/share", "Share Record");
  await page.getByRole("button", { name: "Generate share code" }).click();
  await page.waitForURL(/\/share\/code$/);
  await expect(page.getByRole("heading", { name: "Your code is ready." })).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  expect((await walkKeyboard(page)).problems).toEqual([]);

  // A doctor asks (through the database, as a portal would); the sheet opens over this screen.
  const code = (await page.getByText(/^Your code: \d \d \d \d$/).textContent())!.replace(/\D/g, "");
  const { context, page: doctor } = await newDoctor(page.context().browser()!);
  await doctor.goto("/view");
  await doctor.getByRole("textbox", { name: "Patient's share code" }).fill(code);
  await doctor.getByRole("button", { name: "Continue" }).click();
  const sheet = page.getByRole("dialog", { name: "Dr Hennessy wants access" });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await expect(sheet.locator("#access-request-body")).toBeFocused();
  await expectNoSideScroll(page);

  // Keyboard alone: Tab reaches Allow then Deny, wraps inside the sheet, and Escape does nothing.
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Allow access" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Deny", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveCount(1);
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Allow access" }).focus();
  await page.keyboard.press("Enter");

  await page.waitForURL(/\/session$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dr Hennessy has access" })).toBeVisible();
  // What a screen reader is told: the polite region, once.
  await expect(page.locator('[role="status"][aria-live="polite"]').last()).toHaveText(
    "Sharing started. Dr Hennessy can see your record.",
  );
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  expect((await walkKeyboard(page)).problems).toEqual([]);

  await page.getByRole("button", { name: "End sharing now" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/ended\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: "Session ended" })).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]').last()).toHaveText(
    "Sharing ended. Dr Hennessy no longer has access to your record.",
  );
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  expect((await walkKeyboard(page)).problems).toEqual([]);
  await context.close();
});

test("portal: every screen reflows at 320px and works with the keyboard (stand-in data)", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const viewport of [NARROW, { width: 1440, height: 900 }]) {
    const { context, page } = await newDoctor(browser, { viewport });
    const set = await mockPortal(page, { status: () => statusOf("none") });
    const check = async (path: string, heading: string | RegExp, level?: number) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level, name: heading })).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(300);
      await expectNoSideScroll(page);
      await expectNoAxeViolations(page);
      const { problems } = await walkKeyboard(page, 80);
      expect(problems, `${path} at ${viewport.width}: ${JSON.stringify(problems, null, 2)}`).toEqual([]);
    };
    await check("/view", "Enter the patient's code");
    await check("/view/about", "About the portal", 1);
    set({ status: () => statusOf("requested") });
    await check("/view", "Waiting for the patient to approve");
    // The live record (stand-in data): the h1 is the patient's name on every view.
    set({ status: () => statusOf("active") });
    for (const view of ["", "/visits", "/medications", "/timeline", "/care-team", "/family", "/end"]) {
      await check("/view/session" + view, "Test Patient", 1);
    }
    set({ status: () => statusOf("active", { scope: { ...SCOPE, documents: true, insurance: true, mental_health: true } }) });
    for (const view of ["/documents", "/insurance", "/mental-health"]) {
      await check("/view/session" + view, "Test Patient", 1);
    }
    set({ status: () => statusOf("paused"), record: null });
    await check("/view/session", "Time's up on this share.");
    set({ status: () => statusOf("ended", { notes_saved_to_record: true }) });
    await check("/view/session", "Your patient ended the session.");
    await context.close();
  }
});

test("reduced motion: a sheet opens without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(NARROW);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /, Jane$/ })).toBeVisible({ timeout: 20_000 });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible();
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return Number(t?.duration ?? 0) > 1;
    }).length,
  );
  expect(running).toBe(0);
  await page.getByRole("button", { name: "Keep my account" }).click();
});

test("signed out: welcome, sign in, sign up and the link-expired page at 320px with the keyboard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: NARROW, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await checkScreen(page, "/", "Your health record, owned by you.");
  await checkScreen(page, "/login", /Welcome back/);
  await checkScreen(page, "/signup", /./);
  await checkScreen(page, "/auth/link-expired", /That link didn.t work/);
  await context.close();
});
