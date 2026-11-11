/**
 * The portal browser's only way to the data: our own /api/portal/* routes.
 * It never talks to Supabase. Shapes follow supabase/README.md section 5.
 */

export type PortalStatusName =
  | "none"
  | "requested"
  | "active"
  | "paused"
  | "ended"
  | "denied"
  | "expired"
  | "cancelled";

export type Scope = {
  critical_safety: boolean;
  medications: boolean;
  conditions: boolean;
  recent_visits: boolean;
  full_timeline: boolean;
  care_team: boolean;
  mental_health: boolean;
  documents: boolean;
  insurance: boolean;
};

export type DraftNotes = {
  chief_complaint: string | null;
  assessment: string | null;
  plan: string | null;
  follow_up: string | null;
  updated_at: string | null;
};

export type PortalStatus = {
  status: PortalStatusName;
  server_time: string;
  clinician: { name: string | null; role: string | null; practice: string | null } | null;
  request_expires_at: string | null;
  duration_kind: "30m" | "1h" | "all_day" | "manual" | null;
  approved_at: string | null;
  expires_at: string | null;
  paused_at: string | null;
  closes_at: string | null;
  ended_at: string | null;
  ended_by: "patient" | "clinician" | "timeout" | null;
  allow_notes: boolean | null;
  scope: Scope | null;
  notes: DraftNotes | null;
  notes_saved_to_record: boolean | null;
  locked_until: string | null;
};

export type SubmitResult = {
  result: "requested" | "wrong" | "expired" | "locked";
  request_expires_at: string | null;
  attempts_left: number | null;
  locked_until: string | null;
};

export type Patient = {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  age: number | null;
  sex: string | null;
  city: string | null;
};

export type Condition = {
  id: string;
  name: string;
  status: "managed" | "ongoing" | "resolved";
  clinician: string | null;
  specialty: string | null;
  diagnosed_year: number | null;
  diagnosed_note: string | null;
  is_mental_health: boolean;
};

export type Medication = {
  id: string;
  name: string;
  dose: string | null;
  form: string | null;
  frequency: string | null;
  timing: string | null;
  drug_class: string | null;
  prescriber: string | null;
  prescriber_specialty: string | null;
  prescriber_org: string | null;
  indication: string | null;
  started_on: string | null;
  ended_on: string | null;
  instructions: string | null;
  refill_due_on: string | null;
};

export type Entry = {
  id: string;
  kind: "visit" | "result" | "prescription" | "note" | "letter" | "imaging" | "vaccination" | "session_notes";
  title: string;
  occurs_at: string;
  clinician: string | null;
  place: string | null;
  body: string | null;
  is_mental_health: boolean;
  source: "patient" | "clinician_session";
  detail: Record<string, string | null> | null;
};

export type Vitals = {
  recorded_on: string;
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  weight_kg: number | null;
  spo2: number | null;
};

export type CareTeamMember = {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  kind: "gp" | "specialist" | "pharmacy";
};

export type RecordSection = "overview" | "conditions" | "timeline" | "medications" | "care_team";

export type PortalRecord = {
  section: RecordSection;
  patient: Patient;
  critical: { blood_type: string | null; allergies: string[]; implants: string[] };
  scope: Scope;
  conditions: Condition[] | null;
  medications: { current: Medication[]; expired: Medication[] } | null;
  timeline: Entry[] | null;
  upcoming: Entry[] | null;
  vitals: Vitals | null;
  care_team: CareTeamMember[] | null;
};

export class PortalApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through
  }
  if (!res.ok) {
    const code =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "network_error";
    throw new PortalApiError(code, res.status);
  }
  return body as T;
}

export const portalApi = {
  status: () => call<PortalStatus>("/api/portal/status"),
  submitCode: (input: { code: string; clinician_name: string; clinician_role: string; clinician_practice: string }) =>
    call<SubmitResult>("/api/portal/code", { method: "POST", body: JSON.stringify(input) }),
  cancel: () => call<PortalStatus>("/api/portal/cancel", { method: "POST", body: "{}" }),
  record: (section: RecordSection) =>
    call<{ record: PortalRecord | null }>(`/api/portal/record?section=${section}`).then((r) => r.record),
  saveNotes: (notes: { chief_complaint: string; assessment: string; plan: string; follow_up: string }) =>
    call<{ saved_at: string }>("/api/portal/notes", { method: "POST", body: JSON.stringify(notes) }),
  end: () => call<PortalStatus>("/api/portal/end", { method: "POST", body: "{}" }),
};

/** Milliseconds to add to Date.now() to get the database's clock. */
export function clockOffset(serverTime: string | null | undefined): number {
  if (!serverTime) return 0;
  const t = Date.parse(serverTime);
  return Number.isFinite(t) ? t - Date.now() : 0;
}
