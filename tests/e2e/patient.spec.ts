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
  await expect(page.getByText("3 medications")).toBeAttached();
  await expect(page.getByText("8 days until refill")).toBeVisible();
  await expect(page.getByRole("link", { name: /Upcoming.*INR blood test/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Refill due soon.*Warfarin 5mg · 8 days left/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Blood test, full blood count and INR/ })).toBeVisible();
  // Out of scope (PLAN.md section 11): no Upload doc, no bell.
  await expect(page.getByText("Upload doc")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
});

test("record: critical strip, conditions, timeline and details", async ({ page }) => {
  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Penicillin allergy")).toBeVisible();
  await expect(strip.getByText("A+ Blood Type")).toBeVisible();
  await expect(page.getByRole("link", { name: /Atrial fibrillation.*managed/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mild asthma.*since childhood/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Personal note added.*Fatigue symptoms/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Upcoming, .*Cardiology follow-up/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  await page.getByRole("link", { name: /Atrial fibrillation/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Condition" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Atrial fibrillation" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Back to Record" }).click();
  await page.getByRole("link", { name: /Blood test, full blood count and INR/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Result" })).toBeVisible();
  await expect(page.getByText("Mater Hospital").filter({ visible: true }).first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("meds: current and expired", async ({ page }) => {
  await gotoScreen(page, "/meds", "My medication");
  await expect(page.getByText("3 active prescriptions · 2 expired in the last 12 months")).toBeVisible();
  await expect(page.getByRole("button", { name: /Warfarin 5mg/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Take at the same time each evening. Needs regular INR blood tests.")).toBeVisible();
  await expect(page.getByText("Anticoagulant")).toBeVisible();
  await expect(page.getByText("Bronchodilator")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request repeat prescription" })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.getByRole("tab", { name: "Expired" }).click();
  await expect(page.getByRole("tab", { name: "Expired" })).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(300); // let the tab's colour transition finish before axe measures contrast
  await expect(page.getByRole("button", { name: /Clarithromycin 500mg/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prednisolone 5mg/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Warfarin/ })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);
});

test("add: only the working tiles, then a note from start to delete", async ({ page }) => {
  await gotoScreen(page, "/add", "Add to my record");
  await expect(page.getByRole("link", { name: /Log appointment/ })).toBeVisible();
  for (const hidden of ["Upload document", "Scan or photograph", "Record a vaccination", "Family history", "Upload a receipt"]) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: /Write a note/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Write a note" })).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1, name: "Note" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Three days this week." }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/About mental health\. Left out of a share/)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit note" })).toBeVisible();
  await page.getByRole("textbox", { name: "Title" }).fill("Headaches after lunch, better now");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Headaches after lunch, better now" })).toBeVisible();

  await page.getByRole("button", { name: "Delete entry" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete this entry?" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Delete entry" }).click();
  await page.waitForURL(/\/record$/);
  await expect(page.getByRole("link", { name: /Headaches after lunch/ })).toHaveCount(0);
});

test("add: an upcoming appointment becomes Home's Upcoming card", async ({ page }) => {
  await gotoScreen(page, "/add/appointment", "Log appointment");
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
  await expect(page.getByRole("link", { name: /Upcoming.*Dental check-up · Dr Byrne/ })).toBeVisible();
  await expect(page.getByText(/10:15am · Ranelagh Dental/)).toBeVisible();
});

test("add, edit and delete a medication", async ({ page }) => {
  await gotoScreen(page, "/add/medication", "Add a medication");
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Name" }).fill("Vitamin D");
  await page.getByRole("textbox", { name: /Dose/ }).fill("1000IU");
  await page.getByRole("textbox", { name: /^Form/ }).fill("Capsule");
  await page.getByRole("textbox", { name: /How often/ }).fill("once daily");
  await page.getByRole("button", { name: "Save medication" }).click();
  await page.waitForURL(/\/meds$/);
  await expect(page.getByText("4 active prescriptions", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Vitamin D 1000IU/ }).click();
  await page.getByRole("link", { name: "Edit Vitamin D 1000IU" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit medication" })).toBeVisible();
  await expectNoAxeViolations(page);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(Date.now() - 86_400_000));
  await page.getByLabel(/Ends or ended/).filter({ visible: true }).fill(yesterday);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/meds$/);
  await expect(page.getByText("3 active prescriptions · 3 expired in the last 12 months")).toBeVisible();
  await page.getByRole("tab", { name: "Expired" }).click();
  await page.getByRole("button", { name: /Vitamin D/ }).click();
  await page.getByRole("link", { name: "Edit Vitamin D 1000IU" }).click();
  await page.getByRole("button", { name: "Delete medication" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete medication" }).click();
  await page.waitForURL(/\/meds$/);
  await expect(page.getByText("3 active prescriptions · 2 expired in the last 12 months")).toBeVisible();
});

test("add and edit a condition with the mental health switch", async ({ page }) => {
  await gotoScreen(page, "/record", "Record");
  await page.getByRole("link", { name: "Add a condition" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a condition" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Condition" }).fill("Anxiety");
  await page.getByRole("textbox", { name: /Year diagnosed/ }).fill("2021");
  await page.getByRole("switch", { name: "About mental health" }).click();
  await page.getByRole("button", { name: "Save condition" }).click();
  await page.waitForURL(/\/record$/);
  await page.getByRole("link", { name: /Anxiety/ }).click();
  await expect(page.getByText(/About mental health\. Left out of a share/)).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("combobox", { name: "Status" }).selectOption("resolved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Record" }).click();
  await expect(page.getByRole("heading", { name: "Resolved conditions" })).toBeVisible();
});

test("profile: details, edit with critical safety, care team, export", async ({ page }) => {
  await gotoScreen(page, "/profile", "My profile");
  await expect(page.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeVisible();
  await expect(page.getByText("12 March 1991")).toBeVisible();
  await expect(page.getByText("Verified")).toHaveCount(0);
  await expect(page.getByText("PPS number")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Dr Hennessy.*GP/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoSideScroll(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const file = await (await download).path();
  const exported = JSON.parse(readFileSync(file, "utf8"));
  expect(exported.profile.first_name).toBe("Jane");
  expect(exported.medications).toHaveLength(5);

  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit profile" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: /Known allergies/ }).fill("Penicillin, Latex");
  await page.getByRole("textbox", { name: /Implants or devices/ }).fill("Pacemaker");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/profile$/);
  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Latex allergy")).toBeVisible();
  await expect(strip.getByText("Pacemaker")).toBeVisible();

  await gotoScreen(page, "/profile", "My profile");
  await page.getByRole("link", { name: "Add to your care team" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add to care team" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("textbox", { name: "Name" }).fill("Dr Byrne");
  await page.getByRole("combobox", { name: "Type" }).selectOption("specialist");
  await page.getByRole("textbox", { name: /Role or specialty/ }).fill("Dentist");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/profile$/);
  await page.getByRole("link", { name: /Dr Byrne.*Dentist/ }).click();
  await page.getByRole("textbox", { name: /Practice, clinic or shop/ }).fill("Ranelagh Dental");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/profile$/);
  await expect(page.getByRole("link", { name: /Dr Byrne.*Ranelagh Dental/ })).toBeVisible();
  await page.getByRole("link", { name: /Dr Byrne/ }).click();
  await page.getByRole("button", { name: "Remove from care team" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove from care team" }).click();
  await page.waitForURL(/\/profile$/);
  await expect(page.getByRole("link", { name: /Dr Byrne/ })).toHaveCount(0);
});

test("a brand-new record shows empty states", async ({ page }) => {
  await emptyRecord(clientFor(file));
  await gotoScreen(page, "/home", /^Good/);
  await expect(page.getByRole("heading", { name: "Your record is empty" })).toBeVisible();
  await expect(page.getByText("until refill")).toHaveCount(0);
  await expectNoAxeViolations(page);

  await gotoScreen(page, "/record", "Record");
  await expect(page.getByText("No allergies or blood type recorded")).toBeVisible();
  await expect(page.getByText("No ongoing conditions.")).toBeVisible();
  await expect(page.getByText(/Nothing on your timeline yet/)).toBeVisible();
  await expectNoAxeViolations(page);

  await gotoScreen(page, "/meds", "My medication");
  await expect(page.getByText("No current medications.")).toBeVisible();
  await expectNoAxeViolations(page);

  await gotoScreen(page, "/profile", "My profile");
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
  await page.waitForURL(/\/profile$/);

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
    await page.waitForURL(/\/record$/);
  }

  // Medications: three current, two expired.
  const meds = [
    { Name: "Warfarin", Dose: "5mg", Form: "Tablet", "How often": "once daily", When: "evening", "Drug class": "Anticoagulant", "What it's for": "Atrial fibrillation", "Prescribed by": "Dr O'Mahony", "Their specialty": "Cardiology", "Clinic or hospital": "Mater Private", Started: "2019-01-01", "Next refill due": dublinDay(8), Instructions: "Take at the same time each evening. Needs regular INR blood tests." },
    { Name: "Levothyroxine", Dose: "50mcg", Form: "Tablet", "How often": "once daily", When: "morning", "Drug class": "Thyroid", "What it's for": "Hypothyroidism", "Prescribed by": "Dr Walsh", "Their specialty": "Endocrinology", Started: "2022-01-01", Instructions: "Take on an empty stomach, 30 minutes before breakfast." },
    { Name: "Salbutamol", Dose: "100mcg", Form: "Inhaler", "How often": "as needed", "Drug class": "Bronchodilator", "What it's for": "Asthma", "Prescribed by": "Dr Hennessy", "Their specialty": "GP", "Clinic or hospital": "Rathmines Medical Centre", Started: "2015-01-01", Instructions: "One to two puffs when wheezing or breathless." },
    { Name: "Clarithromycin", Dose: "500mg", Form: "Tablet", "How often": "twice daily", "Drug class": "Antibiotic", Started: dublinDay(-130), "Ends or ended": dublinDay(-123) },
    { Name: "Prednisolone", Dose: "5mg", Form: "Tablet", "How often": "once daily", When: "morning", "Drug class": "Steroid", Started: dublinDay(-200), "Ends or ended": dublinDay(-186) },
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
    await gotoScreen(page, "/add/appointment", "Log appointment");
    await page.getByRole("combobox", { name: "What kind" }).selectOption(e.kind);
    await page.getByRole("textbox", { name: "Title" }).fill(e.title);
    await page.getByLabel("Date").filter({ visible: true }).fill(dublinDay(e.day));
    await page.getByLabel("Time").filter({ visible: true }).fill(e.time);
    if (e.doctor) await page.getByRole("textbox", { name: /Doctor or clinician/ }).fill(e.doctor);
    await page.getByRole("textbox", { name: /^Where/ }).fill(e.where);
    await page.getByRole("button", { name: "Save to my record" }).click();
    await page.waitForURL(/\/record$/);
  }
  await gotoScreen(page, "/add/note", "Write a note");
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
    await page.waitForURL(/\/profile$/);
  }

  // Every screen shows it.
  await gotoScreen(page, "/home", /^Good .*, Jane$/);
  await expect(page.getByText("3 medications")).toBeVisible();
  await expect(page.getByText("8 days until refill")).toBeVisible();
  await expect(page.getByRole("link", { name: /Refill due soon.*Warfarin 5mg · 8 days left/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Upcoming.*(GP visit · Dr Hennessy|INR blood test)/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-home.png"), fullPage: true });

  await gotoScreen(page, "/record", "Record");
  const strip = page.getByRole("region", { name: "Critical safety information" });
  await expect(strip.getByText("Penicillin allergy")).toBeVisible();
  await expect(strip.getByText("A+ Blood Type")).toBeVisible();
  await expect(page.getByRole("link", { name: /Atrial fibrillation.*Dr O'Mahony · Cardiology · Dx 2019/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mild asthma.*Dr Hennessy · GP · since childhood/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Blood test, full blood count and INR.*Mater Hospital · Ordered by Dr Hennessy/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Personal note added.*Fatigue symptoms/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-record.png"), fullPage: true });

  await gotoScreen(page, "/meds", "My medication");
  await expect(page.getByText("3 active prescriptions · 2 expired in the last 12 months")).toBeVisible();
  await expect(page.getByText("Dr O'Mahony, Mater Private · Cardiology").filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-meds.png"), fullPage: true });

  await gotoScreen(page, "/profile", "My profile");
  await expect(page.getByText("Patient · Dublin, IE")).toBeVisible();
  await expect(page.getByText("+353 86 123 4567")).toBeVisible();
  await expect(page.getByRole("link", { name: /Dr Walsh.*Endocrinology.*Specialist/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Boots, Rathmines.*Pharmacy.*Boots/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("by-hand-profile.png"), fullPage: true });
});

test("delete my account signs out and removes the user", async ({ page }) => {
  await gotoScreen(page, "/profile", "My profile");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete your account?" });
  await expectNoAxeViolations(page, "dialog");
  await sheet.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  const { data } = await clientFor(file).from("profiles").select("id");
  expect(data ?? []).toHaveLength(0);
});
