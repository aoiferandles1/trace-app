import { expect, test as base, type Browser, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { newDoctor, submitCode } from "../helpers/doctor";
import { NOTHING_OPTIONAL, PortalPatient, type ScopeOptions } from "../helpers/portal-patient";

/**
 * What the patient did not share never reaches the portal (BRIEF.md 4.5,
 * 6.3), against the real database: each scope granted alone shows exactly
 * its rail item and view; an ungranted section's API answers 403 with no
 * data and its URL shows "Not shared" without asking for it; medication
 * notes appear only when the contract returns them; a document opens only
 * while it is shared and the session is active; mental health items stay
 * hidden without their scope.
 *
 * One anonymous patient for the file, re-seeded before each test. Serial,
 * desktop project only. Every session uses a fresh doctor context (its own
 * portal token and test IP).
 */

const test = base.extend<object, { patient: PortalPatient }>({
  patient: [
    async ({}, use) => {
      const patient = await PortalPatient.signIn();
      await use(patient);
      await patient.dispose();
    },
    { scope: "worker" },
  ],
});

test.describe.configure({ mode: "serial" });
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Runs once, in the desktop project");

test.beforeEach(async ({ patient }) => {
  await patient.reset();
});

/** Rail order, and the record section and scope key behind each optional view. */
const OPTIONAL = [
  { label: "Recent visits", path: "visits", section: "recent_visits", key: "share_recent_visits" },
  { label: "Full timeline", path: "timeline", section: "full_timeline", key: "share_full_timeline" },
  { label: "Care team", path: "care-team", section: "care_team", key: "share_care_team" },
  { label: "Family history", path: "family", section: "family_history", key: "share_family_history" },
  { label: "Documents", path: "documents", section: "documents", key: "share_documents" },
  { label: "Mental health", path: "mental-health", section: "mental_health", key: "share_mental_health" },
] as const;
const RAIL = ["Overview", "Recent visits", "Medications", "Full timeline", "Care team", "Family history", "Documents", "Mental health"];

async function openSession(browser: Browser, patient: PortalPatient, opts: ScopeOptions) {
  const share = await patient.shareCode({ ...NOTHING_OPTIONAL, ...opts });
  const doctor = await newDoctor(browser);
  const requested: string[] = [];
  doctor.page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/portal/record") requested.push(u.searchParams.get("section") ?? "");
  });
  await submitCode(doctor.page, share.code);
  await patient.waitForStatus("requested");
  await patient.respond(true);
  await expect(doctor.page.getByRole("heading", { level: 1, name: "Jane Doe" })).toBeVisible({ timeout: 10_000 });
  return { ...doctor, requested };
}

async function section(page: Page, name: string) {
  const res = await page.request.get(`/api/portal/record?section=${name}`);
  return { status: res.status(), body: await res.json() };
}

const cases: Array<{ name: string; opts: ScopeOptions; shared: string[] }> = [
  { name: "nothing optional", opts: {}, shared: [] },
  ...OPTIONAL.map((o) => ({ name: o.label, opts: { [o.key]: true } as ScopeOptions, shared: [o.label] })),
];

for (const c of cases) {
  test(`scope alone: ${c.name} shows exactly its rail item and view`, async ({ browser, patient }) => {
    const { context, page, requested } = await openSession(browser, patient, c.opts);
    const nav = page.getByRole("navigation", { name: "Patient record" });

    // The rail: Overview, Medications and this view as links, in the rail's order.
    const expectedLinks = RAIL.filter((l) => l === "Overview" || l === "Medications" || c.shared.includes(l));
    await expect(nav.getByRole("link")).toHaveText(expectedLinks);
    for (const o of OPTIONAL.filter((o) => !c.shared.includes(o.label))) {
      const row = nav.locator('[aria-disabled="true"]').filter({ hasText: o.label });
      await expect(row).toContainText("Not shared");
    }

    // Its view opens from the rail.
    for (const label of c.shared) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page.getByRole("heading", { level: 2, name: label })).toBeVisible();
      await expect(page.getByText("did not share this part of the record")).toHaveCount(0);
    }
    if (c.name === "Family history") await expect(page.getByText("Heart attack at 61").filter({ visible: true }).first()).toBeVisible();
    if (c.name === "Full timeline") await expect(page.getByRole("heading", { level: 3, name: "Chest infection" })).toBeVisible();
    // The rail's pill fades over 150ms; let it finish so axe measures the end state.
    await page.waitForTimeout(250);
    await expectNoAxeViolations(page);

    // Every ungranted section: the route refuses it and returns no data.
    for (const o of OPTIONAL.filter((o) => !c.shared.includes(o.label))) {
      const r = await section(page, o.section);
      expect(r, o.section).toEqual({ status: 403, body: { error: "not_shared" } });
    }
    expect((await section(page, "conditions")).status).toBe(403);
    // Overview and Medications always come through.
    expect((await section(page, "medications")).status).toBe(200);

    // Typing an ungranted view's URL shows "Not shared" and asks for nothing.
    const notShared = OPTIONAL.find((o) => !c.shared.includes(o.label))!;
    await page.goto(`/view/session/${notShared.path}`);
    await expect(page.getByRole("heading", { level: 2, name: notShared.label })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Jane did not share this part of the record.")).toBeVisible();

    // The browser never asked for a section the patient did not grant.
    const ungranted = OPTIONAL.filter((o) => !c.shared.includes(o.label)).map((o) => o.section);
    expect(requested.filter((s) => ungranted.includes(s as (typeof ungranted)[number]) || s === "conditions")).toEqual([]);

    if (c.name === "nothing optional") {
      // Overview without Conditions or Recent visits says so, and shows none of their data.
      const main = page.getByRole("main");
      await page.goto("/view/session");
      await expect(page.getByRole("heading", { level: 2, name: "Conditions" })).toBeVisible({ timeout: 10_000 });
      await expect(main.getByText("Atrial fibrillation")).toHaveCount(0);
      await expect(main.getByText("GP visit")).toHaveCount(0);
      await expect(main.getByText("Not shared", { exact: true }).filter({ visible: true })).toHaveCount(3);
      await expect(main.getByRole("link", { name: /^Concerta/ })).toBeVisible();
      const ov = (await section(page, "overview")).body.record.data;
      expect(ov.conditions).toBeNull();
      expect(ov.recent_visits).toBeNull();
      expect(ov.vitals).toBeNull();
    }
    await patient.end();
    await context.close();
  });
}

test("insurance: never in the portal, even if a session granted it", async ({ browser, patient }) => {
  // Insurance is personal (Aoife, Nov 2026); the patient app always shares with it off.
  // Grant it at the database anyway: the portal must still show and fetch nothing.
  await patient.connectInsurance();
  const { context, page, requested } = await openSession(browser, patient, { share_insurance: true });
  const nav = page.getByRole("navigation", { name: "Patient record" });
  await expect(nav.getByText("Insurance")).toHaveCount(0);
  expect(await section(page, "insurance")).toEqual({ status: 400, body: { error: "invalid_section" } });
  expect((await page.request.get("/view/session/insurance")).status()).toBe(404);
  for (const name of ["overview", "medications"]) {
    expect(JSON.stringify((await section(page, name)).body)).not.toContain("4821");
  }
  await expect(page.getByText("•••• 4821")).toHaveCount(0);
  expect(requested).not.toContain("insurance");
  await patient.end();
  await context.close();
});

test("conditions: shown on the Overview only when shared", async ({ browser, patient }) => {
  const { context, page } = await openSession(browser, patient, { share_conditions: true });
  await expect(page.getByRole("main").getByText("Atrial fibrillation")).toBeVisible();
  await expect(page.getByRole("main").getByText("Ongoing, since 2022")).toBeVisible();
  const r = await section(page, "conditions");
  expect(r.status).toBe(200);
  expect(r.body.record.data.conditions.map((c: { name: string }) => c.name)).toContain("Hypothyroidism");
  await patient.end();
  await context.close();
});

test("medication notes appear only when the contract returns them", async ({ browser, patient }) => {
  // Without the Medication notes scope: no note travels, and no label or gap shows.
  let s = await openSession(browser, patient, {});
  const meds = (await section(s.page, "medications")).body.record.data;
  const notes = [...meds.current, ...meds.past].flatMap((m: { periods: Array<{ note: string | null }> }) => m.periods.map((p) => p.note));
  expect(notes.length).toBeGreaterThan(5);
  expect(notes.every((n: string | null) => n === null)).toBe(true);
  expect(JSON.stringify(meds)).not.toContain("note_shared");
  await s.page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: "Medications" }).click();
  await expect(s.page.getByRole("heading", { level: 3, name: "Concerta" })).toBeVisible();
  await expect(s.page.getByText(/Jane: "/)).toHaveCount(0);
  await patient.end();
  await s.context.close();

  // With it: Jane's own words under each period that has them.
  s = await openSession(browser, patient, { share_medication_notes: true });
  await s.page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: "Medications" }).click();
  await expect(s.page.getByText('Jane: "Back on 36. Smoother and sleeping better."')).toBeVisible();
  await expect(s.page.getByText('Jane: "Too much. Racing heart and trouble sleeping."')).toBeVisible();
  await s.page.waitForTimeout(250);
  await expectNoAxeViolations(s.page);
  await patient.end();
  await s.context.close();

  // With the scope but the note not shared by the patient: Concerta's notes stay out, Levothyroxine's show.
  await patient.reset();
  await patient.hideNotes("Concerta");
  s = await openSession(browser, patient, { share_medication_notes: true });
  await s.page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: "Medications" }).click();
  await expect(s.page.getByRole("heading", { level: 3, name: "Concerta" })).toBeVisible();
  await expect(s.page.getByText(/Jane: "/)).toHaveCount(0);
  await s.page.getByRole("button", { name: /^Levothyroxine/ }).click();
  await expect(s.page.getByText('Jane: "Energy back to normal."')).toBeVisible();
  const concerta = (await section(s.page, "medications")).body.record.data.current.find((m: { name: string }) => m.name === "Concerta");
  expect(concerta.periods.every((p: { note: string | null }) => p.note === null)).toBe(true);
  await patient.end();
  await s.context.close();
});

test("documents: open while shared and active, refused otherwise", async ({ browser, patient }) => {
  const letter = await patient.uploadDocument("Discharge letter", "png");
  const private_ = await patient.uploadDocument("Counselling letter", "pdf", true);

  // Not shared: neither the list nor the file.
  let s = await openSession(browser, patient, {});
  expect(await section(s.page, "documents")).toEqual({ status: 403, body: { error: "not_shared" } });
  expect((await s.page.request.get(`/api/portal/document?id=${letter}`)).status()).toBe(404);
  await patient.end();
  await s.context.close();

  // Shared (Mental health not): the list holds the letter only, and it opens with the safe headers.
  s = await openSession(browser, patient, { share_documents: true });
  await s.page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: "Documents" }).click();
  await expect(s.page.getByRole("heading", { level: 2, name: "Documents" })).toBeVisible();
  const link = s.page.getByRole("link", { name: /Discharge letter/ });
  await expect(link).toBeVisible();
  await expect(link).toContainText("Photo");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(s.page.getByText("Counselling letter")).toHaveCount(0);
  await s.page.waitForTimeout(250);
  await expectNoAxeViolations(s.page);

  const [tab] = await Promise.all([s.context.waitForEvent("page"), link.click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toContain(`/api/portal/document?id=${letter}`);
  await tab.close();

  const file = await s.page.request.get(`/api/portal/document?id=${letter}`);
  expect(file.status()).toBe(200);
  const h = file.headers();
  expect(h["content-type"]).toBe("image/png");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("sandbox");
  expect(h["cache-control"]).toContain("no-store");
  expect((await file.body()).subarray(0, 4).toString("hex")).toBe("89504e47");
  // The mental-health-flagged file needs the Mental health scope too.
  expect((await s.page.request.get(`/api/portal/document?id=${private_}`)).status()).toBe(404);
  // Not a document of this patient, or not a uuid: the same 404.
  expect((await s.page.request.get("/api/portal/document?id=00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await s.page.request.get("/api/portal/document?id=nope")).status()).toBe(404);

  // After the session ends: refused.
  await patient.end();
  await expect(s.page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 8_000 });
  expect((await s.page.request.get(`/api/portal/document?id=${letter}`)).status()).toBe(404);
  await s.context.close();

  // A brand-new browser (no portal cookie) gets nothing either.
  const stranger = await newDoctor(browser);
  expect((await stranger.page.request.get(`/api/portal/document?id=${letter}`)).status()).toBe(404);
  await stranger.context.close();
});

test("mental health: hidden without its scope, gathered in its view with it", async ({ browser, patient }) => {
  await patient.addMentalHealthCondition("Generalised anxiety");

  let s = await openSession(browser, patient, { share_conditions: true, share_recent_visits: true });
  for (const name of ["overview", "conditions", "recent_visits", "medications"]) {
    expect(JSON.stringify((await section(s.page, name)).body)).not.toContain("Generalised anxiety");
  }
  await expect(s.page.getByText("Generalised anxiety")).toHaveCount(0);
  await patient.end();
  await s.context.close();

  s = await openSession(browser, patient, { share_conditions: true, share_mental_health: true });
  await expect(s.page.getByRole("main").getByText("Generalised anxiety")).toBeVisible();
  await s.page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: "Mental health" }).click();
  await expect(s.page.getByRole("heading", { level: 2, name: "Mental health" })).toBeVisible();
  await expect(s.page.getByText("Generalised anxiety").filter({ visible: true })).toHaveCount(1);
  await s.page.waitForTimeout(250);
  await expectNoAxeViolations(s.page);
  await patient.end();
  await s.context.close();
});
