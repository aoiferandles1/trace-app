import { expect, test, type Page } from "@playwright/test";
import { newDoctor } from "../helpers/doctor";
import { fakeRecord, mockPortal, statusOf } from "../helpers/portal-mocks";

/**
 * Two sessions in one page, without a reload (checklist C1). Next keeps
 * /view/session's layout alive, hidden, with its React state, while the
 * doctor goes back to /view for the next code; the frame must start afresh,
 * so nothing of the first session (its notes, its patient, its scope) shows
 * in the second or is saved into it. Stand-in /api/portal responses with
 * made-up patients ("Alice Example", then "Bob Other").
 */

const ENTRY = "Enter the patient's code";
const A_NOTE = "Leaked complaint from session A";
const A_TYPED = "Typed during session A";

function recordFor(first: string, last: string) {
  return (section: string) => {
    const r = fakeRecord(section);
    return { ...r, patient: { ...r.patient, first_name: first, last_name: last } };
  };
}

async function textareaValues(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll("textarea")).map((t) => t.value));
}

test("a second session in the same page starts with nothing from the first", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const sessionA = statusOf("active", {
    approved_at: minutesAgo(10),
    notes: { chief_complaint: A_NOTE, assessment: null, plan: null, follow_up: null, updated_at: null },
  });
  let phase: "A" | "A-ended" | "none" | "requested" | "B" = "A";
  const sessionBApproved = minutesAgo(0.1);
  const status = () => {
    switch (phase) {
      case "A":
        return { ...sessionA, server_time: new Date().toISOString() };
      case "A-ended":
        return statusOf("ended", { approved_at: sessionA.approved_at, ended_by: "patient", notes_saved_to_record: true });
      case "none":
        return statusOf("none");
      case "requested":
        return statusOf("requested");
      case "B":
        return statusOf("active", { approved_at: sessionBApproved });
    }
  };
  const set = await mockPortal(page, {
    status,
    record: (section) => (phase === "B" ? recordFor("Bob", "Other")(section) : recordFor("Alice", "Example")(section)),
    code: () => {
      phase = "requested";
      return { result: "requested", request_expires_at: new Date(Date.now() + 4 * 60_000).toISOString(), attempts_left: null, locked_until: null };
    },
  });
  void set;

  // Every notes save, with the phase it was sent in.
  const saves: Array<{ phase: string; body: string }> = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/portal/notes") && r.method() === "POST") saves.push({ phase, body: r.postData() ?? "" });
  });

  // Session A: the draft from the database, plus something typed.
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Alice Example" })).toBeVisible();
  await expect(page.getByLabel("Chief complaint").filter({ visible: true })).toHaveValue(A_NOTE);
  await page.getByLabel("Assessment").filter({ visible: true }).fill(A_TYPED);
  await expect.poll(() => saves.length, { timeout: 6_000 }).toBeGreaterThan(0);

  // The patient ends A; the doctor goes on to the next code in the same page.
  phase = "A-ended";
  await expect(page.getByRole("heading", { name: "Your patient ended the session." })).toBeVisible({ timeout: 8_000 });
  phase = "none";
  await page.getByRole("link", { name: "Enter a new code" }).click();
  await expect(page.getByRole("heading", { name: ENTRY })).toBeVisible();
  await page.getByRole("textbox", { name: "Patient's share code" }).fill("1234");
  const cont = page.getByRole("button", { name: "Continue" });
  if (await cont.isVisible()) await cont.click({ timeout: 2_000 }).catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Waiting for the patient to approve" })).toBeVisible();

  // The patient approves B.
  const before = saves.length;
  phase = "B";
  await expect(page.getByRole("heading", { level: 1, name: "Bob Other" })).toBeVisible({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/view\/session$/);

  // Nothing of A, visible or hidden: no notes, no patient.
  await expect(page.getByLabel("Chief complaint").filter({ visible: true })).toHaveValue("");
  await expect(page.getByLabel("Assessment").filter({ visible: true })).toHaveValue("");
  const values = await textareaValues(page);
  expect(values.join("|")).not.toContain(A_NOTE);
  expect(values.join("|")).not.toContain(A_TYPED);
  const html = await page.content();
  expect(html).not.toContain("Alice");
  expect(html).not.toContain(A_NOTE);
  expect(html).not.toContain(A_TYPED);

  // Typing in B saves B's words only.
  await page.getByLabel("Chief complaint").filter({ visible: true }).fill("Session B complaint");
  await expect.poll(() => saves.slice(before).length, { timeout: 6_000 }).toBeGreaterThan(0);
  for (const s of saves.slice(before)) {
    expect(s.body).not.toContain(A_NOTE);
    expect(s.body).not.toContain(A_TYPED);
  }
  await context.close();
});

test("a different session turning up in a poll starts the frame afresh", async ({ browser, viewport }) => {
  const { context, page } = await newDoctor(browser, { viewport: viewport ?? undefined });
  const a = new Date(Date.now() - 10 * 60_000).toISOString();
  const b = new Date(Date.now() - 6_000).toISOString();
  let which: "A" | "B" = "A";
  await mockPortal(page, {
    status: () =>
      which === "A"
        ? statusOf("active", {
            approved_at: a,
            notes: { chief_complaint: A_NOTE, assessment: null, plan: null, follow_up: null, updated_at: null },
          })
        : statusOf("active", { approved_at: b }),
    record: (section) => (which === "B" ? recordFor("Bob", "Other")(section) : recordFor("Alice", "Example")(section)),
  });
  await page.goto("/view/session");
  await expect(page.getByRole("heading", { level: 1, name: "Alice Example" })).toBeVisible();
  await expect(page.getByLabel("Chief complaint").filter({ visible: true })).toHaveValue(A_NOTE);
  which = "B";
  await expect(page.getByRole("heading", { level: 1, name: "Bob Other" })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByLabel("Chief complaint").filter({ visible: true })).toHaveValue("");
  expect((await textareaValues(page)).join("|")).not.toContain(A_NOTE);
  await context.close();
});
