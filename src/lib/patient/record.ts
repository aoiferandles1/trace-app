import type { IconName } from "@/components/ui/Icon";
import { formatTimelineDate } from "@/lib/dates";
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


const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A date column at its precision: "2 Aug 2026" (day), "Jan 2024" (month),
 * "2015" (year). `withYear: false` drops the year from a day or month
 * ("2 Aug", "Aug").
 */
export function formatAtPrecision(day: string, precision: DatePrecision, withYear = true): string {
  const [y, m, d] = day.split("-").map(Number);
  if (precision === "year") return String(y);
  if (precision === "month") return withYear ? `${MONTH_SHORT[m - 1]} ${y}` : MONTH_SHORT[m - 1];
  return withYear ? `${d} ${MONTH_SHORT[m - 1]} ${y}` : `${d} ${MONTH_SHORT[m - 1]}`;
}

/**
 * "2 Aug to 9 Aug 2026" (both in one year), "1 Apr 2024 to 30 Sep 2025",
 * "Jan 2024 to Mar 2024" (MedDetailA2 keeps both years on months),
 * "Feb 2025 to now".
 */
export function formatRange(start: string, end: string | null, precision: DatePrecision): string {
  if (!end) return `${formatAtPrecision(start, precision)} to now`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = precision === "day" && sameYear ? formatAtPrecision(start, "day", false) : formatAtPrecision(start, precision);
  return `${from} to ${formatAtPrecision(end, precision)}`;
}

/** "Now 36mg, since Feb 2025" (MedDetailA2); "Stopped 9 Aug 2026" for a past medication. */
export function medicationNowLine(m: RecordMedication): string | null {
  const latest = m.periods[0];
  if (m.status === "past") {
    const end = m.ended_on ?? latest?.end_date;
    return end ? `Stopped ${formatAtPrecision(end, latest?.date_precision === "month" ? "month" : "day")}` : null;
  }
  if (!latest) return m.strength_label ? `Now ${m.strength_label}` : null;
  return `Now ${latest.strength_label}, since ${formatAtPrecision(latest.start_date, latest.date_precision)}`;
}

/** Number of strength changes: one fewer than the periods (5 periods are 4 changes). */
export function strengthChanges(m: RecordMedication): number {
  return Math.max(0, m.period_count - 1);
}

/**
 * A refill counts as urgent at 5 days or fewer (owner's decision, 11 Nov
 * 2026; the boards tint Warfarin's at 8 days). Home's Coming up and the
 * Medications list both use it.
 */
export const URGENT_REFILL_DAYS = 5;

/**
 * The Medications list's sub line (MedsA2).
 * Current: the schedule, then the strength changes or the supply left
 * ("Morning, 4 strength changes", "Evening, 8 days left"). `urgent` is true
 * when the supply line is the urgent one.
 * Past: "2 Aug to 9 Aug 2026, Dr Hennessy".
 */
export function medicationCaption(m: RecordMedication): { text: string; urgent: boolean } {
  if (m.status === "past") {
    const start = m.started_on ?? m.periods[m.periods.length - 1]?.start_date ?? null;
    const end = m.ended_on;
    const when = start && end ? formatRange(start, end, "day") : end ? `Ended ${formatAtPrecision(end, "day")}` : null;
    return { text: [when, m.prescriber].filter(Boolean).join(", "), urgent: false };
  }
  const parts: string[] = [];
  const schedule = m.schedule ?? (m.frequency ? capitalise(m.frequency) : null);
  if (schedule) parts.push(schedule);
  const left = m.supply_days_left;
  if (left !== null && left <= URGENT_REFILL_DAYS) {
    parts.push(left < 0 ? "refill overdue" : left === 0 ? "refill due today" : `${left} ${left === 1 ? "day" : "days"} left`);
    return { text: parts.join(", "), urgent: true };
  }
  const changes = strengthChanges(m);
  if (changes > 0) parts.push(`${changes} strength ${changes === 1 ? "change" : "changes"}`);
  return { text: parts.join(", "), urgent: false };
}

/** "Infection", "Condition". */
export const EVENT_KIND_LABEL: Record<HealthEvent["kind"], string> = { infection: "Infection", condition: "Condition" };

/** "Aug, Infection" (TimelineA2's row sub line). */
export function eventCaption(e: HealthEvent): string {
  const when = e.date_precision === "year" ? null : formatAtPrecision(e.occurred_on, e.date_precision, false);
  return [when, EVENT_KIND_LABEL[e.kind]].filter(Boolean).join(", ");
}

/** "Aug 2026, Infection" (TimelineA2's sheet). */
export function eventMeta(e: HealthEvent): string {
  return `${formatAtPrecision(e.occurred_on, e.date_precision)}, ${EVENT_KIND_LABEL[e.kind]}`;
}

/** "PDF" for a PDF, "Photo" for a JPEG or PNG (README section 10, a document). */
export function documentTypeLabel(contentType: RecordDocument["content_type"]): string {
  return contentType === "application/pdf" ? "PDF" : "Photo";
}

/** "820 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** The most a document may be: 3 MB (the database refuses more). */
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

/** The three types the database stores. */
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Every relation the database takes, with the words the shapes give it. */
export const RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: "mother", label: "Mum" },
  { value: "father", label: "Dad" },
  { value: "sister", label: "Sister" },
  { value: "brother", label: "Brother" },
  { value: "daughter", label: "Daughter" },
  { value: "son", label: "Son" },
  { value: "maternal_grandmother", label: "Mum's mum" },
  { value: "maternal_grandfather", label: "Mum's dad" },
  { value: "paternal_grandmother", label: "Dad's mum" },
  { value: "paternal_grandfather", label: "Dad's dad" },
  { value: "maternal_aunt", label: "Mum's sister" },
  { value: "maternal_uncle", label: "Mum's brother" },
  { value: "paternal_aunt", label: "Dad's sister" },
  { value: "paternal_uncle", label: "Dad's brother" },
  { value: "other", label: "Someone else" },
];

/** A relative's condition groups, in the family tree filter's order (FamilyA2: Heart, Diabetes, Asthma). */
export const CONDITION_CATEGORIES: { value: NonNullable<RelativeCondition["category"]>; label: string }[] = [
  { value: "heart", label: "Heart" },
  { value: "diabetes", label: "Diabetes" },
  { value: "asthma", label: "Asthma" },
  { value: "cancer", label: "Cancer" },
  { value: "stroke", label: "Stroke" },
  { value: "other", label: "Other" },
];

/**
 * The group a condition of the patient's own falls in, for the family tree's
 * "You" node (patient conditions carry no category in the database).
 */
export function categoryOfConditionName(name: string): RelativeCondition["category"] {
  if (/heart|atrial|cardi|angina|arrhythm|hypertension|blood pressure/i.test(name)) return "heart";
  if (/diabet/i.test(name)) return "diabetes";
  if (/asthma/i.test(name)) return "asthma";
  if (/cancer|tumou?r|lymphoma|leuk|melanoma/i.test(name)) return "cancer";
  if (/stroke/i.test(name)) return "stroke";
  return null;
}

/** The database's error code for a failed call (`error.message`), or null. */
export function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return null;
}

/** The units a medication's strength can be in (supabase/README.md, `medications.unit`). */
export const UNITS = ["mg", "mcg", "g", "mL", "units", "IU"] as const;
export const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));

/** Reads "36mg", "2.5 mcg", "1000IU" as a strength and a unit, as the database does; null if it doesn't read. */
export function parseStrength(text: string): { strength: number; unit: (typeof UNITS)[number] } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|units?|iu)\s*$/i.exec(text);
  if (!m) return null;
  const raw = m[2].toLowerCase();
  const unit = raw === "ml" ? "mL" : raw === "iu" ? "IU" : raw.startsWith("unit") ? "units" : (raw as "mg" | "mcg" | "g");
  return { strength: Number(m[1].replace(",", ".")), unit };
}

/** "2 Nov 2026, PDF": the date on the document, else when it was added. */
export function documentCaption(d: RecordDocument): string {
  const when = d.document_date ? formatAtPrecision(d.document_date, "day") : formatTimelineDate(d.created_at);
  return `${when}, ${documentTypeLabel(d.content_type)}`;
}
