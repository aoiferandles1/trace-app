import type { Page, Route } from "@playwright/test";

/**
 * Stand-in /api/portal/* responses for states that take real time to reach
 * (a code expiring after 5 minutes, a request timing out, a 30 minute
 * session running out). The real database behaviour is covered by the SQL
 * tests in supabase/tests/ (05_time_transitions.sql); these only check what
 * the portal shows. Shapes follow supabase/README.md section 5.
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
const SCOPE = {
  critical_safety: true,
  medications: true,
  conditions: true,
  recent_visits: true,
  full_timeline: false,
  care_team: true,
  mental_health: false,
  documents: false,
  insurance: false,
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

/** A made-up record (not the seed): enough for the overview to render. */
export function fakeRecord(section = "overview") {
  return {
    section,
    patient: { first_name: "Test", last_name: "Patient", date_of_birth: "1990-01-01", age: 36, sex: "Female", city: "Cork" },
    critical: { blood_type: "O+", allergies: ["Latex"], implants: [] },
    scope: SCOPE,
    conditions: [],
    medications: { current: [], expired: [] },
    timeline: [],
    upcoming: [],
    vitals: null,
    care_team: null,
  };
}

type Mock = { status: () => unknown; record?: () => unknown; code?: () => unknown };

/** Routes every /api/portal call to the mock. Returns a setter to change the status mid-test. */
export async function mockPortal(page: Page, mock: Mock) {
  let current = mock;
  const json = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/portal/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/portal/", "");
    if (path === "status" || path === "cancel" || path === "end") return json(route, current.status());
    if (path === "record") return json(route, { record: current.record ? current.record() : null });
    if (path === "code") return json(route, current.code ? current.code() : { result: "wrong", attempts_left: 4, locked_until: null, request_expires_at: null });
    if (path === "notes") return json(route, { saved_at: new Date().toISOString() });
    return route.continue();
  });
  return (next: Mock) => {
    current = next;
  };
}
