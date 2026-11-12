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
  test.setTimeout(420_000);
  await page.setViewportSize(NARROW);
  const db = clientFor(file);
  const entry = (await db.from("entries").select("id").eq("kind", "result").limit(1).single()).data!.id;
  const condition = (await db.from("conditions").select("id").limit(1).single()).data!.id;
  const med = (await db.from("medications").select("id").eq("name", "Concerta").single()).data!.id;
  const period = (await db.from("medication_periods").select("id").eq("medication_id", med).limit(1).single()).data!.id;
  const event = (await db.from("health_events").select("id").limit(1).single()).data!.id;
  const relative = (await db.from("relatives").select("id").eq("relation", "paternal_grandfather").single()).data!.id;
  const person = (await db.from("care_team").select("id").limit(1).single()).data!.id;
  // The demo has no documents: add one (a 1 x 1 PNG) for the document screens.
  const uploaded = await db.rpc("upload_document", {
    title: "Test letter",
    content_type: "image/png",
    data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  });
  expect(uploaded.error, uploaded.error?.message).toBeNull();
  const doc = (uploaded.data as { id: string }).id;
  const reading = (await db.from("vitals").select("id").limit(1).single()).data!.id;

  const screens: [string, string | RegExp][] = [
    ["/home", /^Good (morning|afternoon|evening), Jane$/],
    ["/record", "Record"],
    ["/record?tab=conditions", "Record"],
    ["/record?tab=family", "Record"],
    [`/record/${entry}`, "Blood count and INR"],
    [`/record/${entry}/edit`, /^Edit/],
    [`/record/conditions/${condition}`, /./],
    [`/record/conditions/${condition}/edit`, /^Edit/],
    ["/record/conditions/new", /condition/i],
    ["/meds", "Medications"],
    ["/meds?tab=past", "Medications"],
    [`/meds/${med}`, /./],
    [`/meds/${med}/edit`, /^Edit/],
    [`/meds/${med}/change`, "Log a strength change"],
    [`/meds/${med}/notes/${period}`, /note/],
    ["/record/timeline", "Timeline"],
    ["/record/timeline/new", "Add to your timeline"],
    [`/record/timeline/${event}/edit`, "Edit event"],
    ["/record/family", "Family history"],
    ["/record/family/new", "Add a relative"],
    [`/record/family/${relative}/edit`, /^Edit/],
    ["/profile/insurance", "Insurance"],
    ["/profile/insurance/manual", "Policy details"],
    ["/profile/documents", "Documents"],
    ["/profile/documents/upload", "Upload a document"],
    [`/profile/documents/${doc}`, "Test letter"],
    [`/profile/documents/${doc}/edit`, "Edit document"],
    ["/record/vitals", "Vitals"],
    ["/add/vitals", "Log vitals"],
    [`/record/vitals/${reading}/edit`, "Edit vitals"],
    ["/record/search", "Search your record"],
    ["/record/print", "Your record to print"],
    ["/profile/email", "Change email"],
    ["/add", "Add to your record"],
    ["/add/note", "Log a note"],
    ["/add/appointment", "Add a visit"],
    ["/add/medication", /medication/i],
    ["/profile", "Profile"],
    ["/profile/details", "Your details"],
    ["/profile/edit", /^Edit/],
    ["/profile/care-team", "Care team"],
    ["/profile/care-team/new", /care team/i],
    [`/profile/care-team/${person}`, /./],
    ["/profile/privacy", "Privacy and data"],
    ["/access-log", "Share history"],
    ["/share", "Share your record"],
    ["/terms", "Terms"],
  ];
  for (const [path, heading] of screens) await checkScreen(page, path, heading);
});

/** Where the desktop layout's pieces are: the rail, the content column or panes, and the tab bar. */
async function desktopBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { left: r.left, right: r.right, top: r.top, width: r.width } : null;
    };
    const visible = (els: Element[]) => els.find((e) => (e as HTMLElement).offsetParent !== null) ?? null;
    return {
      rail: box(visible([...document.querySelectorAll('nav[aria-label="Main"]')].filter((n) => !n.querySelector("button")))),
      tabBar: box(visible([...document.querySelectorAll('nav[aria-label="Main"]')].filter((n) => Boolean(n.querySelector("button"))))),
      main: box(visible([...document.querySelectorAll("main#main")])),
      details: box(visible([...document.querySelectorAll('section[aria-label="Details"]')])),
      h1: box(visible([...document.querySelectorAll("h1")])),
      widest: Math.max(
        ...[...document.querySelectorAll("main#main *, section[aria-label='Details'] *")]
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => e.getBoundingClientRect().right),
      ),
    };
  });
}

test("patient app at 1024, 1280 and 1440: the rail, one column or two panes, axe and the keyboard", async ({ page }) => {
  test.setTimeout(600_000);
  const db = clientFor(file);
  await reseed(db);
  const entry = (await db.from("entries").select("id").eq("kind", "result").limit(1).single()).data!.id;
  const condition = (await db.from("conditions").select("id").limit(1).single()).data!.id;
  const med = (await db.from("medications").select("id").eq("name", "Concerta").single()).data!.id;
  // [path, h1, layout]: "column" (rail, one 640px column), "list" (rail, list with a pane beside it),
  // "detail" (rail, the list beside this detail), "focused" (no rail: forms and sharing keep the centred column).
  const screens: [string, string | RegExp, "column" | "list" | "detail" | "focused"][] = [
    ["/home", /^Good (morning|afternoon|evening), Jane$/, "column"],
    ["/record", "Record", "list"],
    [`/record/${entry}`, "Blood count and INR", "detail"],
    [`/record/conditions/${condition}`, "Atrial fibrillation", "detail"],
    ["/meds", "Medications", "list"],
    [`/meds/${med}`, "Concerta", "detail"],
    ["/record/timeline", "Timeline", "list"],
    ["/record/family", "Family history", "column"],
    ["/add", "Add to your record", "column"],
    ["/profile", "Profile", "column"],
    ["/profile/insurance", "Insurance", "column"],
    ["/profile/documents", "Documents", "column"],
    ["/profile/care-team", "Care team", "column"],
    ["/profile/privacy", "Privacy and data", "column"],
    ["/access-log", "Share history", "column"],
    ["/record/vitals", "Vitals", "column"],
    ["/record/search", "Search your record", "column"],
    ["/record/print", "Your record to print", "focused"],
    ["/add/note", "Log a note", "focused"],
    ["/share", "Share your record", "focused"],
  ];
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading, layout] of screens) {
      await checkScreen(page, path, heading);
      const b = await desktopBoxes(page);
      const where = `${path} at ${width}`;
      expect(b.tabBar, `${where}: no tab bar`).toBeNull();
      if (layout === "focused") {
        expect(b.rail, `${where}: no rail on a focused flow`).toBeNull();
        expect(b.main!.width, where).toBeLessThanOrEqual(430);
        continue;
      }
      expect(b.rail, `${where}: the rail`).not.toBeNull();
      expect(b.rail!.width, where).toBe(232);
      // Content starts beside the rail and is never wider than about 1120px.
      expect(b.main!.left, where).toBeGreaterThanOrEqual(232);
      expect(b.widest - 232, `${where}: content width`).toBeLessThanOrEqual(1120);
      if (layout === "column") {
        expect(b.details, where).toBeNull();
      } else {
        // Two panes side by side: the list (360px) on the left, the detail on the right.
        const list = layout === "list" ? b.main! : null;
        const right = layout === "list" ? b.details! : b.main!;
        expect(right, where).not.toBeNull();
        if (list) expect(list.width, where).toBe(360);
        expect(right.left, where).toBeGreaterThanOrEqual(232 + 20 + 360 - 1);
      }
    }
    // The rail marks where you are, with the same five items as the tab bar.
    await page.goto(`/meds/${med}`);
    const rail = page.getByRole("navigation", { name: "Main" });
    await expect(rail.getByRole("link")).toHaveText(["Home", "Record", "Add", "Medications", "Profile"]);
    await expect(rail.getByRole("link", { name: "Medications" })).toHaveAttribute("aria-current", "page");
    // The open medication is marked in the list beside it.
    await expect(page.getByRole("list", { name: "Current medications" }).getByRole("link", { name: /^Concerta/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Full timeline: a row opens the event in the pane, not a sheet.
    await page.goto("/record/timeline");
    await page.getByRole("button", { name: /Asthma flare/ }).click();
    const pane = page.getByRole("region", { name: "Details" });
    await expect(pane.getByRole("heading", { level: 2, name: "Asthma flare" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoAxeViolations(page);
  }
});

test("patient app at 768: the phone column, centred, with its tab bar", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const [path, heading] of [
    ["/home", /^Good/],
    ["/record", "Record"],
    ["/meds", "Medications"],
    ["/profile", "Profile"],
  ] as const) {
    await checkScreen(page, path, heading);
    const b = await desktopBoxes(page);
    expect(b.rail, path).toBeNull();
    expect(b.tabBar, path).not.toBeNull();
    expect(b.details, path).toBeNull();
    // The 430px column, centred, not stretched to the window.
    expect(b.main!.width, path).toBeLessThanOrEqual(430);
    expect(Math.abs(b.main!.left - (768 - b.main!.right)), path).toBeLessThanOrEqual(2);
  }
});

test("patient app: the share loop screens at 320px, and the request sheet with the keyboard alone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(NARROW);
  await checkScreen(page, "/share", "Share your record");
  await page.getByRole("button", { name: "Create share code" }).click();
  await page.waitForURL(/\/share\/code$/);
  await expect(page.getByText(/^Your code: \d \d \d \d$/)).toBeAttached();
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
  // It asks once before ending (A17); the sheet's confirm, by keyboard too.
  await page.getByRole("dialog", { name: "End sharing now?" }).getByRole("button", { name: "End sharing" }).focus();
  await page.keyboard.press("Enter");
  // Back to the bright app, with one line and the summary a link away.
  await page.waitForURL(/\/home\?ended=/);
  await expect(page.getByText(/^Dr Hennessy no longer has access to your record\./)).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]').last()).toHaveText(
    "Sharing ended. Dr Hennessy no longer has access to your record.",
  );
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page);
  expect((await walkKeyboard(page)).problems).toEqual([]);
  await page.getByRole("link", { name: "View summary" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sharing ended" })).toBeVisible();
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
    set({ status: () => statusOf("active", { scope: { ...SCOPE, documents: true, mental_health: true } }) });
    for (const view of ["/documents", "/mental-health"]) {
      await check("/view/session" + view, "Test Patient", 1);
    }
    set({ status: () => statusOf("paused"), record: null });
    await check("/view/session", "Time's up on this share.");
    set({ status: () => statusOf("ended", { notes_saved_to_record: true }) });
    await check("/view/session", "Your patient ended the session.");
    // The portal's own not-found page (review fix C25).
    await check("/view/no-such-page", "There is nothing at this address.");
    await context.close();
  }
});

test("reduced motion: a sheet opens without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(NARROW);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /, Jane$/ })).toBeVisible({ timeout: 20_000 });
  await page.goto("/profile/privacy");
  await page.getByRole("button", { name: "Delete your account" }).click();
  await expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible();
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return Number(t?.duration ?? 0) > 1;
    }).length,
  );
  expect(running).toBe(0);
  await page.getByRole("button", { name: "Keep your account" }).click();
});

test("signed out: welcome, sign in, sign up and the link-expired page at 320px with the keyboard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: NARROW, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await checkScreen(page, "/", "Your health record, owned by you.");
  await checkScreen(page, "/login", /Welcome back/);
  await checkScreen(page, "/signup", /./);
  await checkScreen(page, "/auth/link-expired", /That link didn.t work/);
  // A real not-found page (Phase 8): title, one line, one text button, and a 404 status.
  // In a page of its own: after a run of other screens in the same tab, Chrome's starting point for Tab can be left past the end.
  const missing = await context.newPage();
  const res = await missing.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await checkScreen(missing, "/no-such-page", "Page not found");
  await expect(missing.getByRole("link", { name: "Go to Trace" })).toHaveAttribute("href", "/");
  await context.close();
});
