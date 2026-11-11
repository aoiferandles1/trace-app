"use client";

import Link from "next/link";
import { SessionReady } from "@/components/patient/PatientSession";
import { Pill, type Tone } from "@/components/ui/Pill";
import { formatTime, formatWeekdayDate } from "@/lib/dates";
import {
  clinicianName,
  formatDuration,
  minutesBetween,
  normaliseSession,
  prefsOf,
  sharedList,
  type ShareSession,
} from "@/lib/patient/share";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
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

const STATUS: Record<string, { label: string; tone: Tone }> = {
  code_issued: { label: "Code ready", tone: "indigo" },
  requested: { label: "Waiting for you", tone: "peach" },
  active: { label: "Live now", tone: "teal" },
  paused: { label: "Time's up", tone: "peach" },
  ended: { label: "Ended", tone: "neutral" },
  denied: { label: "Denied", tone: "red" },
  expired: { label: "Expired", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const SECTION_NAMES: Record<string, string> = {
  overview: "the overview",
  conditions: "conditions",
  timeline: "the timeline",
  medications: "medications",
  care_team: "the care team",
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
      return "The doctor cancelled their request";
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
    case "notes_saved":
      return "Session notes added to your record";
    case "ended":
      return d.by === "clinician"
        ? "The doctor ended the session"
        : d.by === "timeout"
          ? "The session closed after Time's up"
          : "You ended the session";
    default:
      return e.event;
  }
}

/**
 * Access log (no Figma frame; PLAN.md section 8, item 7): every share,
 * newest first, with who asked, when, how long they had access, what was
 * shared, and the events inside it (from access_events, which only the
 * database writes).
 */
function AccessLogScreen() {
  const data = useLoad(loadLog);
  return (
    <SubScreen title="Access log" backHref="/profile" backLabel="Back to My profile">
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <p className="px-5 py-10 text-center text-body-sm text-text-tertiary">
          You haven&apos;t shared your record yet. Every share shows up here.
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
          <p className="text-body-sm text-text-tertiary">Every share, newest first. Only you can see this.</p>
          <ul className="flex flex-col gap-3">
            {data.data.map(({ session, events }, i) => (
              <li key={session.id}>
                <SessionCard session={session} events={events} open={i === 0} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </SubScreen>
  );
}

function SessionCard({ session: s, events, open }: { session: ShareSession; events: AccessEvent[]; open: boolean }) {
  const status = STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone };
  const who = s.clinician_name
    ? [s.clinician_name, s.clinician_role].filter(Boolean).join(" · ")
    : "No one used this code";
  const when = s.approved_at ?? s.requested_at ?? s.created_at;
  const minutes = s.approved_at ? minutesBetween(s.approved_at, s.ended_at ?? s.paused_at ?? new Date().toISOString()) : null;
  return (
    <article
      aria-label={`${who}, ${formatWeekdayDate(when)}`}
      className="flex flex-col gap-3 rounded-card border border-border-default bg-surface-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 font-bold">{who}</h2>
          {s.clinician_practice && <p className="text-meta text-text-tertiary">{s.clinician_practice}</p>}
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
        <dt className="text-text-tertiary">When</dt>
        <dd>
          {formatWeekdayDate(when)} · {formatTime(when)}
        </dd>
        {minutes !== null && (
          <>
            <dt className="text-text-tertiary">How long</dt>
            <dd>{formatDuration(minutes)}</dd>
          </>
        )}
        <dt className="text-text-tertiary">Shared</dt>
        <dd>{sharedList(prefsOf(s)).join(", ")}</dd>
        {s.notes_entry_id && (
          <>
            <dt className="text-text-tertiary">Notes</dt>
            <dd>
              <Link href={`/record/${s.notes_entry_id}`} className="text-indigo-text underline underline-offset-2">
                Session notes
              </Link>
            </dd>
          </>
        )}
      </dl>
      {events.length > 0 && (
        <details open={open} className="group rounded-md bg-surface-sunken">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-body-sm font-medium text-indigo-text">
            What happened ({events.length})
          </summary>
          <ol className="flex flex-col gap-1.5 px-3 pb-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-body-tiny">
                <span className="w-14 shrink-0 text-text-tertiary">{formatTime(e.at)}</span>
                <span className="text-text-primary">{describe(e, s)}</span>
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
