"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { IconName } from "@/components/ui/Icon";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { PageState } from "@/components/ui/StateMessage";
import {
  clinicianName,
  clinicianWithRole,
  formatDuration,
  minutesBetween,
  normaliseSession,
  type ShareSession,
} from "@/lib/patient/share";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DemoMarker, LoadStatus } from "../../_components/Screens";

/**
 * Session ended (no board; reached from Home's "View summary" after a share ends): who had access, for how long, and the doctor's
 * notes if they wrote any. Reads the session named by `?id=` (falling back
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
    if (!s || s.status !== "ended" || s.notes_entry_id) return s;
    // The notes on the timeline are the truth: the same entry the access log links to.
    const { data: notes, error } = await supabase
      .from("entries")
      .select("id")
      .eq("session_id", s.id)
      .eq("kind", "session_notes")
      .limit(1);
    if (error) throw error;
    return { ...s, notes_entry_id: notes?.[0]?.id ?? null };
    // Read again once the live copy says the session ended, in case this read came first.
  }, [id, endedLive]);

  // An ended session is final, so the row read here (after the end) is the
  // truth. The live copy only helps while that read is still behind.
  const read = data.status === "ready" ? data.data : null;
  const session = read?.status === "ended" ? read : (live ?? read);

  return (
    <PatientShell
      demo={<DemoMarker />}
      footer={
        <ButtonLink href="/home" size="lg" fullWidth>
          Back to home
        </ButtonLink>
      }
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !session || session.status !== "ended" ? (
        <PageState
          title="No ended session to show"
          message="Your share history has every share you have made."
          action={{ label: "View share history", href: "/access-log" }}
        />
      ) : (
        <EndedBody session={session} />
      )}
    </PatientShell>
  );
}

function endedLine(s: ShareSession): string {
  const name = clinicianName(s);
  if (s.ended_by === "clinician") return `${name} ended the session and no longer has access to your record.`;
  if (s.ended_by === "timeout") return `The session closed after Time's up. ${name} no longer has access to your record.`;
  return `${name} no longer has access to your record.`;
}

function EndedBody({ session }: { session: ShareSession }) {
  const minutes = minutesBetween(session.approved_at, session.ended_at);
  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-1">
      <div className="flex flex-col items-center gap-2 pt-6 text-center">
        <h1 className="font-display text-title font-light">Session ended</h1>
        <p className="text-body-lg text-ink-2">{endedLine(session)}</p>
      </div>

      <Card as="article" className="px-4.5">
        <dl className="divide-y divide-border-row">
          <Row label="Doctor">{clinicianWithRole(session)}</Row>
          <Row label="Duration">{formatDuration(minutes)}</Row>
          <Row label="Profile used">GP visit</Row>
          <Row label="Session notes">
            {session.notes_entry_id ? (
              <Link
                href={`/record/${session.notes_entry_id}`}
                className="font-semibold text-accent underline-offset-2 hovered:underline"
                aria-label="View session notes"
              >
                View
              </Link>
            ) : session.allow_notes ? (
              "None written"
            ) : (
              "Not allowed"
            )}
          </Row>
        </dl>
      </Card>

      <section aria-labelledby="next-label" className="flex flex-col gap-2">
        <SectionHeading id="next-label">What would you like to do?</SectionHeading>
        <Card as="ul">
          <li>
            <Action href="/add" icon="document-plus" title="Add to your record" detail="While the appointment is fresh" />
          </li>
          <li>
            <Action href="/access-log" icon="history" title="View share history" detail="Every share you have made" />
          </li>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-3">
      <dt className="text-caption text-ink-2">{label}</dt>
      <dd className="text-right text-body text-ink">{children}</dd>
    </div>
  );
}

function Action({ href, icon, title, detail }: { href: string; icon: IconName; title: string; detail: string }) {
  return <ListRow href={href} icon={icon} title={title} caption={detail} chevron />;
}

export default function SessionEndedPage() {
  return (
    <SessionReady>
      <EndedScreen />
    </SessionReady>
  );
}
