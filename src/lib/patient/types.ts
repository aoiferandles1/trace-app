import type { Tables } from "@/lib/supabase/database.types";
import type { EntryKind } from "@/components/patient/TimelineItem";

/** Row types the patient app reads (supabase/README.md section 2). */
export type Profile = Tables<"profiles">;
export type Condition = Tables<"conditions">;
export type Medication = Tables<"medications">;
export type Entry = Tables<"entries"> & { kind: EntryKind };
export type CareMember = Tables<"care_team">;

export type OnboardingStep = "about" | "medical" | "privacy" | "profiles" | "welcome" | "done";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export type ConditionStatus = "managed" | "ongoing" | "resolved";
export type CareKind = "gp" | "specialist" | "pharmacy";

/** Kinds a patient can add by hand. Not `session_notes` (the database refuses it). */
export const PATIENT_ENTRY_KINDS: { value: EntryKind; label: string }[] = [
  { value: "visit", label: "Visit or appointment" },
  { value: "result", label: "Test result" },
  { value: "prescription", label: "Prescription" },
  { value: "letter", label: "Letter" },
  { value: "imaging", label: "Scan or X-ray" },
];

/** "Jane Doe", or "" for an unfinished profile. */
export function fullName(p: Pick<Profile, "first_name" | "last_name"> | null | undefined): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ");
}

/** A medication is current when it has no end date or ends today or later (Irish time). */
export function isCurrentMedication(m: Pick<Medication, "ended_on">, today: string): boolean {
  return !m.ended_on || m.ended_on >= today;
}

/** "Warfarin 5mg". */
export function medicationName(m: Pick<Medication, "name" | "dose">): string {
  return [m.name, m.dose].filter(Boolean).join(" ");
}

/** "Tablet · once daily · evening". */
export function medicationSummary(m: Pick<Medication, "form" | "frequency" | "timing">): string {
  return [m.form, m.frequency, m.timing].filter(Boolean).join(" · ");
}

/**
 * "Penicillin allergy" for an allergy as typed. Words that already say
 * allergy are kept as they are ("Nut allergy"), and "None" or "No known
 * allergies" give null: nothing to warn about.
 */
export function allergyLabel(text: string): string | null {
  const t = text.trim();
  if (!t || /^(none|no|nil|n\/?a|nka|nkda|no known( drug)? allergies|not known)\.?$/i.test(t)) return null;
  return /allerg/i.test(t) ? t : `${t} allergy`;
}

/** Allergy labels for a profile, leaving out "None". */
export function allergyLabels(allergies: string[]): string[] {
  return allergies.map(allergyLabel).filter((a): a is string => a !== null);
}

/** The critical strip's pills: "Penicillin allergy", "A+ Blood Type", implants as typed. */
export function criticalItems(p: Pick<Profile, "allergies" | "blood_type" | "implants"> | null): string[] {
  if (!p) return [];
  return [
    ...allergyLabels(p.allergies),
    ...(p.blood_type ? [`${p.blood_type} Blood Type`] : []),
    ...p.implants,
  ];
}

/** "Dr O'Mahony · Cardiology · Dx 2019" or "... · since childhood". */
export function conditionMeta(c: Condition): string {
  const when = c.diagnosed_year ? `Dx ${c.diagnosed_year}` : c.diagnosed_note;
  return [c.clinician, c.specialty, when].filter(Boolean).join(" · ");
}

/** Splits "Penicillin, latex" into ["Penicillin", "latex"]. */
export function splitList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Trims a form value and turns "" into null. */
export function orNull(value: FormDataEntryValue | string | null | undefined): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

/** True for a UUID. Detail routes check it so a mistyped URL shows "not found", not an error. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
