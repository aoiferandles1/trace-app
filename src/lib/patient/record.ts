import type { IconName } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

/**
 * The redesigned record, as `my_record(section)` returns it
 * (supabase/README.md section 10). The phone reads exactly the shapes the
 * doctor's portal gets from `portal_get_record` version 2, so the two show
 * the same data the same way. Every list arrives ordered and joined; the
 * screens never join tables themselves.
 *
 * Dates are "YYYY-MM-DD", timestamps ISO strings in UTC.
 */

export type DatePrecision = "day" | "month" | "year";

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

export type ResultDetail = { kind: "result"; results: ResultValue[] };

export type RecordEntryKind =
  | "visit"
  | "result"
  | "prescription"
  | "note"
  | "letter"
  | "imaging"
  | "vaccination"
  | "session_notes";

/** A visit, result, prescription, letter, imaging, vaccination, session notes or personal note. */
export type RecordEntry = {
  id: string;
  kind: RecordEntryKind;
  title: string;
  occurs_at: string;
  upcoming: boolean;
  clinician: string | null;
  place: string | null;
  body: string | null;
  is_mental_health: boolean;
  source: "patient" | "clinician_session";
  detail: TextDetail | ResultDetail | null;
};

export type MedicationPeriod = {
  id: string;
  strength: number;
  strength_label: string;
  start_date: string;
  end_date: string | null;
  date_precision: DatePrecision;
  prescribed_by: string | null;
  note: string | null;
  /** Owner only. */
  note_shared?: boolean;
};

export type RecordMedication = {
  id: string;
  name: string;
  status: "current" | "past";
  unit: string | null;
  strength: number | null;
  strength_label: string | null;
  schedule: "Morning" | "Evening" | "As needed" | null;
  form: string | null;
  frequency: string | null;
  timing: string | null;
  drug_class: string | null;
  indication: string | null;
  instructions: string | null;
  prescriber: string | null;
  prescriber_specialty: string | null;
  prescriber_org: string | null;
  started_on: string | null;
  ended_on: string | null;
  refill_due_on: string | null;
  supply_days_left: number | null;
  period_count: number;
  /** Newest first; the current strength has `end_date: null`. */
  periods: MedicationPeriod[];
};

export type RecordCondition = {
  id: string;
  name: string;
  status: "managed" | "ongoing" | "resolved";
  clinician: string | null;
  specialty: string | null;
  diagnosed_year: number | null;
  diagnosed_note: string | null;
  is_mental_health: boolean;
};

export type EventPrescription = {
  id: string;
  name: string;
  detail: string | null;
  medication_id: string | null;
  medication_period_id: string | null;
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
  prescriptions: EventPrescription[];
};

export type RelativeCondition = {
  id: string;
  name: string;
  age_at_diagnosis: number | null;
  category: "heart" | "diabetes" | "asthma" | "cancer" | "stroke" | "other" | null;
  is_mental_health: boolean;
  /** "Heart attack at 61" */
  label: string;
};

export type Relative = {
  id: string;
  relation: string;
  /** "Mum", "Dad's dad" */
  label: string;
  /** -2 grandparents, -1 parents, aunts and uncles, 0 siblings, 1 children, null for other. */
  generation: number | null;
  side: "maternal" | "paternal" | null;
  conditions: RelativeCondition[];
};

export type CareTeamMember = {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  kind: "gp" | "specialist" | "pharmacy";
};

export type RecordDocument = {
  id: string;
  title: string;
  content_type: "application/pdf" | "image/jpeg" | "image/png";
  byte_size: number;
  document_date: string | null;
  created_at: string;
  is_mental_health: boolean;
};

export type InsuranceConnection = {
  id: string;
  provider: string;
  /** "•••• 4821" */
  member_number_masked: string;
  plan_name: string | null;
  renews_on: string | null;
  via: "provider" | "manual";
  include_in_shares: boolean;
  connected_at: string;
};

export type Vitals = {
  recorded_on: string;
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  weight_kg: number | null;
  spo2: number | null;
};

export type SectionData = {
  overview: {
    conditions: RecordCondition[] | null;
    recent_visits: { past: RecordEntry[]; upcoming: RecordEntry[] } | null;
    medications: RecordMedication[];
    vitals: Vitals | null;
  };
  conditions: { conditions: RecordCondition[] };
  recent_visits: { past: RecordEntry[]; upcoming: RecordEntry[] };
  medications: { current: RecordMedication[]; past: RecordMedication[] };
  full_timeline: { events: HealthEvent[]; visits: RecordEntry[] };
  care_team: { care_team: CareTeamMember[] };
  family_history: { relatives: Relative[] };
  insurance: { connections: InsuranceConnection[] };
  documents: { documents: RecordDocument[] };
  mental_health: {
    conditions: RecordCondition[];
    visits: RecordEntry[];
    events: HealthEvent[];
    documents: RecordDocument[];
  };
};

export type RecordSection = keyof SectionData;

export type RecordEnvelope<S extends RecordSection> = {
  version: 2;
  section: S;
  shared: boolean;
  patient: {
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    age: number | null;
    sex: string | null;
    city: string | null;
  };
  critical: { blood_type: string | null; allergies: string[]; implants: string[] };
  /** null from my_record (the owner sees everything). */
  scope: null;
  data: SectionData[S];
};

/** Reads one section of the signed-in patient's own record. Throws on error (for useLoad). */
export async function loadSection<S extends RecordSection>(section: S): Promise<RecordEnvelope<S>> {
  const { data, error } = await createClient().rpc("my_record", { section });
  if (error) throw error;
  return data as unknown as RecordEnvelope<S>;
}

/** Reads several sections at once: `loadSections("overview", "recent_visits")`. */
export async function loadSections<S extends RecordSection[]>(
  ...sections: S
): Promise<{ [K in S[number]]: SectionData[K] }> {
  const all = await Promise.all(sections.map((s) => loadSection(s)));
  const out = {} as { [K in S[number]]: SectionData[K] };
  sections.forEach((s, i) => {
    (out as Record<string, unknown>)[s] = all[i].data;
  });
  return out;
}

/** Words for an entry's kind, as the boards caption them ("Visit", "Result"). */
export const ENTRY_KIND_LABEL: Record<RecordEntryKind, string> = {
  visit: "Visit",
  result: "Result",
  prescription: "Prescription",
  note: "Note",
  letter: "Letter",
  imaging: "Scan",
  vaccination: "Vaccination",
  session_notes: "Session notes",
};

/** "Managed", "Ongoing" (outcomes and statuses arrive lower case). */
export function capitalise(word: string | null | undefined): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "Dr O'Mahony, since 2019" / "Dr Hennessy, since childhood" (RecordA2's Conditions tab). */
export function conditionCaption(c: RecordCondition): string {
  const since = c.diagnosed_year ? `since ${c.diagnosed_year}` : c.diagnosed_note;
  return [c.clinician, since].filter(Boolean).join(", ");
}

/** The bare icon for an entry (MainA2, RecordA2). */
export function entryIcon(e: Pick<RecordEntry, "kind" | "title">): IconName {
  if (e.kind === "result") return "drop";
  if (e.kind === "note" || e.kind === "session_notes") return "pencil";
  if (e.kind === "prescription") return "pill";
  if (e.kind === "letter" || e.kind === "imaging") return "document";
  if (e.kind === "vaccination") return "shield";
  return "calendar";
}

