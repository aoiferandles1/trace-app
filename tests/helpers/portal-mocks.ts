import type { Page, Route } from "@playwright/test";

/**
 * Stand-in /api/portal/* responses for states that take real time to reach
 * (a code expiring after 5 minutes, a request timing out, a 30 minute
 * session running out). The real database behaviour is covered by the SQL
 * tests in supabase/tests/ (05_time_transitions.sql, 08_redesign_scopes.sql);
 * these only check what the portal shows. Shapes follow supabase/README.md
 * sections 5 and 10 (portal_get_record version 2). The patient is made up
 * ("Test Patient", Cork, Latex allergy), never the seed.
 */

const NULL_STATUS = {
  status: "none",
  server_time: new Date().toISOString(),
  clinician: null,
  request_expires_at: null,
  duration_kind: null,
  approved_at: null,
  expires_at: null,
  paused_at: null,
  closes_at: null,
  ended_at: null,
  ended_by: null,
  allow_notes: null,
  scope: null,
  notes: null,
  notes_saved_to_record: null,
  locked_until: null,
};

const CLINICIAN = { name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" };

export const SCOPE = {
  critical_safety: true,
  medications: true,
  conditions: true,
  recent_visits: true,
  full_timeline: true,
  care_team: true,
  mental_health: false,
  documents: false,
  insurance: false,
  family_history: true,
  medication_notes: false,
};

export function statusOf(status: string, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const base = { ...NULL_STATUS, server_time: new Date(now).toISOString(), status };
  switch (status) {
    case "requested":
      return { ...base, clinician: CLINICIAN, request_expires_at: new Date(now + 4 * 60_000).toISOString(), ...extra };
    case "active":
      return {
        ...base,
        clinician: CLINICIAN,
        duration_kind: "30m",
        approved_at: new Date(now - 5 * 60_000).toISOString(),
        expires_at: new Date(now + 25 * 60_000).toISOString(),
        allow_notes: true,
        scope: SCOPE,
        notes: { chief_complaint: null, assessment: null, plan: null, follow_up: null, updated_at: null },
        ...extra,
      };
    case "paused":
      return {
        ...base,
        clinician: CLINICIAN,
        duration_kind: "30m",
        approved_at: new Date(now - 31 * 60_000).toISOString(),
        paused_at: new Date(now - 60_000).toISOString(),
        closes_at: new Date(now + 29 * 60_000).toISOString(),
        allow_notes: true,
        ...extra,
      };
    case "ended":
      return {
        ...base,
        clinician: CLINICIAN,
        duration_kind: "30m",
        approved_at: new Date(now - 40 * 60_000).toISOString(),
        ended_at: new Date(now).toISOString(),
        ended_by: "patient",
        notes_saved_to_record: false,
        ...extra,
      };
    default:
      return { ...base, clinician: status === "none" ? null : CLINICIAN, ...extra };
  }
}

const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();

const ENTRIES = [
  {
    id: "e-past-1",
    kind: "visit",
    title: "Practice visit",
    occurs_at: day(-3),
    upcoming: false,
    clinician: "Dr Test",
    place: "Cork Clinic",
    body: null,
    is_mental_health: false,
    source: "patient",
    detail: { kind: "text", reason: "Cough", assessment: "Viral", plan: "Fluids", follow_up: null, medication: null, quantity: null, pharmacy: null },
  },
  {
    id: "e-past-2",
    kind: "result",
    title: "Iron test",
    occurs_at: day(-10),
    upcoming: false,
    clinician: "Dr Test",
    place: "Cork Lab",
    body: null,
    is_mental_health: false,
    source: "patient",
    detail: { kind: "result", results: [{ id: "r1", name: "Ferritin", value: 12, unit: "µg/L", ref_low: 30, ref_high: 300, flag: "low" }] },
  },
];
const UPCOMING = [
  { ...ENTRIES[0], id: "e-up-1", title: "Follow-up visit", occurs_at: day(12), upcoming: true, detail: null },
];

const MEDS = [
  {
    id: "m-current",
    name: "Testamol",
    status: "current",
    unit: "mg",
    strength: 20,
    strength_label: "20mg",
    schedule: "Morning",
    form: null,
    frequency: null,
    timing: "morning",
    prescriber: "Dr Test",
    started_on: "2024-01-01",
    ended_on: null,
    refill_due_on: null,
    supply_days_left: null,
    period_count: 2,
    periods: [
      { id: "p2", strength: 20, strength_label: "20mg", start_date: "2025-01-01", end_date: null, date_precision: "month", prescribed_by: "Dr Test", note: null },
      { id: "p1", strength: 10, strength_label: "10mg", start_date: "2024-01-01", end_date: "2025-01-01", date_precision: "month", prescribed_by: "Dr Test", note: null },
    ],
  },
];

const DATA: Record<string, unknown> = {
  overview: {
    conditions: [{ id: "c1", name: "Test condition", status: "managed", clinician: "Dr Test", specialty: null, diagnosed_year: 2020, diagnosed_note: null, is_mental_health: false }],
    recent_visits: { past: ENTRIES, upcoming: UPCOMING },
    medications: MEDS,
    vitals: { recorded_on: "2026-09-01", systolic: 120, diastolic: 80, heart_rate: 70, weight_kg: 60, spo2: 99 },
  },
  conditions: { conditions: [] },
  recent_visits: { past: ENTRIES, upcoming: UPCOMING },
  medications: { current: MEDS, past: [] },
  full_timeline: {
    events: [
      {
        id: "ev1",
        kind: "infection",
        title: "Test infection",
        occurred_on: "2025-05-01",
        date_precision: "month",
        clinician: "Dr Test",
        place: "Cork Clinic",
        seen_by: "Dr Test, Cork Clinic",
        outcome: "resolved",
        notes: "Better in a week.",
        is_mental_health: false,
        prescriptions: [{ id: "rx1", name: "Nothing prescribed", detail: "Rest and fluids" }],
      },
    ],
    visits: ENTRIES,
  },
  care_team: { care_team: [] },
  family_history: { relatives: [] },
  documents: { documents: [] },
  mental_health: { conditions: [], visits: [], events: [], documents: [] },
};

const SECTION_SCOPE: Record<string, keyof typeof SCOPE | null> = {
  overview: null,
  medications: null,
  conditions: "conditions",
  recent_visits: "recent_visits",
  full_timeline: "full_timeline",
  care_team: "care_team",
  family_history: "family_history",
  documents: "documents",
  mental_health: "mental_health",
};

/** A made-up version 2 envelope for one section. */
export function fakeRecord(section = "overview", scope: Record<string, boolean> = SCOPE) {
  return {
    version: 2,
    section,
    shared: true,
    patient: { first_name: "Test", last_name: "Patient", date_of_birth: "1990-01-01", age: 36, sex: "Female", city: "Cork" },
    critical: { blood_type: "O+", allergies: ["Latex"], implants: [] },
    scope,
    data: DATA[section] ?? null,
  };
}

type Mock = {
  status: () => unknown;
  /** Return null for "access closed". Defaults to fakeRecord(section) when the status is active. */
  record?: ((section: string) => unknown) | null;
  code?: () => unknown;
};

/**
 * Routes every /api/portal call to the mock. A section the mocked scope
 * leaves out answers 403 not_shared, as the real route does, and every
 * section asked for is counted in `requested`. Returns a setter to change
 * the mock mid-test.
 */
export async function mockPortal(page: Page, mock: Mock) {
  let current = mock;
  const requested: string[] = [];
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/portal/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/portal/", "");
    if (path === "status" || path === "cancel" || path === "end") return json(route, current.status());
    if (path === "record") {
      const section = url.searchParams.get("section") ?? "overview";
      requested.push(section);
      const s = current.status() as { status: string; scope: Record<string, boolean> | null };
      if (current.record === null || s.status !== "active") return json(route, { record: null });
      const key = SECTION_SCOPE[section];
      if (key && s.scope && !s.scope[key]) return json(route, { error: "not_shared" }, 403);
      return json(route, { record: current.record ? current.record(section) : fakeRecord(section, s.scope ?? SCOPE) });
    }
    if (path === "code")
      return json(route, current.code ? current.code() : { result: "wrong", attempts_left: 4, locked_until: null, request_expires_at: null });
    if (path === "notes") return json(route, { saved_at: new Date().toISOString() });
    return route.continue();
  });
  const set = (next: Mock) => {
    current = next;
  };
  return Object.assign(set, { requested });
}
