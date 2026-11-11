import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { clientFor, deleteUser, expectNoSideScroll, reseed, signInDemo, statePath } from "./helpers/patient";

/**
 * The redesign's new patient sections (Phases 4 to 6): Medications and the
 * strength history, the full timeline and visit detail, the family tree,
 * insurance and documents. One anonymous demo user per Playwright project
 * (sign-ins are capped), reset before every test.
 */

test.describe.configure({ mode: "default" });

let file = "";

test.beforeAll(async ({ browser }, info) => {
  file = statePath(`sections-${info.project.name}`);
  await signInDemo(browser, file, info.project.use.baseURL!);
});

test.afterAll(async () => {
  await deleteUser(file);
});

test.use({ storageState: async ({}, provide) => provide(file) });

test.beforeEach(async () => {
  await reseed(clientFor(file));
});

async function gotoScreen(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
}

const dublinDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(Date.now() + offset * 86_400_000));

async function medId(name: string) {
  return (await clientFor(file).from("medications").select("id").eq("name", name).single()).data!.id;
}

async function periodsOf(id: string) {
  const { data, error } = await clientFor(file)
    .from("medication_periods")
    .select("id, strength, start_date, end_date, prescribed_by, note, note_shared")
    .eq("medication_id", id)
    .order("start_date", { ascending: true });
  expect(error).toBeNull();
  return data!;
}

/** The step chart fits its card: nothing scrolls and every label is inside the card. */
async function expectChartFits(page: Page) {
  const fit = await page.evaluate(() => {
    const table = [...document.querySelectorAll("table")].find((t) => /strength over time/.test(t.caption?.textContent ?? ""));
    const chart = table!.parentElement!;
    const card = chart.parentElement!.getBoundingClientRect();
    const spans = [...chart.querySelectorAll("span")].map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0);
    return {
      scrolls: chart.scrollWidth > chart.clientWidth + 0.5,
      outside: spans.filter((r) => r.left < card.left - 0.5 || r.right > card.right + 0.5).length,
    };
  });
  expect(fit).toEqual({ scrolls: false, outside: 0 });
}

/** True in the desktop layout (1024px and wider). */
function desktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/** Where a timeline event opens: its sheet on the phone, the pane beside the list at desktop widths. */
function eventView(page: Page, title: string, wide: boolean) {
  return wide
    ? page.getByRole("region", { name: "Details" }).filter({ has: page.getByRole("heading", { level: 2, name: title }) })
    : page.getByRole("dialog", { name: title });
}

test("Concerta shows exactly 18, 27, 36, 45, 36 with dates, prescriber and notes (MedDetailA2)", async ({ page }) => {
  await gotoScreen(page, "/meds", "Medications");
  await page.getByRole("link", { name: /^Concerta/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Concerta" })).toBeVisible();
  await expect(page.getByText("Now 36mg, since Feb 2025")).toBeVisible();

  // The chart's text equivalent, oldest first.
  const table = page.getByRole("table", { name: "Concerta strength over time" });
  await expect(table.getByRole("row")).toHaveText([
    /Strength\s*From\s*To/,
    /18mg\s*Jan 2024\s*Mar 2024/,
    /27mg\s*Mar 2024\s*Jun 2024/,
    /36mg\s*Jun 2024\s*Oct 2024/,
    /45mg\s*Oct 2024\s*Feb 2025/,
    /36mg\s*Feb 2025\s*now/,
  ]);

  // History, newest first: strength, dates, prescriber and Jane's note.
  const history = page.getByRole("region", { name: "History" }).getByRole("listitem");
  await expect(history).toHaveText([
    /^36mg\s*Feb 2025 to now\s*Prescribed by Dr Hennessy\s*Back on 36\. Smoother and sleeping better\./,
    /^45mg\s*Oct 2024 to Feb 2025\s*Prescribed by Dr Hennessy\s*Too much\. Racing heart and trouble sleeping\./,
    /^36mg\s*Jun 2024 to Oct 2024\s*Prescribed by Dr Hennessy\s*Steady all day\. Good for work\./,
    /^27mg\s*Mar 2024 to Jun 2024\s*Prescribed by Dr Hennessy\s*Better focus through the morning\. Appetite dropped\./,
    /^18mg\s*Jan 2024 to Mar 2024\s*Prescribed by Dr Hennessy\s*Barely noticed it\. A little more focus in the morning, gone by lunch\./,
  ]);
  await expect(page.getByRole("link", { name: "Log a strength change" })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
  await expectChartFits(page);

  // At 320 wide too.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(200);
  await expectNoSideScroll(page);
  await expectChartFits(page);
});

test("log a strength change: a new period, the previous one closed, nothing overwritten", async ({ page }) => {
  const id = await medId("Concerta");
  const before = await periodsOf(id);
  expect(before.map((p) => p.strength)).toEqual([18, 27, 36, 45, 36]);

  await gotoScreen(page, `/meds/${id}`, "Concerta");
  await page.getByRole("link", { name: "Log a strength change" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log a strength change" })).toBeVisible();
  await expectNoAxeViolations(page);

  // Refusals, in words, before anything is saved.
  await page.getByRole("textbox", { name: "New strength (mg)" }).fill("36");
  await page.getByRole("button", { name: "Save change" }).click();
  await expect(page.getByText("That's the strength you take now (36mg).")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New strength (mg)" })).toBeFocused();

  const today = dublinDay();
  await page.getByRole("textbox", { name: "New strength (mg)" }).fill("27");
  await page.getByLabel("Date of the change").filter({ visible: true }).fill(today);
  await page.getByRole("textbox", { name: /How it feels/ }).fill("Trying a lower dose for the evenings.");
  // A new note is shared with doctors unless turned off (owner's decision).
  await expect(page.getByRole("switch", { name: "Share this note with doctors" })).toHaveAttribute("aria-checked", "true");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save change" }).click();
  await page.waitForURL(new RegExp(`/meds/${id}$`));
  await expect(page.getByText(/^Now 27mg, since /)).toBeVisible();

  const after = await periodsOf(id);
  expect(after).toHaveLength(6);
  // The five earlier periods are as they were, except the open one, now closed on the change date.
  for (let i = 0; i < 4; i++) expect(after[i]).toEqual(before[i]);
  expect(after[4]).toEqual({ ...before[4], end_date: today });
  expect(after[5]).toMatchObject({
    strength: 27,
    start_date: today,
    end_date: null,
    prescribed_by: "Dr Hennessy",
    note: "Trying a lower dose for the evenings.",
    note_shared: true,
  });

  const history = page.getByRole("region", { name: "History" }).getByRole("listitem");
  await expect(history).toHaveCount(6);
  await expect(history.first()).toContainText("27mg");
  await expect(history.nth(1)).toContainText(/36mg\s*Feb 2025 to /);
  await expect(page.getByRole("table", { name: "Concerta strength over time" }).getByRole("row")).toHaveCount(7);
  await expectChartFits(page);
});

test("a medication with one period works the same way, and notes can be added, edited and unshared", async ({ page }) => {
  const id = await medId("Warfarin");
  await gotoScreen(page, `/meds/${id}`, "Warfarin");
  await expect(page.getByText(/^Now 5mg, since Jun 2019$/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Warfarin strength over time" }).getByRole("row")).toHaveCount(2);
  await expectChartFits(page);
  const history = page.getByRole("region", { name: "History" }).getByRole("listitem");
  await expect(history).toHaveCount(1);
  await expect(history).toContainText(/5mg\s*Jun 2019 to now\s*Prescribed by Dr O'Mahony/);
  await expectNoAxeViolations(page);

  // No note yet: add one. It starts shared.
  await history.getByRole("link", { name: /^Add a note/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a note" })).toBeVisible();
  await page.getByRole("textbox", { name: "How it felt" }).fill("Fine. Bruise easily.");
  await expect(page.getByRole("switch", { name: "Share this note with doctors" })).toHaveAttribute("aria-checked", "true");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save note" }).click();
  await page.waitForURL(new RegExp(`/meds/${id}$`));
  await expect(page.getByText("Fine. Bruise easily.").filter({ visible: true })).toBeVisible();
  let [p] = await periodsOf(id);
  expect(p).toMatchObject({ note: "Fine. Bruise easily.", note_shared: true });

  // The per-note switch turns sharing off, and it stays off.
  const share = page.getByRole("switch", { name: /^Share with doctors, 5mg/ });
  await expect(share).toHaveAttribute("aria-checked", "true");
  await share.click();
  await expect(share).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await periodsOf(id))[0].note_shared).toBe(false);

  // Editing the note keeps its setting.
  await page.getByRole("link", { name: /^Edit note, 5mg/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit note" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Share this note with doctors" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("textbox", { name: "How it felt" }).fill("Fine. Bruise easily. INR steady.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.waitForURL(new RegExp(`/meds/${id}$`));
  [p] = await periodsOf(id);
  expect(p).toMatchObject({ note: "Fine. Bruise easily. INR steady.", note_shared: false });

  // A past medication has no strength change.
  await gotoScreen(page, "/meds?tab=past", "Medications");
  await page.getByRole("link", { name: /^Doxycycline/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Doxycycline" })).toBeVisible();
  await expect(page.getByText("Stopped 9 Aug 2026")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log a strength change" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Medications" }).click();
  await expect(page.getByRole("radio", { name: "Past" })).toBeChecked();
});

test("full timeline: the filter, and the sheet with Seen by, Outcome, Prescribed and Doctor's notes (TimelineA2)", async ({ page }) => {
  await gotoScreen(page, "/record", "Record");
  await page.getByRole("link", { name: "View full timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  const list = page.getByRole("list", { name: "Timeline" });
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric" }).format(new Date());
  await expect(list.getByRole("button")).toHaveText([
    /2026\s*Chest infection\s*Aug, Infection/,
    /Asthma flare\s*Feb, Condition/,
    /2025\s*Urinary tract infection\s*Sep, Infection/,
    /2024\s*Hay fever\s*Apr, Condition/,
    /2023\s*Tonsillitis\s*Nov, Infection/,
    /2022\s*Hypothyroidism diagnosed\s*Mar, Condition/,
    /2020\s*Covid-19\s*Dec, Infection/,
    /2019\s*Atrial fibrillation diagnosed\s*Jun, Condition/,
    /2018\s*Glandular fever\s*Feb, Infection/,
  ]);
  // A row without its year shown still says it to screen readers.
  await expect(list.getByRole("button", { name: /Asthma flare.*2026/ })).toBeVisible();
  expect(year).toBe("2026");
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  const filter = page.getByRole("radiogroup", { name: "Show" });
  await filter.getByRole("radio", { name: "Infections" }).click();
  await expect(list.getByRole("button")).toHaveCount(5);
  await expect(list.getByRole("button", { name: /Hay fever/ })).toHaveCount(0);
  await filter.getByRole("radio", { name: "Conditions" }).click();
  await expect(list.getByRole("button")).toHaveText([/2026\s*Asthma flare/, /2024\s*Hay fever/, /2022\s*Hypothyroidism/, /2019\s*Atrial fibrillation/]);
  await page.waitForTimeout(300);
  await expectNoAxeViolations(page);
  await filter.getByRole("radio", { name: "All" }).click();

  const row = list.getByRole("button", { name: /Asthma flare/ });
  await row.click();
  // The phone opens a sheet; from 1024px the event opens in the pane beside the list (the portal's pattern).
  const sheet = eventView(page, "Asthma flare", desktop(page));
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Feb 2026, Condition")).toBeVisible();
  await expect(sheet.getByText("Seen by")).toBeVisible();
  await expect(sheet.getByText("Dr Hennessy, Rathmines Medical Centre")).toBeVisible();
  await expect(sheet.getByText("Outcome")).toBeVisible();
  await expect(sheet.getByText("Settled")).toBeVisible();
  await expect(sheet.getByText("Prescribed")).toBeVisible();
  await expect(sheet.getByText("Prednisolone 20mg")).toBeVisible();
  await expect(sheet.getByText("5 days")).toBeVisible();
  await expect(sheet.getByText("Salbutamol 100mcg")).toBeVisible();
  await expect(sheet.getByText("Doctor's notes")).toBeVisible();
  await expect(sheet.getByText("Wheeze after a cold. Peak flow improved on treatment.")).toBeVisible();
  await page.waitForTimeout(300);
  if (desktop(page)) {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await expect(list.getByRole("button", { name: /Chest infection/ })).toHaveAttribute("aria-pressed", "false");
    await expectNoAxeViolations(page);
    return;
  }
  await expectNoAxeViolations(page, "dialog");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(row).toBeFocused();
});

test("timeline events: add, edit and delete", async ({ page }) => {
  await gotoScreen(page, "/record/timeline", "Timeline");
  await page.getByRole("link", { name: "Add to your timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add to your timeline" })).toBeVisible();
  await page.getByRole("button", { name: "Save to timeline" }).click();
  await expect(page.getByText("Say what it was, like Chest infection.")).toBeVisible();
  await page.getByRole("textbox", { name: "What it was" }).fill("Ear infection");
  await page.getByLabel("Month").filter({ visible: true }).fill("2026-10");
  await page.getByRole("textbox", { name: /Seen by/ }).fill("Dr Hennessy");
  await page.getByRole("combobox", { name: "Outcome" }).selectOption("resolved");
  await page.getByRole("button", { name: "Add a medicine" }).click();
  await page.getByRole("textbox", { name: "Medicine 1" }).fill("Clarithromycin 250mg");
  await page.getByRole("textbox", { name: /How long/ }).fill("7 days");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save to timeline" }).click();

  // Back on the timeline with the new event open (a sheet on the phone, the pane beside the list from 1024px).
  const sheet = eventView(page, "Ear infection", desktop(page));
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByText("Oct 2026, Infection")).toBeVisible();
  await expect(sheet.getByText("Clarithromycin 250mg")).toBeVisible();
  await sheet.getByRole("link", { name: "Edit Ear infection" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit timeline" })).toBeVisible();
  await page.getByRole("button", { name: "Remove medicine 1" }).click();
  await page.getByRole("textbox", { name: /Doctor's notes/ }).fill("Cleared in a week.");
  await page.getByRole("button", { name: "Save changes" }).click();
  const again = eventView(page, "Ear infection", desktop(page));
  await expect(again.getByText("Cleared in a week.")).toBeVisible({ timeout: 10_000 });
  await expect(again.getByText("Prescribed")).toHaveCount(0);
  await again.getByRole("link", { name: "Edit Ear infection" }).click();
  await page.getByRole("button", { name: "Delete from timeline" }).click();
  await page.getByRole("dialog", { name: "Delete Ear infection?" }).getByRole("button", { name: "Delete from timeline" }).click();
  await page.waitForURL(/\/record\/timeline$/);
  await expect(page.getByRole("button", { name: /Ear infection/ })).toHaveCount(0);
});

test("visit detail: the result kind flags in words; the text kind's blocks; session notes read-only", async ({ page }) => {
  await gotoScreen(page, "/record", "Record");
  await page.getByRole("link", { name: /Blood count and INR/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Blood count and INR" })).toBeVisible();
  await expect(page.getByText("Result, 2 Nov 2026, ordered by Dr Hennessy, Mater Hospital")).toBeVisible();
  const results = page.getByRole("list", { name: "Results" }).getByRole("listitem");
  await expect(results).toHaveText([
    /Haemoglobin\s*128 g\/L$/,
    /White cells\s*6\.2 x10⁹\/L$|White cells\s*6\.2 ×10⁹\/L$/,
    /Platelets\s*245/,
    /INR\s*2\.4$/,
    /Ferritin\s*18 µg\/L, low$/,
  ]);
  await expect(page.getByRole("img", { name: "Ferritin 18 µg/L, low. Normal range 30 to 300." })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Haemoglobin 128 g\/L, in range/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  await page.getByRole("link", { name: "Back to Record" }).click();
  // From 1024px the entry's screen has the Record list beside it: wait for that screen to go.
  await expect(page.getByRole("heading", { level: 1, name: "Blood count and INR" })).toBeHidden();
  await page.getByRole("link", { name: /GP visit/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "GP visit" })).toBeVisible();
  await expect(page.getByRole("term")).toHaveText(["Reason", "Assessment", "Plan"]);
  await expect(page.getByRole("definition").first()).toHaveText("Tired for three weeks");
  await expect(page.getByRole("link", { name: "Edit GP visit" })).toBeVisible();
  await expectNoAxeViolations(page);

  // A prescription shows its own fields first.
  await page.getByRole("link", { name: "Back to Record" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "GP visit" })).toBeHidden();
  await page.getByRole("link", { name: /Warfarin renewed/ }).click();
  await expect(page.getByRole("term")).toHaveText(["Medication", "Quantity", "Pharmacy"]);
  await expect(page.getByRole("definition")).toHaveText(["Warfarin 5mg, daily", "28 tablets", "Boots, Rathmines"]);
});

test("family tree: drawn from the data, the same as a list for assistive tech, the sheet and the filter (FamilyA2)", async ({ page }) => {
  await gotoScreen(page, "/record?tab=family", "Record");
  await page.getByRole("link", { name: /Family tree/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Family history" })).toBeVisible();
  const tree = page.getByRole("list", { name: "Family tree" });
  await expect(tree.getByRole("listitem")).toHaveText([
    /Mum's mum\s*,?\s*Type 2 diabetes/,
    /Mum's dad\s*,?\s*None known/,
    /Dad's mum\s*,?\s*Asthma/,
    /Dad's dad\s*,?\s*Heart attack at 61/,
    /Mum\s*,?\s*Type 2 diabetes/,
    /Dad\s*,?\s*Atrial fibrillation/,
    /You\s*,?\s*3 conditions/,
    /Brother\s*,?\s*Asthma/,
  ]);
  await expect(tree.getByRole("button", { name: /^Dad's dad ?, Heart attack at 61$/ })).toBeVisible();
  await expect(page.getByText("Tap a condition to see who has it.")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // The filter: who has a heart condition, in words.
  await page.getByRole("radiogroup", { name: "Show relatives with" }).getByRole("radio", { name: "Heart" }).click();
  await expect(page.getByText("Heart: Dad's dad, Dad, You")).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoAxeViolations(page);

  // A relative's sheet, then edit their conditions.
  await tree.getByRole("button", { name: /^Dad's dad/ }).click();
  const sheet = page.getByRole("dialog", { name: "Dad's dad" });
  await expect(sheet.getByText("Heart attack")).toBeVisible();
  await expect(sheet.getByText("Diagnosed at 61, Heart")).toBeVisible();
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("link", { name: "Edit Dad's dad" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit Dad's dad" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Add a condition" }).click();
  await page.getByRole("textbox", { name: "Condition 2" }).fill("Type 2 diabetes");
  await page.getByRole("combobox", { name: "Group" }).nth(1).selectOption("diabetes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/record\/family$/);
  await expect(tree.getByRole("listitem").nth(3)).toHaveText(/Dad's dad.*Heart attack at 61, Type 2 diabetes at|Dad's dad.*Heart attack at 61, Type 2 diabetes/);

  // ?relative= opens a sheet; ?add=relative goes to the form.
  const rel = (await clientFor(file).from("relatives").select("id").eq("relation", "mother").single()).data!.id;
  await gotoScreen(page, `/record/family?relative=${rel}`, "Family history");
  await expect(page.getByRole("dialog", { name: "Mum" })).toBeVisible();
  await gotoScreen(page, "/record/family?add=relative", "Add a relative");

  // Add a sister: she joins your row.
  await page.getByRole("combobox", { name: "Who" }).selectOption("sister");
  await page.getByRole("textbox", { name: "Condition 1" }).fill("Asthma");
  await page.getByRole("combobox", { name: "Group" }).selectOption("asthma");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save relative" }).click();
  await page.waitForURL(/\/record\/family$/);
  await expect(tree.getByRole("listitem")).toHaveCount(9);
  await expect(tree.getByRole("button", { name: /^Sister/ })).toBeVisible();
  await expectNoSideScroll(page);

  // Remove her again.
  await tree.getByRole("button", { name: /^Sister/ }).click();
  await page.getByRole("dialog", { name: "Sister" }).getByRole("link", { name: "Edit Sister" }).click();
  await page.getByRole("button", { name: "Remove relative" }).click();
  await page.getByRole("dialog", { name: "Remove Sister?" }).getByRole("button", { name: "Remove relative" }).click();
  await page.waitForURL(/\/record\/family$/);
  await expect(tree.getByRole("listitem")).toHaveCount(8);
});

test("insurance: the mocked provider sign-in, the connected card, disconnect, and manual entry (InsuranceA2)", async ({ page }) => {
  await gotoScreen(page, "/profile", "Profile");
  await page.getByRole("link", { name: "Insurance" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Insurance" })).toBeVisible();
  await expect(page.getByText("Choose your provider and sign in with them. Trace never sees your password.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Providers" }).getByRole("listitem")).toHaveText([
    "VHI",
    "Laya Healthcare",
    "Irish Life Health",
    "Other provider",
  ]);
  await expect(page.getByText("Read only. You can disconnect any time.")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: "VHI" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in with VHI" });
  await expect(sheet.getByText(/Trace never sees your password/)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await sheet.getByRole("button", { name: "Continue" }).click();

  const card = page.getByRole("region", { name: "VHI insurance" });
  await expect(card.getByText("Connected")).toBeVisible();
  await expect(card.getByText("•••• 4821")).toBeVisible();
  await expect(card.getByText("Comprehensive plan")).toBeVisible();
  await expect(card.getByText("Renews 1 Mar 2027")).toBeVisible();
  // Insurance is personal: no "Include in shares" (owner's decision).
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Include in shares")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
  const { data: rows } = await clientFor(file).from("insurance_connections").select("provider, member_number_last4, via");
  expect(rows).toEqual([{ provider: "VHI", member_number_last4: "4821", via: "provider" }]);

  await page.getByRole("button", { name: "Disconnect" }).click();
  await page.getByRole("dialog", { name: "Disconnect VHI?" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("list", { name: "Providers" })).toBeVisible();
  expect((await clientFor(file).from("insurance_connections").select("id")).data).toEqual([]);

  // Manual entry, from "Other provider".
  await page.getByRole("link", { name: "Other provider" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Other provider" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("textbox", { name: "Provider" }).fill("HSF Health Plan");
  await page.getByRole("textbox", { name: "Member number" }).fill("12");
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByText("Enter your member number. It has at least 4 letters or numbers.")).toBeVisible();
  await page.getByRole("textbox", { name: "Member number" }).fill("HSF 7731 0092");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save policy" }).click();
  const manual = page.getByRole("region", { name: "HSF Health Plan insurance" });
  await expect(manual.getByText("Added by you")).toBeVisible({ timeout: 10_000 });
  await expect(manual.getByText("•••• 0092")).toBeVisible();
});

/** A tiny real PNG (1 x 1). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("documents: the limits first, the refusals in words, upload, open with safe headers, delete", async ({ page }) => {
  await gotoScreen(page, "/profile/documents", "Documents");
  await expect(page.getByText("No documents yet.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Upload a document" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Upload a document" })).toBeVisible();
  // Focused flow: no tab bar. The limits are on the screen before anything fails.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByText("PDF, JPEG or PNG, up to 3 MB. The demo keeps up to 5 files, 3 MB in all.")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  const input = page.getByLabel("File", { exact: true });
  // Not a PDF, though it says so.
  await input.setInputFiles({ name: "letter.pdf", mimeType: "application/pdf", buffer: Buffer.from("hello, not a pdf") });
  await expect(page.getByText("letter.pdf isn't a PDF, JPEG or PNG. Choose one of those.")).toBeVisible();
  // Too big.
  const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
  await input.setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: big });
  await expect(page.getByText("scan.png is 3 MB. Choose a file of 3 MB or less.")).toBeVisible();
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(input).toBeFocused();
  expect((await clientFor(file).from("documents").select("id")).data).toEqual([]);

  // A real PNG.
  await input.setInputFiles({ name: "Discharge letter.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(/^PNG, 1 KB$/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Discharge letter");
  await page.getByLabel(/Date on the document/).filter({ visible: true }).fill("2026-11-02");
  await page.getByRole("button", { name: "Upload" }).click();
  await page.waitForURL(/\/profile\/documents$/);
  const list = page.getByRole("list", { name: "Your documents" });
  await expect(list.getByRole("link")).toHaveText([/Discharge letter\s*2 Nov 2026, Photo/]);
  await expectNoAxeViolations(page);

  await list.getByRole("link", { name: /Discharge letter/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Discharge letter" })).toBeVisible();
  const open = page.getByRole("link", { name: "Open (opens in a new tab)" });
  await expect(open).toHaveAttribute("target", "_blank");
  await expectNoAxeViolations(page);

  // The file, as the browser gets it: its own response with the safe headers, never a page.
  const res = await page.request.get((await open.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h["content-type"]).toBe("image/png");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toMatch(/(^|;\s*)sandbox(;|$)/);
  expect(h["cache-control"]).toBe("no-store");
  expect(Buffer.from(await res.body()).equals(PNG)).toBe(true);
  // Someone else's id, or no session: nothing.
  expect((await page.request.get("/api/documents/00000000-0000-4000-8000-000000000000")).status()).toBe(404);

  await page.getByRole("button", { name: "Delete document" }).click();
  await page.getByRole("dialog", { name: "Delete Discharge letter?" }).getByRole("button", { name: "Delete document" }).click();
  await page.waitForURL(/\/profile\/documents$/);
  await expect(page.getByText("No documents yet.")).toBeVisible();
});
