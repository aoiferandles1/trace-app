import type { Tables } from "@/lib/supabase/database.types";

/**
 * The patient's side of a share (supabase/README.md sections 3 and 4).
 *
 * The database decides every state and every time. These helpers only turn
 * the session row into words and numbers for the screens.
 */

export type ShareStatus =
  | "code_issued"
  | "requested"
  | "active"
  | "paused"
  | "denied"
  | "expired"
  | "cancelled"
  | "ended";

export type DurationKind = "30m" | "1h" | "all_day" | "manual";

/** The session row, as read from the table, realtime or a function. */
export type ShareSession = Omit<Tables<"share_sessions">, "portal_token_hash" | "status" | "duration_kind"> & {
  status: ShareStatus;
  duration_kind: DurationKind;
  portal_token_hash?: string | null;
  /** Function results only; computed from paused_at for table reads and realtime. */
  closes_at?: string | null;
};

export type SharePrefs = {
  share_conditions: boolean;
  share_recent_visits: boolean;
  share_full_timeline: boolean;
  share_care_team: boolean;
  share_mental_health: boolean;
  allow_notes: boolean;
  duration_kind: DurationKind;
};

/** The GP visit profile (PLAN.md section 7): what every share starts from. */
export const GP_VISIT_DEFAULTS: SharePrefs = {
  share_conditions: true,
  share_recent_visits: true,
  share_full_timeline: false,
  share_care_team: true,
  share_mental_health: false,
  allow_notes: true,
  duration_kind: "30m",
};

export const LIVE_STATUSES: ShareStatus[] = ["code_issued", "requested", "active", "paused"];

/** A code, a request, or a session someone can see right now. */
export function isLive(s: ShareSession | null | undefined): s is ShareSession {
  return Boolean(s && LIVE_STATUSES.includes(s.status));
}

/** A doctor has (or had until Time's up) access: active or paused. */
export function isOpen(s: ShareSession | null | undefined): s is ShareSession {
  return Boolean(s && (s.status === "active" || s.status === "paused"));
}

/** Paused sessions close on their own 30 minutes after the timer ran out. */
const PAUSE_GRACE_MS = 30 * 60_000;

/** Normalises a row from any source: fills `closes_at` when the source left it out. */
export function normaliseSession(raw: unknown): ShareSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ShareSession;
  if (!s.id || !s.status) return null;
  const closes_at =
    s.closes_at ??
    (s.status === "paused" && s.paused_at ? new Date(Date.parse(s.paused_at) + PAUSE_GRACE_MS).toISOString() : null);
  return { ...s, closes_at };
}

export function prefsOf(s: ShareSession): SharePrefs {
  return {
    share_conditions: s.share_conditions,
    share_recent_visits: s.share_recent_visits,
    share_full_timeline: s.share_full_timeline,
    share_care_team: s.share_care_team,
    share_mental_health: s.share_mental_health,
    allow_notes: s.allow_notes,
    duration_kind: s.duration_kind,
  };
}

/** "30 min", "1 hour", "All day", "Until you stop it" (the request sheet's chip). */
export function durationLabel(kind: DurationKind): string {
  switch (kind) {
    case "30m":
      return "30 min";
    case "1h":
      return "1 hour";
    case "all_day":
      return "All day";
    default:
      return "Until you stop it";
  }
}

export const DURATION_OPTIONS: { value: DurationKind; label: string; description: string }[] = [
  { value: "30m", label: "30 min", description: "Standard GP" },
  { value: "1h", label: "1 hour", description: "Longer visit" },
  { value: "all_day", label: "All day", description: "Hospital stay" },
  { value: "manual", label: "Manual", description: "I'll stop it" },
];

/** "Dr Hennessy" or a neutral stand-in when the name is missing. */
export function clinicianName(s: Pick<ShareSession, "clinician_name">): string {
  return s.clinician_name?.trim() || "Your doctor";
}

/** "Dr Hennessy · GP". */
export function clinicianWithRole(s: Pick<ShareSession, "clinician_name" | "clinician_role">): string {
  return [clinicianName(s), s.clinician_role].filter(Boolean).join(" · ");
}

/** What the doctor sees, for the request sheet (p-request), in the frame's words. */
export function sharedList(p: SharePrefs): string[] {
  const out = ["Critical safety", "Medications"];
  if (p.share_conditions) out.push("Active conditions");
  if (p.share_full_timeline) out.push("Full timeline");
  else if (p.share_recent_visits) out.push("Recent visits (last 3)");
  if (p.share_care_team) out.push("Care team");
  if (p.share_mental_health) out.push("Mental health history");
  if (p.allow_notes) out.push("Can add session notes to your record");
  return out;
}

/** What is left out, in plain words: ["full timeline", "documents", "insurance", "mental health"]. */
export function notIncludedList(p: SharePrefs): string[] {
  const out: string[] = [];
  if (!p.share_conditions) out.push("conditions");
  if (!p.share_full_timeline) out.push(p.share_recent_visits ? "full timeline" : "visits and timeline");
  if (!p.share_care_team) out.push("care team");
  out.push("documents", "insurance");
  if (!p.share_mental_health) out.push("mental health");
  return out;
}

/** "Full timeline, documents, insurance and mental health". */
export function joinAnd(items: string[]): string {
  if (items.length === 0) return "";
  const text = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The request sheet's line under the doctor. A share from Profile has no appointment. */
export function shareContext(s: Pick<ShareSession, "appointment_entry_id">): string {
  return s.appointment_entry_id
    ? "Sharing your GP visit profile for this appointment."
    : "Sharing your GP visit profile. This share is not linked to an appointment.";
}

/** Milliseconds left on a timestamp (never below 0). */
export function msUntil(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Date.parse(iso) - now);
}

/** "24 min 31 sec", "1 hr 4 min". */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min ${s} sec`;
}

/** Whole minutes between two timestamps, at least 0. */
export function minutesBetween(from: string | null | undefined, to: string | null | undefined): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

/** "28 minutes", "1 minute", "Less than a minute", "1 hr 5 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return "Less than a minute";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} ${h === 1 ? "hour" : "hours"}`;
}

/** True when the doctor wrote anything in the notes draft. */
export function hasNotes(s: ShareSession): boolean {
  return [s.chief_complaint, s.assessment, s.plan, s.follow_up].some((v) => Boolean(v && v.trim()));
}

/** The 12 hour cap on any session (supabase/README.md section 3). */
export function hardEndOf(s: Pick<ShareSession, "approved_at">): string | null {
  return s.approved_at ? new Date(Date.parse(s.approved_at) + 12 * 3600_000).toISOString() : null;
}

/** Words for a database error code from a patient function. */
export function shareErrorMessage(code: string | undefined): string {
  switch (code) {
    case "session_live":
      return "A doctor can already see your record. End that session before you start a new share.";
    case "invalid_appointment":
      return "That appointment isn't in your record any more. Share from your profile instead.";
    case "session_limit_reached":
      return "This share has reached its 12 hour limit. Save and end it.";
    case "no_live_session":
      return "This session has already closed.";
    case "not_requested":
      return "That request has already closed.";
    default:
      return "That didn't work. Check your connection and try again.";
  }
}
