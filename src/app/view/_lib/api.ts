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
  /** Reported by the database; the portal never shows insurance. */
  insurance: boolean;
  family_history: boolean;
  medication_notes: boolean;
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

export type Critical = { blood_type: string | null; allergies: string[]; implants: string[] };

/* ---- The redesigned record (portal_get_record version 2, supabase/README.md section 10) ---- */

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

export type TextDetail = {
  kind: "text";
  reason: string | null;
  assessment: string | null;
  plan: string | null;
  follow_up: string | null;
  medication: string | null;
  quantity: string | null;
  pharmacy: string | null;
};

export type ResultValue = {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: "low" | "high" | null;
};

export type EntryKind = "visit" | "result" | "prescription" | "note" | "letter" | "imaging" | "vaccination" | "session_notes";

export type Entry = {
  id: string;
  kind: EntryKind;
  title: string;
  occurs_at: string;
  upcoming: boolean;
  clinician: string | null;
  place: string | null;
  body: string | null;
  is_mental_health: boolean;
  source: "patient" | "clinician_session";
  detail: TextDetail | { kind: "result"; results: ResultValue[] } | null;
};

export type DatePrecision = "day" | "month" | "year";

export type Period = {
  id: string;
  strength: number;
  strength_label: string;
  start_date: string;
  end_date: string | null;
  date_precision: DatePrecision;
  prescribed_by: string | null;
  /** Only when the patient shared Medication notes and this note. Otherwise null. */
  note: string | null;
};

export type Medication = {
  id: string;
  name: string;
  status: "current" | "past";
  unit: string | null;
  strength: number | null;
  strength_label: string | null;
  schedule: string | null;
  form: string | null;
  frequency: string | null;
  timing: string | null;
  prescriber: string | null;
  started_on: string | null;
  ended_on: string | null;
  refill_due_on: string | null;
  supply_days_left: number | null;
  period_count: number;
  /** Newest first. */
  periods: Period[];
};

export type HealthEvent = {
  id: string;
  kind: "infection" | "condition";
  title: string;
  occurred_on: string;
  date_precision: DatePrecision;
  clinician: string | null;
  place: string | null;
  seen_by: string | null;
  outcome: "resolved" | "settled" | "ongoing" | "seasonal" | "managed" | null;
  notes: string | null;
  is_mental_health: boolean;
  prescriptions: Array<{ id: string; name: string; detail: string | null }>;
};

export type Relative = {
  id: string;
  relation: string;
  label: string;
  generation: number | null;
  side: "maternal" | "paternal" | null;
  conditions: Array<{
    id: string;
    name: string;
    age_at_diagnosis: number | null;
    category: string | null;
    is_mental_health: boolean;
    label: string;
  }>;
};

export type DocumentItem = {
  id: string;
  title: string;
  content_type: string;
  byte_size: number;
  document_date: string | null;
  created_at: string;
  is_mental_health: boolean;
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

export type RecentVisits = { past: Entry[]; upcoming: Entry[] };

export type SectionData = {
  overview: {
    conditions: Condition[] | null;
    recent_visits: RecentVisits | null;
    medications: Medication[];
    vitals: Vitals | null;
  };
  conditions: { conditions: Condition[] };
  recent_visits: RecentVisits;
  medications: { current: Medication[]; past: Medication[] };
  full_timeline: { events: HealthEvent[]; visits: Entry[] };
  care_team: { care_team: CareTeamMember[] };
  family_history: { relatives: Relative[] };
  documents: { documents: DocumentItem[] };
  mental_health: { conditions: Condition[]; visits: Entry[]; events: HealthEvent[]; documents: DocumentItem[] };
};

export type RecordSection = keyof SectionData;

export type PortalRecord<S extends RecordSection = RecordSection> = {
  version: 2;
  section: S;
  shared: true;
  patient: Patient;
  critical: Critical;
  scope: Scope;
  data: SectionData[S];
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
  /**
   * One section. `null` when access is closed (ask for the status). Throws
   * `not_shared` for a section the patient did not grant: the portal never
   * asks for one, so that is a bug.
   */
  record: <S extends RecordSection>(section: S) =>
    call<{ record: PortalRecord<S> | null }>(`/api/portal/record?section=${section}`).then((r) => r.record),
  saveNotes: (notes: { chief_complaint: string; assessment: string; plan: string; follow_up: string }) =>
    call<{ saved_at: string }>("/api/portal/notes", { method: "POST", body: JSON.stringify(notes) }),
  end: () => call<PortalStatus>("/api/portal/end", { method: "POST", body: "{}" }),
};

let firstLook: Promise<PortalStatus> | null = null;

/**
 * A screen's first status call. Calls made while one is on its way share
 * it: React can mount a screen twice in a row (development, and the session
 * frame starting afresh), and in a browser with no portal cookie yet a
 * second call would mint a second token, so whichever answer landed last
 * would replace the cookie. Polls use portalApi.status().
 */
export function firstStatus(): Promise<PortalStatus> {
  firstLook ??= portalApi.status().finally(() => {
    firstLook = null;
  });
  return firstLook;
}

/** Where a shared document opens (a new tab; the route serves the file itself). */
export function documentUrl(id: string): string {
  return `/api/portal/document?id=${encodeURIComponent(id)}`;
}

/** Milliseconds to add to Date.now() to get the database's clock. */
export function clockOffset(serverTime: string | null | undefined): number {
  if (!serverTime) return 0;
  const t = Date.parse(serverTime);
  return Number.isFinite(t) ? t - Date.now() : 0;
}
