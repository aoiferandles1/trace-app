import type { Condition, DatePrecision, DocumentItem, Entry, EntryKind, HealthEvent, Medication, Patient, Period } from "./api";

/**
 * Display helpers for the portal. Dates are shown in Irish time, the
 * database's "today" (supabase/README.md, "Time"). Words follow the boards
 * (PortalRecordE) and the contract's notes in section 10.
 */

const TZ = "Europe/Dublin";
/** Three-letter months; Intl gives "Sept" in en-IE and en-GB. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function patientFullName(p: Patient | null | undefined): string {
  if (!p) return "Your patient";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || "Your patient";
}

export function patientFirstName(p: Patient | null | undefined): string {
  return p?.first_name?.trim() || "the patient";
}

/** "JD"; one word gives one letter ("B" for Boots), as on the board. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "12 Mar 1991" from "1991-03-12" (a date, no time zone shift). */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "35, female, born 12 Mar 1991, Dublin" (the record header). */
export function patientLine(p: Patient | null | undefined): string {
  if (!p) return "";
  return [
    p.age != null ? String(p.age) : null,
    p.sex ? p.sex.toLowerCase() : null,
    p.date_of_birth ? `born ${formatDateOnly(p.date_of_birth)}` : null,
    p.city,
  ]
    .filter(Boolean)
    .join(", ");
}

function parts(iso: string) {
  const f = new Intl.DateTimeFormat("en-IE", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { day: get("day"), month: MONTHS[Number(get("month")) - 1] ?? "", year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** { day: "29", month: "Dec", year: "2026" } for a timestamp, in Irish time. */
export function dayMonth(iso: string) {
  const p = parts(iso);
  return { day: p.day, month: p.month, year: p.year };
}

/** "2026-12-29" in Irish time, for <time dateTime>. */
export function isoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** The current year in Ireland, on the given clock. */
export function currentYear(now: number = Date.now()): string {
  return parts(new Date(now).toISOString()).year;
}

/** "9:35" (24-hour, Irish time). */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parts(iso);
  return `${p.hour}:${p.minute}`;
}

/** "28m", "1h 05m" */
export function formatDuration(ms: number): string {
  // A session ended within its first half minute rounds to 0: say so in words, not "0m".
  if (ms < 30000) return "Under a minute";
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/** "30 min", "1 hour", "1 hour 15 min". */
function minutesWords(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} ${h === 1 ? "hour" : "hours"}${m ? ` ${m} min` : ""}`;
}

/**
 * The header's label over the time left ("Shared for 30 min"). With the
 * session's start and end it follows time the patient added since
 * ("Shared for 45 min").
 */
export function sharedForLabel(
  kind: string | null | undefined,
  approvedAt?: string | null,
  expiresAt?: string | null,
): string {
  const total = approvedAt && expiresAt ? Math.round((Date.parse(expiresAt) - Date.parse(approvedAt)) / 60000) : null;
  const nominal = kind === "30m" ? 30 : kind === "1h" ? 60 : null;
  if (nominal !== null && total !== null && Number.isFinite(total) && Math.abs(total - nominal) > 1) {
    return `Shared for ${minutesWords(total)}`;
  }
  switch (kind) {
    case "30m":
      return "Shared for 30 min";
    case "1h":
      return "Shared for 1 hour";
    case "all_day":
      return expiresAt ? `Shared until ${formatClock(expiresAt)}` : "Shared until 23:59";
    case "manual":
      return "Shared until ended";
    default:
      return "Shared";
  }
}

/** A date at its precision: "2 Aug 2026", "Feb 2025", "2015". */
export function formatPrecise(date: string, precision: DatePrecision): string {
  const [y, m, d] = date.split("-").map(Number);
  if (precision === "year" || !m) return String(y);
  if (precision === "month" || !d) return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Jan 2024 to Mar 2024", "Feb 2025 to now", "2 Aug 2026 to 9 Aug 2026". */
export function periodRange(p: Period): string {
  const from = formatPrecise(p.start_date, p.date_precision);
  const to = p.end_date ? formatPrecise(p.end_date, p.date_precision) : "now";
  return from === to ? from : `${from} to ${to}`;
}

/** Oldest first, for the step chart. */
export function chartPeriods(m: Medication) {
  return m.periods
    .slice()
    .reverse()
    .map((p) => ({
      value: p.strength,
      from: formatPrecise(p.start_date, p.date_precision),
      to: p.end_date ? formatPrecise(p.end_date, p.date_precision) : "now",
    }));
}

/** "Now 36mg, since Feb 2025" or "Stopped 9 Aug 2026". */
export function medicationLine(m: Medication): string {
  const now = m.periods[0];
  if (m.status === "past") {
    if (now?.end_date) return `Stopped ${formatPrecise(now.end_date, now.date_precision)}`;
    return m.ended_on ? `Stopped ${formatDateOnly(m.ended_on)}` : "Stopped";
  }
  if (!now) return m.strength_label ? `Now ${m.strength_label}` : "";
  return `Now ${now.strength_label}, since ${formatPrecise(now.start_date, now.date_precision)}`;
}

/** The list's sub line: the schedule for a current medication, the dates for a past one. */
export function medicationSub(m: Medication): string {
  if (m.status === "current") return m.schedule ?? "";
  const first = m.periods[m.periods.length - 1];
  const last = m.periods[0];
  if (first && last) {
    const from = formatPrecise(first.start_date, first.date_precision);
    const to = last.end_date ? formatPrecise(last.end_date, last.date_precision) : "now";
    return `${from} to ${to}`;
  }
  return [formatDateOnly(m.started_on), formatDateOnly(m.ended_on)].filter(Boolean).join(" to ");
}

/** "Managed, since 2019" / "Managed, since childhood". */
export function conditionSub(c: Condition): string {
  const status = c.status[0].toUpperCase() + c.status.slice(1);
  const since = c.diagnosed_year ? `since ${c.diagnosed_year}` : c.diagnosed_note;
  return [status, since].filter(Boolean).join(", ");
}

const KIND_WORDS: Record<EntryKind, string> = {
  visit: "Visit",
  result: "Result",
  prescription: "Prescription",
  note: "Note",
  letter: "Letter",
  imaging: "Imaging",
  vaccination: "Vaccination",
  session_notes: "Session notes",
};

export function entryType(e: Entry): string {
  return KIND_WORDS[e.kind] ?? "Visit";
}

/**
 * An entry's title as a row or heading shows it. Notes written in a Trace
 * session are stored with the title "Session notes", the same words as their
 * kind, so a row would say it twice: they read "Notes from Dr Hennessy" (the
 * patient app's words, `entryTitle()` in src/lib/patient/record.ts).
 */
export function entryTitle(e: Pick<Entry, "kind" | "title" | "clinician">): string {
  if (e.kind === "session_notes" && e.title.trim().toLowerCase() === "session notes" && e.clinician?.trim())
    return `Notes from ${e.clinician.trim()}`;
  return e.title;
}

/** "11 Nov 2026, Dr Hennessy, Rathmines Medical Centre"; a result says "ordered by". */
export function entryMeta(e: Entry): string {
  const p = parts(e.occurs_at);
  const date = `${p.day} ${p.month} ${p.year}`;
  const who = e.clinician ? (e.kind === "result" ? `ordered by ${e.clinician}` : e.clinician) : null;
  return [date, who, e.place].filter(Boolean).join(", ");
}

/** The detail pane's labelled fields for a text kind, in the contract's order. */
export function entryFields(e: Entry): Array<{ label: string; text: string }> {
  const d = e.detail;
  if (!d || d.kind !== "text") return [];
  const rows: Array<[string, string | null]> =
    e.kind === "prescription"
      ? [
          ["Medication", d.medication],
          ["Quantity", d.quantity],
          ["Pharmacy", d.pharmacy],
          ["Reason", d.reason],
          ["Assessment", d.assessment],
          ["Plan", d.plan],
        ]
      : [
          [e.kind === "session_notes" ? "Chief complaint" : "Reason", d.reason],
          ["Assessment", d.assessment],
          ["Plan", d.plan],
          ["Follow-up", d.follow_up],
          ["Medication", d.medication],
          ["Quantity", d.quantity],
          ["Pharmacy", d.pharmacy],
        ];
  return rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, text]) => ({ label, text }));
}

const EVENT_WORDS = { infection: "Infection", condition: "Condition" } as const;

/** "Aug, Infection" (the list's sub line). */
export function eventSub(e: HealthEvent): string {
  const [, m, d] = e.occurred_on.split("-").map(Number);
  const when =
    e.date_precision === "year" ? null : e.date_precision === "month" ? MONTHS[m - 1] : `${d} ${MONTHS[m - 1]}`;
  return [when, EVENT_WORDS[e.kind]].filter(Boolean).join(", ");
}

/** "Aug 2026, Infection" (the detail pane's meta line). */
export function eventMeta(e: HealthEvent): string {
  return `${formatPrecise(e.occurred_on, e.date_precision)}, ${EVENT_WORDS[e.kind]}`;
}

export function eventYear(e: HealthEvent): string {
  return e.occurred_on.slice(0, 4);
}

export function capitalise(s: string | null | undefined): string {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/** "PDF" or "Photo". */
export function documentType(d: DocumentItem): string {
  return d.content_type === "application/pdf" ? "PDF" : "Photo";
}

/** "PDF, 3 Oct 2026" */
export function documentSub(d: DocumentItem): string {
  return [documentType(d), formatDateOnly(d.document_date ?? d.created_at.slice(0, 10))].filter(Boolean).join(", ");
}
