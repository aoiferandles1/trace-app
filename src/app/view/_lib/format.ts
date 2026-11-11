import type { Medication, Patient, Scope } from "./api";

/**
 * Display helpers for the portal. Dates are shown in Irish time, the
 * database's "today" (supabase/README.md, "Time").
 */

const TZ = "Europe/Dublin";

export function patientFullName(p: Patient | null | undefined): string {
  if (!p) return "Your patient";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || "Your patient";
}

export function patientFirstName(p: Patient | null | undefined): string {
  return p?.first_name?.trim() || "the patient";
}

/** "12 Mar 1991" from "1991-03-12" (a date, no time zone shift). */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "34 · Female · DOB 12 Mar 1991" (sidebar), optionally with the city. */
export function patientDetails(p: Patient | null | undefined, opts: { city?: boolean } = {}): string {
  if (!p) return "";
  return [
    p.age != null ? String(p.age) : null,
    p.sex,
    p.date_of_birth ? `DOB ${formatDateOnly(p.date_of_birth)}` : null,
    opts.city ? p.city : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function parts(iso: string) {
  const f = new Intl.DateTimeFormat("en-IE", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { day: get("day"), month: get("month").replace(".", ""), year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** "5 JAN 2026" */
export function formatEntryDate(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${p.month} ${p.year}`.toUpperCase();
}

/** { day: "5", month: "JAN", year: "2026" } */
export function entryDateParts(iso: string) {
  const p = parts(iso);
  return { day: p.day, month: p.month.toUpperCase(), year: p.year };
}

/** "2026-01-05" in Irish time, for <time dateTime>. */
export function isoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** "9:35" (24-hour, Irish time). */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parts(iso);
  return `${p.hour}:${p.minute}`;
}

/** "Dec 2025" from a date. */
export function formatMonthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IE", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, (m || 1) - 1, 1)),
  );
}

/** "Warfarin 5mg" */
export function medicationName(m: Medication): string {
  return [m.name, m.dose].filter(Boolean).join(" ");
}

/** "Once daily · evening · since 2019" (overview row). */
export function medicationMeta(m: Medication): string {
  const freq = m.frequency ? m.frequency[0].toUpperCase() + m.frequency.slice(1) : null;
  return [freq, m.timing, m.started_on ? `since ${m.started_on.slice(0, 4)}` : null].filter(Boolean).join(" · ");
}

/** "Tablet · once daily · evening" (medication card). */
export function medicationSummary(m: Medication): string {
  return [m.form, m.frequency, m.timing].filter(Boolean).join(" · ");
}

/** "Dr O'Mahony, Mater Private · Cardiology" */
export function prescriberLine(m: Medication): string {
  const who = [m.prescriber, m.prescriber_org].filter(Boolean).join(", ");
  return [who, m.prescriber_specialty].filter(Boolean).join(" · ");
}

/** The "Shared for this visit / Not included" lists, in c-overview's order and words. */
export function scopeLists(scope: Scope): { shared: string[]; notShared: string[] } {
  const rows: Array<[string, boolean]> = [
    ["Critical safety", scope.critical_safety],
    ["Active conditions", scope.conditions],
    ["Medications", scope.medications],
    ["Recent visits (last 3)", scope.recent_visits && !scope.full_timeline],
    ["Full timeline", scope.full_timeline],
    ["Care team", scope.care_team],
    ["Mental health", scope.mental_health],
    ["Documents", scope.documents],
    ["Insurance", scope.insurance],
  ];
  const shared = rows.filter(([, on]) => on).map(([l]) => l);
  // Figma lists "Not included" as Mental health, Documents, Full timeline, Insurance.
  const notOrder = ["Active conditions", "Recent visits (last 3)", "Care team", "Mental health", "Documents", "Full timeline", "Insurance"];
  const notShared = notOrder.filter((l) => {
    if (l === "Recent visits (last 3)") return !scope.recent_visits && !scope.full_timeline;
    const row = rows.find(([label]) => label === l);
    return row ? !row[1] : false;
  });
  return { shared, notShared };
}

/** Critical strip items: "Penicillin allergy", "A+", implants. */
export function criticalItems(c: { blood_type: string | null; allergies: string[]; implants: string[] }): string[] {
  return [
    ...c.allergies.map((a) => (/allerg/i.test(a) ? a : `${a} allergy`)),
    ...(c.blood_type ? [c.blood_type] : []),
    ...c.implants.map((i) => `Implant: ${i}`),
  ];
}

/** "28m", "1h 05m" */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function durationLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "30m":
      return "30 min session";
    case "1h":
      return "1 hour session";
    case "all_day":
      return "All-day session";
    case "manual":
      return "Open session";
    default:
      return "";
  }
}
