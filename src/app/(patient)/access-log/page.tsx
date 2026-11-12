"use client";

import Link from "next/link";
import { SessionReady } from "@/components/patient/PatientSession";
import { cn } from "@/lib/cn";
import { formatTime, formatWeekdayDate } from "@/lib/dates";
import { serverNow } from "@/lib/serverClock";
import {
  clinicianName,
  formatDuration,
  minutesBetween,
  normaliseSession,
  prefsOf,
  sharedScopes,
  type ShareSession,
} from "@/lib/patient/share";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { StateMessage } from "@/components/ui/StateMessage";
import { LoadStatus, SubScreen } from "../_components/Screens";

type AccessEvent = Tables<"access_events">;

async function loadLog() {
  const supabase = createClient();
  const [sessions, events] = await Promise.all([
    supabase.from("share_sessions").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("access_events").select("*").order("at", { ascending: true }).limit(2000),
  ]);
  const byId = new Map<string, AccessEvent[]>();
  for (const e of must(events)) {
    if (!e.session_id) continue;
    byId.set(e.session_id, [...(byId.get(e.session_id) ?? []), e]);
  }
  return must(sessions)
    .map((s) => normaliseSession(s))
    .filter((s): s is ShareSession => Boolean(s))
    .map((s) => ({ session: s, events: byId.get(s.id) ?? [] }));
}

const STATUS: Record<string, { label: string; urgent: boolean }> = {
  code_issued: { label: "Code ready", urgent: false },
  requested: { label: "Waiting for you", urgent: true },
  active: { label: "Live now", urgent: false },
  paused: { label: "Time's up", urgent: true },
  ended: { label: "Ended", urgent: false },
  denied: { label: "Denied", urgent: true },
  expired: { label: "Expired", urgent: false },
  cancelled: { label: "Cancelled", urgent: false },
};

const SECTION_NAMES: Record<string, string> = {
  overview: "the overview",
  conditions: "conditions",
  timeline: "the timeline",
  medications: "medications",
  care_team: "the care team",
  recent_visits: "recent visits",
  full_timeline: "the full timeline",
  family_history: "family history",
  insurance: "insurance",
  documents: "documents",
  mental_health: "mental health",
};

/** One line per access event, in plain words. */
function describe(e: AccessEvent, s: ShareSession): string {
  const d = (e.detail ?? {}) as Record<string, unknown>;
  const doctor = typeof d.clinician_name === "string" ? d.clinician_name : clinicianName(s);
  switch (e.event) {
    case "code_generated":
      return "You made a share code";
    case "requested":
      return `${doctor} typed the code and asked for access`;
    case "request_cancelled":
      return `${clinicianName(s)} cancelled their request`;
    case "approved":
      return "You allowed access";
    case "denied":
      return "You denied access";
    case "expired":
      return d.stage === "request" ? "The request closed with no answer" : "The code expired unused";
    case "cancelled":
      return d.reason === "regenerated" ? "Replaced by a new code" : "You cancelled the code";
    case "section_viewed":
      return `Viewed ${SECTION_NAMES[String(d.section)] ?? String(d.section)}`;
    case "paused":
      return "Time ran out, access paused";
    case "extended":
      return `You added ${String(d.minutes)} minutes`;
    case "document_viewed":
      return "Opened a document";
    case "notes_saved":
      return "Their notes were added to your record";
    case "ended":
      return d.by === "clinician"
        ? `${clinicianName(s)} ended sharing`
        : d.by === "timeout"
          ? "Sharing closed after Time's up"
          : "You ended sharing";
    default:
      return e.event;
  }
}

/** Runs of the same line in a row become one ("Viewed medications, 3 times"), at the first one's time (B7). */
function grouped(events: AccessEvent[], s: ShareSession): { id: number; at: string; text: string; times: number }[] {
  const out: { id: number; at: string; text: string; times: number }[] = [];
  for (const e of events) {
    const text = describe(e, s);
    const last = out[out.length - 1];
    if (last && last.text === text) last.times += 1;
    else out.push({ id: e.id, at: e.at, text, times: 1 });
  }
  return out;
}

/** A code nobody typed, now finished: not a share at all. */
function unused(s: ShareSession): boolean {
  return !s.requested_at && (s.status === "expired" || s.status === "cancelled");
}

/**
 * Share history (the access log; no board, PLAN.md section 8, item 7): every share,
 * newest first, with who asked, when, how long they had access, what was
 * shared, and the events inside it (from access_events, which only the
 * database writes). Codes nobody used are not shares: they are counted in
 * one line at the end instead of a card each (A15).
 */
function AccessLogScreen() {
  const data = useLoad(loadLog);
  const shares = data.status === "ready" ? data.data.filter((x) => !unused(x.session)) : [];
  const spare = data.status === "ready" ? data.data.length - shares.length : 0;
  return (
    <SubScreen title="Share history" backHref="/profile" backLabel="Back to Profile" tabBar>
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : shares.length === 0 ? (
        <StateMessage
          className="px-5 py-6"
          message={`You haven't shared your record yet.${spare ? ` ${spareLine(spare)}` : ""} Every share shows up here.`}
          action={{ label: "Share your record", href: "/share" }}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
          <p className="text-caption text-ink-2">Every share, newest first. Only you can see this.</p>
          <ul className="flex flex-col gap-3">
            {shares.map(({ session, events }, i) => (
              <li key={session.id}>
                <SessionCard session={session} events={events} open={i === 0} />
              </li>
            ))}
          </ul>
          {spare > 0 && <p className="text-caption text-ink-2">{spareLine(spare)}</p>}
        </div>
      )}
    </SubScreen>
  );
}

/** "2 codes were made and never used." */
function spareLine(n: number): string {
  return n === 1 ? "1 code was made and never used." : `${n} codes were made and never used.`;
}

function SessionCard({ session: s, events, open }: { session: ShareSession; events: AccessEvent[]; open: boolean }) {
  const status = STATUS[s.status] ?? { label: s.status, urgent: false };
  const who = s.clinician_name ? [s.clinician_name, s.clinician_role].filter(Boolean).join(", ") : "Waiting for a doctor";
  const when = s.approved_at ?? s.requested_at ?? s.created_at;
  const minutes = s.approved_at ? minutesBetween(s.approved_at, s.ended_at ?? s.paused_at ?? new Date(serverNow()).toISOString()) : null;
  return (
    <article
      aria-label={`${who}, ${formatWeekdayDate(when)}`}
      className="flex flex-col gap-3 rounded-card border border-border-card bg-surface p-4.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-row font-medium">{who}</h2>
          {s.clinician_practice && <p className="text-caption text-ink-2">{s.clinician_practice}</p>}
        </div>
        <p className={cn("shrink-0 text-caption", status.urgent ? "font-semibold text-urgent" : "text-ink-2")}>{status.label}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-caption">
        <dt className="text-ink-2">When</dt>
        <dd>
          {formatWeekdayDate(when)}, {formatTime(when)}
        </dd>
        {minutes !== null && (
          <>
            <dt className="text-ink-2">How long</dt>
            <dd>{formatDuration(minutes)}</dd>
          </>
        )}
        <dt className="text-ink-2">Shared</dt>
        <dd>{sharedScopes(prefsOf(s)).map((x) => x.label).join(", ")}</dd>
        {s.notes_entry_id && (
          <>
            <dt className="text-ink-2">Notes</dt>
            <dd>
              <Link href={`/record/${s.notes_entry_id}`} className="text-accent underline underline-offset-2">
                Doctor&apos;s notes
              </Link>
            </dd>
          </>
        )}
      </dl>
      {events.length > 0 && (
        <details open={open} className="group border-t border-border-row pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-caption font-semibold text-accent">
            What happened
          </summary>
          <ol className="flex flex-col gap-1.5 pb-1">
            {grouped(events, s).map((e) => (
              <li key={e.id} className="flex gap-3 text-caption">
                <span className="w-14 shrink-0 text-ink-2">{formatTime(e.at)}</span>
                <span className="text-ink">
                  {e.text}
                  {e.times > 1 ? `, ${e.times} times` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

export default function AccessLogPage() {
  return (
    <SessionReady>
      <AccessLogScreen />
    </SessionReady>
  );
}
