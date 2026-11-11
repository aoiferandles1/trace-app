"use client";

import { Check, ChevronRight, FilePlus, FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { SessionStatusRow } from "@/components/patient/SharedSummaryCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
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
 * Session ended (p-ended): who had access, for how long, and the doctor's
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
      header={<DemoMarker />}
      footer={
        <ButtonLink href="/home" size="lg" fullWidth>
          Back to home
        </ButtonLink>
      }
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !session || session.status !== "ended" ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <h1 className="text-h3 font-medium">No ended session to show</h1>
          <p className="text-body-sm text-text-tertiary">Your access log has every share you have made.</p>
          <ButtonLink href="/access-log" variant="secondary">
            View access log
          </ButtonLink>
        </div>
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
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2">
      <SessionStatusRow label="Session ended" dot="red" time="00:00" timeLabel="No time left" tone="page" />
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <span
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full bg-brand-teal-tint text-teal-700"
        >
          <Check className="size-8" />
        </span>
        <h1 className="font-display text-[40px] font-light leading-[1.15]">Session ended</h1>
        <p className="text-body-lg text-text-tertiary">{endedLine(session)}</p>
      </div>

      <dl className="divide-y divide-border-default rounded-card border border-border-default bg-surface-card">
        <Row label="Doctor">{clinicianWithRole(session)}</Row>
        <Row label="Duration">{formatDuration(minutes)}</Row>
        <Row label="Profile used">GP visit</Row>
        <Row label="Session notes">
          {session.notes_entry_id ? (
            <Link
              href={`/record/${session.notes_entry_id}`}
              className="text-indigo-text underline-offset-2 hovered:underline"
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

      <section aria-labelledby="next-label" className="flex flex-col gap-3">
        <SectionLabel id="next-label">What would you like to do?</SectionLabel>
        <ul className="divide-y divide-border-default overflow-hidden rounded-card border border-border-default bg-surface-card">
          <li>
            <Action
              href="/add"
              highlight
              icon={<FilePlus />}
              title="Add notes or receipts"
              detail="While the appointment is fresh"
            />
          </li>
          <li>
            <Action href="/access-log" icon={<FileText />} title="View access log" detail="Full session history" />
          </li>
        </ul>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-3">
      <dt className="text-body-tiny text-text-tertiary">{label}</dt>
      <dd className="text-right text-body-sm text-text-primary">{children}</dd>
    </div>
  );
}

function Action({
  href,
  icon,
  title,
  detail,
  highlight = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // Inside a list that clips its corners: keep the focus ring inside the row.
        "flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-150 focus-visible:-outline-offset-2",
        highlight ? "bg-brand-indigo-tint hovered:bg-indigo-100" : "hovered:bg-neutral-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-sm [&_svg]:size-5",
          highlight ? "bg-indigo-accessible text-white" : "bg-brand-indigo-tint text-indigo-text",
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-body-lg", highlight ? "text-indigo-text" : "text-text-primary")}>{title}</span>
        <span className="text-body-tiny text-text-tertiary">{detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-tertiary" />
    </Link>
  );
}

export default function SessionEndedPage() {
  return (
    <SessionReady>
      <EndedScreen />
    </SessionReady>
  );
}
