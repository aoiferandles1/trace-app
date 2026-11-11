import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expectNoAxeViolations } from "./axe";
import { clientFor, deleteUser, emptyRecord, expectNoSideScroll, reseed, signInDemo, statePath } from "./helpers/patient";

/**
 * The signed-in patient app (Phase 3 steps 3 to 7, and Phase 4), driven as one
 * anonymous demo user per Playwright project. See helpers/patient.ts for why.
 * Tests in this file run one after another and reset the record first.
 */

test.describe.configure({ mode: "default" });

let file = "";

test.beforeAll(async ({ browser }, info) => {
  file = statePath(info.project.name);
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

test("home shows Jane's record", async ({ page }) => {
  await gotoScreen(page, "/home", /^Good (morning|afternoon|evening), Jane$/);
  // The seed puts a GP visit on today, so Home is in its appointment-day state:
  // the today card with "Share record" (MainA2).
  const today = page.getByRole("region", { name: "GP visit today" });
  await expect(today.getByText("9:30")).toBeVisible();
  await expect(today.getByText("Dr Hennessy", { exact: true })).toBeVisible();
  await expect(today.getByText("Rathmines Medical Centre")).toBeVisible();
  await expect(today.getByRole("link", { name: "Share record" })).toHaveAttribute("href", /\/share\?appointment=/);
  // Coming up: the refill (urgent, in words), then the upcoming visits, soonest first.
  const coming = page.getByRole("list", { name: "Coming up" });
  // The refill is 8 days away: urgent only from 5 days down (owner's decision), so an ordinary tile.
  await expect(coming.getByRole("link")).toHaveText([/Warfarin refill/, /INR blood test/, /Cardiology follow-up/]);
  await expect(coming.getByText("8 days")).toHaveCount(0);
  await expect(coming.getByRole("link", { name: /Warfarin refill/ })).toHaveAttribute("href", /\/meds\//);
  // Recent: the three latest past entries, not today's visit (it is on the card).
  const recent = page.getByRole("region", { name: "Recent" });
  await expect(recent.getByRole("link")).toHaveText([
    /Blood count and INR.*Result/,
    /Fatigue symptoms.*Note/,
    /Warfarin renewed.*Prescription/,
  ]);
  await expect(page.getByText("Upload doc")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
});

test("record: safety facts and the three tabs", async ({ page }) => {
  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Penicillin allergy")).toBeVisible();
  await expect(strip.getByText("Blood type A+")).toBeVisible();

  // Timeline: upcoming first (dates in accent, "upcoming" in words), then the past.
  const tabs = page.getByRole("tablist", { name: "Record sections" });
  await expect(tabs.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: "Timeline" });
  await expect(panel.getByRole("listitem")).toHaveText([
    /Cardiology follow-up.*Visit.*upcoming/,
    /INR blood test.*Visit.*upcoming/,
    /GP visit.*Visit/,
    /Blood count and INR.*Result/,
    /Fatigue symptoms.*Note/,
    /Warfarin renewed.*Prescription/,
  ]);
  // Past rows open their detail; upcoming ones are not clickable (BRIEF.md 4.3).
  await expect(panel.getByRole("link").filter({ hasNotText: "View full timeline" })).toHaveText([
    /GP visit.*Visit/,
    /Blood count and INR.*Result/,
    /Fatigue symptoms.*Note/,
    /Warfarin renewed.*Prescription/,
  ]);
  await expect(panel.getByRole("link", { name: /Cardiology follow-up/ })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: /INR blood test/ })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "View full timeline" })).toHaveAttribute("href", "/record/timeline");
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // The tabs are a tablist: arrow keys move between them.
  await tabs.getByRole("tab", { name: "Timeline" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Conditions" })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: "Conditions" })).toBeFocused();
  const conditions = page.getByRole("tabpanel", { name: "Conditions" });
  await expect(conditions.getByRole("link", { name: /Atrial fibrillation.*Dr O'Mahony, since 2019.*Managed/ })).toBeVisible();
  await expect(conditions.getByRole("link", { name: /Hypothyroidism.*Dr Walsh, since 2022.*Ongoing/ })).toBeVisible();
  await expect(conditions.getByRole("link", { name: /Mild asthma.*Dr Hennessy, since childhood.*Managed/ })).toBeVisible();
  await expect(conditions.getByRole("link", { name: "Add a condition" })).toBeVisible();
  await expect(page).toHaveURL(/\/record\?tab=conditions$/);
  await page.waitForTimeout(300); // let the tab's colour transition finish before axe measures contrast
  await expectNoAxeViolations(page);

  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "Family" })).toHaveAttribute("aria-selected", "true");
  const family = page.getByRole("tabpanel", { name: "Family" });
  await expect(family.getByRole("link", { name: /Family tree.*7 relatives/ })).toHaveAttribute("href", "/record/family");
  await expect(family.getByRole("link", { name: /^Mum Type 2 diabetes/ })).toBeVisible();
  await expect(family.getByRole("link", { name: /^Dad Atrial fibrillation/ })).toBeVisible();
  await expect(family.getByRole("link", { name: "Add a relative" })).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // A condition's detail goes back to the Conditions tab.
  await tabs.getByRole("tab", { name: "Conditions" }).click();
  await conditions.getByRole("link", { name: /Atrial fibrillation/ }).click();
  // The condition is the title, with its status and since when under it (as visit detail).
  await expect(page.getByRole("heading", { level: 1, name: "Atrial fibrillation" })).toBeVisible();
  await expect(page.getByText("Managed, since 2019")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Back to Record" }).click();
  // From 1024px the condition's screen has the Record list beside it: wait for that screen to go.
  await expect(page.getByRole("heading", { level: 1, name: "Atrial fibrillation" })).toBeHidden();
  await expect(page.getByRole("tab", { name: "Conditions" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("link", { name: /Blood count and INR/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Blood count and INR" })).toBeVisible();
  await expect(page.getByText("Mater Hospital").filter({ visible: true }).first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("meds: Current and Past (MedsA2)", async ({ page }) => {
  await gotoScreen(page, "/meds", "Medications");
  const tabs = page.getByRole("radiogroup", { name: "Medication list" });
  await expect(tabs.getByRole("radio", { name: "Current" })).toBeChecked();
  const current = page.getByRole("list", { name: "Current medications" });
  // Name, sub line and strength; the warfarin refill is 8 days away, so its line is ordinary (urgent from 5 days).
  await expect(current.getByRole("link")).toHaveText([
    /^Concerta\s*Morning, 4 strength changes\s*36mg$/,
    /^Levothyroxine\s*Morning, 1 strength change\s*50mcg$/,
    /^Warfarin\s*Evening\s*5mg$/,
    /^Salbutamol\s*As needed\s*100mcg$/,
  ]);
  await expect(page.getByRole("button", { name: "Request repeat prescription" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // Past: start and end dates, prescriber and strength.
  await tabs.getByRole("radio", { name: "Past" }).click();
  await expect(page).toHaveURL(/\/meds\?tab=past$/);
  const past = page.getByRole("list", { name: "Past medications" });
  await expect(past.getByRole("link")).toHaveText([
    /^Doxycycline\s*2 Aug to 9 Aug 2026, Dr Hennessy\s*100mg$/,
    /^Prednisolone\s*9 Feb to 14 Feb 2026, Dr Hennessy\s*20mg$/,
    /^Nitrofurantoin\s*12 Sep to 17 Sep 2025, Dr Hennessy\s*100mg$/,
    /^Cetirizine\s*1 Apr to 30 Sep 2024, Dr Hennessy\s*10mg$/,
  ]);
  await page.waitForTimeout(300); // the segment's colour transition
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
});

test("meds: a refill 5 days away or less is urgent, in words", async ({ page }) => {
  const db = clientFor(file);
  const inThree = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(Date.now() + 3 * 86_400_000));
  expect((await db.from("medications").update({ refill_due_on: inThree }).eq("name", "Warfarin")).error).toBeNull();
  await gotoScreen(page, "/meds", "Medications");
  await expect(page.getByRole("link", { name: /^Warfarin\s*Evening, 3 days left/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await gotoScreen(page, "/home", /^Good/);
  await expect(page.getByRole("list", { name: "Coming up" }).getByRole("link", { name: /3 days.*Warfarin refill/ })).toBeVisible();
});

test("add: the sheet of plain rows, then a note from start to delete", async ({ page }, info) => {
  const rows = [
    ["Add a visit", "/add/appointment"],
    ["Add a medication", "/add/medication"],
    ["Add a condition", "/record/conditions/new"],
    ["Add a relative", "/record/family/new"],
    ["Upload a document", "/profile/documents/upload"],
    ["Log a note", "/add/note"],
    ["Add to your timeline", "/record/timeline/new"],
  ];
  // The address shows the rows as a screen (the desktop rail's Add goes here).
  await gotoScreen(page, "/add", "Add to my record");
  const list = page.getByRole("list", { name: "What to add" });
  await expect(list.getByRole("link")).toHaveText(rows.map(([name]) => name));
  for (const [name, href] of rows) await expect(list.getByRole("link", { name })).toHaveAttribute("href", href);
  for (const hidden of ["Scan or photograph", "Record a vaccination", "Upload a receipt"]) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }
  await expectNoAxeViolations(page);

  if (info.project.name === "phone") {
    // On the phone the tab bar's plus opens the same rows as a sheet over the current screen.
    await gotoScreen(page, "/home", /^Good/);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add to my record" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link")).toHaveText(rows.map(([name]) => name));
    await expectNoAxeViolations(page, "dialog");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await sheet.getByRole("link", { name: "Log a note" }).click();
  } else {
    await list.getByRole("link", { name: "Log a note" }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "Log a note" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Give the note a title.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();

  await page.getByRole("textbox", { name: "Title" }).fill("Headaches after lunch");
  await page.getByRole("textbox", { name: "Note" }).fill("Three days this week.");
  await page.getByRole("switch", { name: "About mental health" }).click();
  await page.getByRole("button", { name: "Save note" }).click();
  await page.waitForURL(/\/record$/);
  await page.getByRole("link", { name: /Headaches after lunch/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Headaches after lunch" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Three days this week." }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/About mental health\. Left out of a share/)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Edit Headaches after lunch" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit note" })).toBeVisible();
  await page.getByRole("textbox", { name: "Title" }).fill("Headaches after lunch, better now");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Headaches after lunch, better now" })).toBeVisible();

  await page.getByRole("button", { name: "Delete entry" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete this entry?" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Delete entry" }).click();
  await page.waitForURL(/\/record$/);
  await expect(page.getByRole("link", { name: /Headaches after lunch/ })).toHaveCount(0);
  // Back to the deleted entry's screen (kept in memory by Next.js): the confirm sheet must not reopen.
  await page.goBack();
  await expect(page.getByText(/isn't in your record/).filter({ visible: true })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => document.querySelectorAll("dialog[open]").length)).toBe(0);
});

test("add: an upcoming appointment shows in Home's Coming up", async ({ page }) => {
  // On a day with no appointment (no today card).
  const db = clientFor(file);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
  const { data: visits } = await db.from("entries").select("id, occurs_at").eq("kind", "visit");
  for (const v of visits ?? []) {
    if (new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(v.occurs_at)) === today) {
      expect((await db.from("entries").delete().eq("id", v.id)).error).toBeNull();
    }
  }
  await gotoScreen(page, "/add/appointment", "Add a visit");
  await expectNoAxeViolations(page);
  const inTwoDays = new Date(Date.now() + 2 * 86_400_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(inTwoDays);
  await page.getByRole("textbox", { name: "Title" }).fill("Dental check-up");
  await page.getByLabel("Date").filter({ visible: true }).fill(day);
  await page.getByLabel("Time").filter({ visible: true }).fill("10:15");
  await page.getByRole("textbox", { name: /Doctor or clinician/ }).fill("Dr Byrne");
  await page.getByRole("textbox", { name: /Where/ }).fill("Ranelagh Dental");
  await page.getByRole("button", { name: "Save to my record" }).click();
  await page.waitForURL(/\/record$/);
  await gotoScreen(page, "/home", /^Good/);
  await expect(page.getByRole("region", { name: /today$/ })).toHaveCount(0);
  const coming = page.getByRole("list", { name: "Coming up" });
  await expect(coming.getByRole("link").first()).toHaveText(/Dental check-up/);
  await coming.getByRole("link", { name: /Dental check-up/ }).click();
  await expect(page.getByText("Ranelagh Dental").filter({ visible: true }).first()).toBeVisible();
});

test("add, edit, end and delete a medication", async ({ page }) => {
  await gotoScreen(page, "/meds", "Medications");
  await page.getByRole("link", { name: "Add a medication" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a medication" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Name" }).fill("Vitamin D");
  await page.getByRole("textbox", { name: /^Strength/ }).fill("1000IU");
  await page.getByRole("textbox", { name: /^Form/ }).fill("Capsule");
  await page.getByRole("textbox", { name: /How often/ }).fill("once daily");
  await page.getByRole("textbox", { name: /^When/ }).fill("morning");
  await page.getByRole("button", { name: "Save medication" }).click();
  await page.waitForURL(/\/meds$/);
  // The strength became its first period (the unit was read from "1000IU").
  await page.getByRole("link", { name: /^Vitamin D\s*Morning\s*1000IU$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vitamin D" })).toBeVisible();
  await expect(page.getByText(/^Now 1000IU, since /)).toBeVisible();
  await page.getByRole("link", { name: "Edit Vitamin D" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit medication" })).toBeVisible();
  // The strength is not edited here: that is a strength change.
  await expect(page.getByRole("textbox", { name: /^Strength/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "log a strength change" })).toBeVisible();
  await expectNoAxeViolations(page);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(Date.now() - 86_400_000));
  await page.getByLabel(/Ends or ended/).filter({ visible: true }).fill(yesterday);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vitamin D" })).toBeVisible();
  await expect(page.getByText(/^Stopped /)).toBeVisible();
  await expect(page.getByRole("link", { name: "Log a strength change" })).toHaveCount(0);
  await gotoScreen(page, "/meds?tab=past", "Medications");
  await page.getByRole("link", { name: /^Vitamin D/ }).click();
  await page.getByRole("link", { name: "Edit Vitamin D" }).click();
  await page.getByRole("button", { name: "Delete medication" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete medication" }).click();
  await page.waitForURL(/\/meds$/);
  await expect(page.getByRole("link", { name: /Vitamin D/ })).toHaveCount(0);
});

test("add and edit a condition with the mental health switch", async ({ page }) => {
  await gotoScreen(page, "/record?tab=conditions", "Record");
  await page.getByRole("link", { name: "Add a condition" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a condition" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Condition" }).fill("Anxiety");
  await page.getByRole("textbox", { name: /Year diagnosed/ }).fill("2021");
  await page.getByRole("switch", { name: "About mental health" }).click();
  await page.getByRole("button", { name: "Save condition" }).click();
  await page.waitForURL(/\/record\?tab=conditions$/);
  await page.getByRole("link", { name: /Anxiety/ }).click();
  await expect(page.getByText(/About mental health\. Left out of a share/)).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("combobox", { name: "Status" }).selectOption("resolved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Resolved, since 2021")).toBeVisible();
  await page.getByRole("link", { name: "Back to Record" }).click();
  await expect(page.getByRole("tabpanel", { name: "Conditions" }).getByRole("link", { name: /Anxiety.*since 2021.*Resolved/ })).toBeVisible();
});

test("profile: the list, details, edit with critical safety, care team, export", async ({ page }) => {
  await gotoScreen(page, "/profile", "Profile");
  await expect(page.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeVisible();
  const list = page.getByRole("list", { name: "Your record and settings" });
  await expect(list.getByRole("link")).toHaveText([
    "Your details",
    "Share my record",
    "Insurance",
    "Documents",
    "Care team",
    "Share history",
    "Privacy and security",
  ]);
  await expect(list.getByRole("button", { name: "Reset demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByText("Verified")).toHaveCount(0);
  await expect(page.getByText("PPS number")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  // Privacy and security: export (every table, version 2).
  await list.getByRole("link", { name: "Privacy and security" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy and security" })).toBeVisible();
  await expectNoAxeViolations(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export my data/ }).click();
  const file = await (await download).path();
  const exported = JSON.parse(readFileSync(file, "utf8"));
  expect(exported.version).toBe(2);
  expect(exported.profile.first_name).toBe("Jane");
  expect(exported.medications).toHaveLength(8);
  expect(exported.relatives).toHaveLength(7);

  // Your details, then edit with critical safety.
  await gotoScreen(page, "/profile/details", "Your details");
  await expect(page.getByText("12 March 1991")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Edit details" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit profile" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: /Known allergies/ }).fill("Penicillin, Latex");
  await page.getByRole("textbox", { name: /Implants or devices/ }).fill("Pacemaker");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/profile\/details$/);
  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Latex allergy")).toBeVisible();
  await expect(strip.getByText("Pacemaker")).toBeVisible();

  // Care team.
  await gotoScreen(page, "/profile/care-team", "Care team");
  await expect(page.getByRole("link", { name: /Dr Hennessy.*GP/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Add to your care team" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add to care team" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Name" }).fill("Dr Byrne");
  await page.getByRole("combobox", { name: "Type" }).selectOption("specialist");
  await page.getByRole("textbox", { name: /Role or specialty/ }).fill("Dentist");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/profile\/care-team$/);
  await page.getByRole("link", { name: /Dr Byrne.*Dentist/ }).click();
  await page.getByRole("textbox", { name: /Practice, clinic or shop/ }).fill("Ranelagh Dental");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/profile\/care-team$/);
  await expect(page.getByRole("link", { name: /Dr Byrne.*Ranelagh Dental/ })).toBeVisible();
  await page.getByRole("link", { name: /Dr Byrne/ }).click();
  await page.getByRole("button", { name: "Remove from care team" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove from care team" }).click();
  await page.waitForURL(/\/profile\/care-team$/);
  await expect(page.getByRole("link", { name: /Dr Byrne/ })).toHaveCount(0);
});

test("a brand-new record shows empty states", async ({ page }) => {
  await emptyRecord(clientFor(file));
  await gotoScreen(page, "/home", /^Good/);
  await expect(page.getByText("Your record is empty.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to my record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming up" })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await gotoScreen(page, "/record", "Record");
  await expect(page.getByText("No allergies or blood type recorded")).toBeVisible();
  // The record's four sections load together; under a full parallel run that can take longer than 5 s.
  await expect(page.getByText(/Nothing on your timeline yet/)).toBeVisible({ timeout: 20_000 });
  await expectNoAxeViolations(page);
  await page.getByRole("tab", { name: "Conditions" }).click();
  await expect(page.getByText("No conditions yet.")).toBeVisible();

  await gotoScreen(page, "/meds", "Medications");
  await expect(page.getByText("No current medications.")).toBeVisible();
  await expectNoAxeViolations(page);

  await gotoScreen(page, "/profile/care-team", "Care team");
  await expect(page.getByText("No one on your care team yet.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("sign-up steps 3 to 7 resume, save to the profile and finish on Home", async ({ page }) => {
  const db = clientFor(file);
  const { data: user } = await db.auth.getUser();
  await db
    .from("profiles")
    .update({ onboarding_step: "about", first_name: null, last_name: null, date_of_birth: null, blood_type: null, allergies: [], terms_accepted_at: null })
    .eq("id", user.user!.id);

  // An unfinished sign-up is sent back to its step, and cannot skip ahead.
  await page.goto("/home");
  await page.waitForURL(/\/signup\/about$/);
  await page.goto("/signup/privacy");
  await page.waitForURL(/\/signup\/about$/);

  await expect(page.getByRole("heading", { level: 1, name: "Tell us a little about yourself." })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await page.getByRole("textbox", { name: "First name" }).fill("Jane");
  await page.getByRole("textbox", { name: "Last name" }).fill("Doe");
  await page.getByLabel("Date of birth").filter({ visible: true }).fill("1991-03-12");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.waitForURL(/\/signup\/medical$/);
  await expect(page.getByRole("heading", { level: 1, name: "Critical safety information." })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("combobox", { name: "Blood type" }).selectOption("A+");
  await page.getByRole("textbox", { name: "Known allergies" }).fill("Penicillin");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.waitForURL(/\/signup\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your data, your rights." })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page.getByText("Turn on the agreement to continue.")).toBeVisible();
  await page.getByRole("switch", { name: /I agree to Trace's Terms of Service/ }).click();
  await page.getByRole("button", { name: "I agree" }).click();

  await page.waitForURL(/\/signup\/profiles$/);
  await expect(page.getByRole("heading", { level: 1, name: "Set up your first share profile." })).toBeVisible();
  await expect(page.getByText("Add Emergency and Specialist profiles later")).toHaveCount(0);
  await expectNoAxeViolations(page);

  // Leaving and coming back resumes here.
  await page.goto("/home");
  await page.waitForURL(/\/signup\/profiles$/);
  await page.getByRole("button", { name: "Set up GP visit profile" }).click();

  await page.waitForURL(/\/signup\/welcome$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Trace, Jane!" })).toBeVisible();
  await expect(page.getByText("Blood type A+ · Penicillin allergy")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
  await page.getByRole("button", { name: "Go to my record" }).click();
  await page.waitForURL(/\/home$/);

  const { data: profile } = await db.from("profiles").select("*").eq("id", user.user!.id).single();
  expect(profile!.onboarding_step).toBe("done");
  expect(profile!.date_of_birth).toBe("1991-03-12");
  expect(profile!.allergies).toEqual(["Penicillin"]);
  expect(profile!.terms_accepted_at).not.toBeNull();
});

/** "YYYY-MM-DD" in Irish time, `days` from today. */
function dublinDay(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(Date.now() + days * 86_400_000));
}

/**
 * The Phase 4 acceptance check (PLAN.md section 12): starting from an empty
 * record, enter the whole of Jane Doe's record by hand through the screens,
 * then check each screen shows it. Phone only, to keep the run short.
 */
test("Jane Doe's record entered by hand shows on every screen", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Runs once, at phone width");
  test.setTimeout(300_000);
  const db = clientFor(file);
  await emptyRecord(db);
  const { data: user } = await db.auth.getUser();
  await db
    .from("profiles")
    .update({ first_name: "Jane", last_name: "Doe", date_of_birth: null, sex: null, address: null, city: null, phone: null })
    .eq("id", user.user!.id);

  // Profile and critical safety.
  await gotoScreen(page, "/profile/edit", "Edit profile");
  await page.getByLabel(/Date of birth/).filter({ visible: true }).fill("1991-03-12");
  await page.getByRole("textbox", { name: /^Sex/ }).fill("Female");
  await page.getByRole("textbox", { name: /^Phone/ }).fill("+353 86 123 4567");
  await page.getByRole("textbox", { name: /^Address/ }).fill("Rathmines, Dublin 6");
  await page.getByRole("textbox", { name: /Town or city/ }).fill("Dublin");
  await page.getByRole("combobox", { name: "Blood type" }).selectOption("A+");
  await page.getByRole("textbox", { name: /Known allergies/ }).fill("Penicillin");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/profile\/details$/);

  // Conditions.
  const conditions: [string, string, string, string, string, string][] = [
    ["Atrial fibrillation", "managed", "Dr O'Mahony", "Cardiology", "2019", ""],
    ["Hypothyroidism", "ongoing", "Dr Walsh", "Endocrinology", "2022", ""],
    ["Mild asthma", "managed", "Dr Hennessy", "GP", "", "since childhood"],
  ];
  for (const [name, status, doctor, specialty, year, note] of conditions) {
    await gotoScreen(page, "/record/conditions/new", "Add a condition");
    await page.getByRole("textbox", { name: "Condition" }).fill(name);
    await page.getByRole("combobox", { name: "Status" }).selectOption(status);
    await page.getByRole("textbox", { name: /^Doctor/ }).fill(doctor);
    await page.getByRole("textbox", { name: /^Specialty/ }).fill(specialty);
    if (year) await page.getByRole("textbox", { name: /Year diagnosed/ }).fill(year);
    if (note) await page.getByRole("textbox", { name: /Or when it started/ }).fill(note);
    await page.getByRole("button", { name: "Save condition" }).click();
    await page.waitForURL(/\/record\?tab=conditions$/);
  }

  // Medications: three current, two expired.
  const meds = [
    { Name: "Warfarin", Strength: "5mg", Form: "Tablet", "How often": "once daily", When: "evening", "Drug class": "Anticoagulant", "What it's for": "Atrial fibrillation", "Prescribed by": "Dr O'Mahony", "Their specialty": "Cardiology", "Clinic or hospital": "Mater Private", Started: "2019-01-01", "Next refill due": dublinDay(8), Instructions: "Take at the same time each evening. Needs regular INR blood tests." },
    { Name: "Levothyroxine", Strength: "50mcg", Form: "Tablet", "How often": "once daily", When: "morning", "Drug class": "Thyroid", "What it's for": "Hypothyroidism", "Prescribed by": "Dr Walsh", "Their specialty": "Endocrinology", Started: "2022-01-01", Instructions: "Take on an empty stomach, 30 minutes before breakfast." },
    { Name: "Salbutamol", Strength: "100mcg", Form: "Inhaler", "How often": "as needed", "Drug class": "Bronchodilator", "What it's for": "Asthma", "Prescribed by": "Dr Hennessy", "Their specialty": "GP", "Clinic or hospital": "Rathmines Medical Centre", Started: "2015-01-01", Instructions: "One to two puffs when wheezing or breathless." },
    { Name: "Clarithromycin", Strength: "500mg", Form: "Tablet", "How often": "twice daily", "Drug class": "Antibiotic", Started: dublinDay(-130), "Ends or ended": dublinDay(-123) },
    { Name: "Prednisolone", Strength: "5mg", Form: "Tablet", "How often": "once daily", When: "morning", "Drug class": "Steroid", Started: dublinDay(-200), "Ends or ended": dublinDay(-186) },
  ];
  for (const med of meds) {
    await gotoScreen(page, "/add/medication", "Add a medication");
    for (const [label, value] of Object.entries(med)) {
      await page.getByLabel(new RegExp(`^${label.replace(/[?']/g, ".")}`)).filter({ visible: true }).fill(value);
    }
    await page.getByRole("button", { name: "Save medication" }).click();
    await page.waitForURL(/\/meds$/);
  }

  // Timeline entries and appointments.
  const entries = [
    { kind: "visit", title: "GP visit", day: 0, time: "09:30", doctor: "Dr Hennessy", where: "Rathmines Medical Centre" },
    { kind: "result", title: "Blood test, full blood count and INR", day: -9, time: "10:15", doctor: "Dr Hennessy", where: "Mater Hospital" },
    { kind: "prescription", title: "Warfarin prescription renewed", day: -12, time: "11:00", where: "Boots, Rathmines" },
    { kind: "visit", title: "Cardiology review", day: -43, time: "14:00", doctor: "Dr O'Mahony", where: "Mater Private" },
    { kind: "visit", title: "INR blood test", day: 14, time: "09:30", where: "Rathmines Medical Centre" },
    { kind: "visit", title: "Cardiology follow-up", day: 48, time: "14:00", doctor: "Dr O'Mahony", where: "Mater Private" },
  ];
  for (const e of entries) {
    await gotoScreen(page, "/add/appointment", "Add a visit");
    await page.getByRole("combobox", { name: "What kind" }).selectOption(e.kind);
    await page.getByRole("textbox", { name: "Title" }).fill(e.title);
    await page.getByLabel("Date").filter({ visible: true }).fill(dublinDay(e.day));
    await page.getByLabel("Time").filter({ visible: true }).fill(e.time);
    if (e.doctor) await page.getByRole("textbox", { name: /Doctor or clinician/ }).fill(e.doctor);
    await page.getByRole("textbox", { name: /^Where/ }).fill(e.where);
    await page.getByRole("button", { name: "Save to my record" }).click();
    await page.waitForURL(/\/record$/);
  }
  await gotoScreen(page, "/add/note", "Log a note");
  await page.getByRole("textbox", { name: "Title" }).fill("Personal note added");
  await page.getByLabel("Date").filter({ visible: true }).fill(dublinDay(-11));
  await page.getByLabel("Time").filter({ visible: true }).fill("20:00");
  await page.getByRole("textbox", { name: "Note" }).fill("Fatigue symptoms");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.waitForURL(/\/record$/);

  // Care team.
  const team = [
    ["Dr Hennessy", "gp", "GP", "Rathmines Medical Centre"],
    ["Dr O'Mahony", "specialist", "Cardiology", "Mater Private"],
    ["Dr Walsh", "specialist", "Endocrinology", ""],
    ["Boots, Rathmines", "pharmacy", "Pharmacy", "Boots"],
  ];
  for (const [name, kind, role, org] of team) {
    await gotoScreen(page, "/profile/care-team/new", "Add to care team");
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("combobox", { name: "Type" }).selectOption(kind);
    await page.getByRole("textbox", { name: /Role or specialty/ }).fill(role);
    if (org) await page.getByRole("textbox", { name: /Practice, clinic or shop/ }).fill(org);
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/profile\/care-team$/);
  }

  // Every screen shows it.
  await gotoScreen(page, "/home", /^Good .*, Jane$/);
  // Today's hand-entered GP visit puts Home in its appointment-day state.
  const today = page.getByRole("region", { name: "GP visit today" });
  await expect(today.getByRole("link", { name: "Share record" })).toBeVisible();
  const coming = page.getByRole("list", { name: "Coming up" });
  await expect(coming.getByRole("link", { name: /Warfarin refill/ })).toBeVisible();
  await expect(coming.getByRole("link", { name: /INR blood test/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recent" }).getByRole("link", { name: /Blood test, full blood count and INR.*Result/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-home.png"), fullPage: true });

  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Penicillin allergy")).toBeVisible();
  await expect(strip.getByText("Blood type A+")).toBeVisible();
  await expect(page.getByRole("link", { name: /Blood test, full blood count and INR.*Result/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Personal note added.*Note/ })).toBeVisible();
  await page.getByRole("tab", { name: "Conditions" }).click();
  await expect(page.getByRole("link", { name: /Atrial fibrillation.*Dr O'Mahony, since 2019.*Managed/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mild asthma.*Dr Hennessy, since childhood/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-record.png"), fullPage: true });

  await gotoScreen(page, "/meds", "Medications");
  await expect(page.getByRole("list", { name: "Current medications" }).getByRole("link")).toHaveText([
    // Newest started first.
    /^Levothyroxine\s*Morning\s*50mcg$/,
    /^Warfarin\s*Evening\s*5mg$/,
    /^Salbutamol\s*As needed\s*100mcg$/,
  ]);
  await page.getByRole("radio", { name: "Past" }).click();
  await expect(page.getByRole("list", { name: "Past medications" }).getByRole("link")).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("by-hand-meds.png"), fullPage: true });

  await gotoScreen(page, "/profile", "Profile");
  await expect(page.getByText("Patient · Dublin, IE")).toBeVisible();
  await gotoScreen(page, "/profile/details", "Your details");
  await expect(page.getByText("+353 86 123 4567")).toBeVisible();
  await gotoScreen(page, "/profile/care-team", "Care team");
  await expect(page.getByRole("link", { name: /Dr Walsh.*Endocrinology.*Specialist/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Boots, Rathmines.*Pharmacy.*Boots/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-profile.png"), fullPage: true });
});

test("delete my account signs out and removes the user", async ({ page }) => {
  await gotoScreen(page, "/profile/privacy", "Privacy and security");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete your account?" });
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  const { data } = await clientFor(file).from("profiles").select("id");
  expect(data ?? []).toHaveLength(0);
});
