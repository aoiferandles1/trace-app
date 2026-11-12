"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SessionReady } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { Card } from "@/components/ui/Card";
import { DetailBlock } from "@/components/ui/DetailBlock";
import { ListRow } from "@/components/ui/ListRow";
import { StateMessage } from "@/components/ui/StateMessage";
import {
  clinicianName,
  clinicianWithRole,
  formatDuration,
  joinLabels,
  minutesBetween,
  normaliseSession,
  sharedScopes,
  type ShareSession,
} from "@/lib/patient/share";
import { withBack } from "@/lib/back";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, SubScreen } from "../../_components/Screens";

/**
 * Sharing ended (no board; reached from Home's "View summary" after a share
 * ends), in the visit detail's pattern: the title, one line on who ended it,
 * labelled blocks (doctor, practice, how long, what was shared, the
 * doctor's notes if they wrote any), then two rows of what to do next. Reads the session named by `?id=` (falling back
 * to the latest one), so it still makes sense after a reload.
 */
function EndedScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const share = useShareSession();
  const live = share.session && share.session.id === id ? share.session : null;
  const endedLive = live?.status === "ended";
  const data = useLoad(async () => {
    const supabase = createClient();
    let row: unknown;
    if (id && isUuid(id)) {
      const { data, error } = await supabase.from("share_sessions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase.rpc("my_share_session");
      if (error) throw error;
      row = data;
    }
    const s = normaliseSession(row);
    if (!s || s.status !== "ended") return s;
    // Time the record was hidden (Time's up until more time or the end) is not time shared (A47).
    const { data: events, error: eventsError } = await supabase
      .from("access_events")
      .select("event, at, detail")
      .eq("session_id", s.id)
      .in("event", ["paused", "extended", "ended"])
      .order("at");
    if (eventsError) throw eventsError;
    let hiddenMs = 0;
    let pausedAt: number | null = null;
    for (const e of events ?? []) {
      const at = Date.parse(e.at);
      if (e.event === "paused") pausedAt = at;
      else if (pausedAt !== null) {
        hiddenMs += Math.max(0, at - pausedAt);
        pausedAt = null;
      }
    }
    const withHidden = { ...s, hiddenMinutes: Math.round(hiddenMs / 60_000) };
    if (s.notes_entry_id) return withHidden;
    // The notes on the timeline are the truth: the same entry the access log links to.
    const { data: notes, error } = await supabase
      .from("entries")
      .select("id")
      .eq("session_id", s.id)
      .eq("kind", "session_notes")
      .limit(1);
    if (error) throw error;
    return { ...withHidden, notes_entry_id: notes?.[0]?.id ?? null };
    // Read again once the live copy says the session ended, in case this read came first.
  }, [id, endedLive]);

  // An ended session is final, so the row read here (after the end) is the
  // truth. The live copy only helps while that read is still behind.
  const read = data.status === "ready" ? data.data : null;
  const session: (ShareSession & { hiddenMinutes?: number }) | null = read?.status === "ended" ? read : (live ?? read);

  return (
    <SubScreen title="Sharing ended" backHref="/home" backLabel="Back to Home">
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !session || session.status !== "ended" ? (
        <StateMessage
          className="px-5 pt-2"
          message="No finished share to show. Share history has every share you have made."
          action={{ label: "View share history", href: "/access-log" }}
        />
      ) : (
        <EndedBody session={session} />
      )}
    </SubScreen>
  );
}

function endedLine(s: ShareSession): string {
  const name = clinicianName(s);
  if (s.ended_by === "clinician") return `${name} ended sharing and no longer has access to your record.`;
  if (s.ended_by === "timeout") return `Sharing closed after Time's up. ${name} no longer has access to your record.`;
  return `${name} no longer has access to your record.`;
}

function EndedBody({ session }: { session: ShareSession & { hiddenMinutes?: number } }) {
  const minutes = Math.max(0, minutesBetween(session.approved_at, session.ended_at) - (session.hiddenMinutes ?? 0));
  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-3.5">
      <p className="-mt-1.5 text-body text-ink-2">{endedLine(session)}</p>
      <dl className="flex flex-col gap-4">
        <DetailBlock term label="Doctor">
          {clinicianWithRole(session)}
        </DetailBlock>
        {session.clinician_practice && (
          <DetailBlock term label="Practice">
            {session.clinician_practice}
          </DetailBlock>
        )}
        <DetailBlock term label="Time shared">
          {formatDuration(minutes)}
        </DetailBlock>
        <DetailBlock term label="Shared">
          {joinLabels(sharedScopes(session))}
        </DetailBlock>
        <DetailBlock term label="Doctor's notes">
          {session.notes_entry_id ? (
            <Link
              href={withBack(`/record/${session.notes_entry_id}`, `/session/ended?id=${session.id}`)}
              className="font-semibold text-accent underline-offset-2 hovered:underline"
              aria-label="View the doctor's notes"
            >
              View
            </Link>
          ) : session.allow_notes ? (
            "None written"
          ) : (
            "Not allowed"
          )}
        </DetailBlock>
      </dl>
      <Card as="ul">
        <li>
          <ListRow href="/add" icon="document-plus" title="Add to your record" caption="While the visit is fresh" chevron />
        </li>
        <li>
          <ListRow href="/access-log" icon="history" title="Share history" chevron />
        </li>
      </Card>
    </div>
  );
}

export default function SessionEndedPage() {
  return (
    <SessionReady>
      <EndedScreen />
    </SessionReady>
  );
}
