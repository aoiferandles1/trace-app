import type { IconName } from "@/components/ui/Icon";
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

/** The switches on Share confirm (supabase/README.md, the new create_share_code). */
export type ScopeKey =
  | "share_conditions"
  | "share_recent_visits"
  | "share_full_timeline"
  | "share_care_team"
  | "share_documents"
  | "share_family_history"
  | "share_medication_notes"
  | "share_mental_health";

export type SharePrefs = Record<ScopeKey, boolean> & {
  allow_notes: boolean;
  duration_kind: DurationKind;
};

/**
 * The GP visit profile (PLAN.md section 7, BRIEF.md section 4.5): what every
 * share starts from. The original five, Full timeline and Medication notes on
 * (owner's decision, 11 Nov 2026); Documents, Family history and Mental
 * health off. Insurance is personal and never shared (owner's decision), so
 * it is not a switch at all: createCodeArgs always sends it off.
 */
export const GP_VISIT_DEFAULTS: SharePrefs = {
  share_conditions: true,
  share_recent_visits: true,
  share_full_timeline: true,
  share_care_team: true,
  share_documents: false,
  share_family_history: false,
  share_medication_notes: true,
  share_mental_health: false,
  allow_notes: true,
  duration_kind: "30m",
};

export type ScopeDef = {
  /** null for the two that are always shared. */
  key: ScopeKey | null;
  /** "safety" and "medications" for the locked ones, else the key without "share_". */
  id: string;
  label: string;
  icon: IconName;
};

/**
 * Every section of a share, in the order the screens list them (ShareA2's
 * tiles, then the four new ones in the same style, Mental health last).
 * "Sharing" and "Not shared" on every share screen come from this and the
 * session's own switches, never from a fixed list.
 */
export const SCOPES: ScopeDef[] = [
  { key: null, id: "safety", label: "Safety info", icon: "shield-alert" },
  { key: null, id: "medications", label: "Medications", icon: "pill" },
  { key: "share_conditions", id: "conditions", label: "Conditions", icon: "heart-pulse" },
  { key: "share_recent_visits", id: "recent_visits", label: "Recent visits", icon: "calendar" },
  { key: "share_full_timeline", id: "full_timeline", label: "Full timeline", icon: "clock" },
  { key: "share_care_team", id: "care_team", label: "Care team", icon: "people" },
  { key: "share_documents", id: "documents", label: "Documents", icon: "document" },
  { key: "share_family_history", id: "family_history", label: "Family history", icon: "tree" },
  { key: "share_medication_notes", id: "medication_notes", label: "Medication notes", icon: "pencil" },
  { key: "share_mental_health", id: "mental_health", label: "Mental health", icon: "smile" },
];

/** The sections a share includes, in order (the two locked ones first). */
export function sharedScopes(p: Pick<SharePrefs, ScopeKey>): ScopeDef[] {
  return SCOPES.filter((s) => s.key === null || p[s.key]);
}

/** The sections a share leaves out, in order. */
export function notSharedScopes(p: Pick<SharePrefs, ScopeKey>): ScopeDef[] {
  return SCOPES.filter((s) => s.key !== null && !p[s.key]);
}

/** The arguments for the new create_share_code: every scope named, so the call reaches the new version. */
export function createCodeArgs(p: SharePrefs, appointmentId: string | null) {
  return {
    share_conditions: p.share_conditions,
    share_recent_visits: p.share_recent_visits,
    share_full_timeline: p.share_full_timeline,
    share_care_team: p.share_care_team,
    share_documents: p.share_documents,
    share_family_history: p.share_family_history,
    // Insurance is personal (owner's decision): never shared. The database still takes the switch.
    share_insurance: false,
    share_medication_notes: p.share_medication_notes,
    share_mental_health: p.share_mental_health,
    allow_notes: p.allow_notes,
    duration_kind: p.duration_kind,
    ...(appointmentId ? { appointment_entry_id: appointmentId } : {}),
  };
}

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
    // Sessions the old create_share_code made have none of the new switches.
    share_documents: Boolean(s.share_documents),
    share_family_history: Boolean(s.share_family_history),
    share_medication_notes: Boolean(s.share_medication_notes),
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

/** "Full timeline, Documents, Family history, Insurance, Mental health" (ApproveA2's "Not shared" line). */
export function joinLabels(items: ScopeDef[]): string {
  return items.map((s) => s.label).join(", ");
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
