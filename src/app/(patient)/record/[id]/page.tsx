"use client";

import { useBack } from "@/lib/back";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { ResultRow } from "@/components/ui/RangeBar";
import { SwitchRow } from "@/components/ui/Switch";
import { formatTime, formatTimelineDate } from "@/lib/dates";
import {
  ENTRY_KIND_LABEL,
  loadSections,
  type RecordEntry,
  type ResultValue,
  type TextDetail,
  entryTitle,
} from "@/lib/patient/record";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DetailList, NotFound } from "../../_components/DetailList";
import { DeleteWithConfirm, MENTAL_HEALTH_LINE, PERSONAL_NOTE_LINE } from "../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../_components/Screens";
import { RecordPanel } from "../_components/RecordPanel";

async function loadEntry(id: string): Promise<RecordEntry | null> {
  if (!isUuid(id)) return null;
  const r = await loadSections("recent_visits", "full_timeline");
  return [...r.recent_visits.upcoming, ...r.full_timeline.visits].find((e) => e.id === id) ?? null;
}

/**
 * Visit detail (BRIEF.md 5.9; no board): the visit as the title, a caption
 * with the kind, date, doctor and place, then one of two kinds, the same
 * patterns as the portal's Recent visits pane:
 * - text: Reason, Assessment, Plan, Follow-up blocks (a prescription's
 *   Medication, Quantity and Pharmacy; a doctor's session notes start with
 *   Chief complaint);
 * - result: a card of results, each with its value, unit and range bar, and
 *   "low" or "high" in words when out of range.
 *
 * Entries the patient wrote keep Edit (the pencil) and Delete. Session notes
 * from a doctor are read-only apart from their mental health flag, and can be
 * deleted. This is also the session notes view the ended summary links to.
 */
function EntryDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const data = useLoad(() => loadEntry(id), [id]);
  const entry = data.status === "ready" ? data.data : null;
  const editable = entry && entry.source === "patient" && entry.kind !== "session_notes";
  // Opened from Home or a share's summary, Back returns there.
  const back = useBack("/record");

  return (
    <SubScreen
      title={entry ? entryTitle(entry) : "Entry"}
      titleSize="md"
      backHref={back}
      backLabel={back === "/record" ? "Back to Record" : "Back"}
      action={editable ? <IconLink href={`/record/${entry.id}/edit`} label={`Edit ${entry.title}`} icon="pencil" size={32} /> : undefined}
      tabBar
      aside={<RecordPanel level={2} initialTab="timeline" current={id} syncUrl={false} />}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !entry ? (
        <NotFound what="entry" />
      ) : (
        <EntryDetail entry={entry} />
      )}
    </SubScreen>
  );
}

/** "Result, 2 Nov 2026, ordered by Dr Hennessy, Mater Hospital"; "Upcoming visit, 25 Nov 2026, 9:30am, ...". */
function caption(e: RecordEntry): string {
  const kind = ENTRY_KIND_LABEL[e.kind];
  const when = e.kind === "visit" ? `${formatTimelineDate(e.occurs_at)}, ${formatTime(e.occurs_at)}` : formatTimelineDate(e.occurs_at);
  const who = e.clinician ? (e.kind === "result" ? `ordered by ${e.clinician}` : e.kind === "session_notes" ? `written by ${e.clinician}` : e.clinician) : null;
  return [e.upcoming ? `Upcoming ${kind.toLowerCase()}` : kind, when, who, e.place].filter(Boolean).join(", ");
}

// Plain words for the patient (the portal keeps the clinical ones).
const TEXT_FIELDS: [keyof TextDetail, string][] = [
  ["reason", "Reason"],
  ["assessment", "What the doctor found"],
  ["plan", "What happens next"],
  ["follow_up", "Follow-up"],
  ["medication", "Medication"],
  ["quantity", "Quantity"],
  ["pharmacy", "Pharmacy"],
];

function textRows(e: RecordEntry, d: TextDetail): { label: string; value: string }[] {
  // A prescription shows its own fields first.
  const order: [keyof TextDetail, string][] =
    e.kind === "prescription" ? [...TEXT_FIELDS.slice(4), ...TEXT_FIELDS.slice(0, 4)] : TEXT_FIELDS;
  return order
    .filter(([key]) => d[key])
    .map(([key, label]) => ({
      label: e.kind === "session_notes" && key === "reason" ? "Chief complaint" : label,
      value: d[key] as string,
    }));
}

function EntryDetail({ entry }: { entry: RecordEntry }) {
  const router = useRouter();
  const d = entry.detail;
  const rows = d?.kind === "text" ? textRows(entry, d) : [];
  const editable = entry.source === "patient" && entry.kind !== "session_notes";
  // Session notes keep their text in the detail; their body repeats it.
  const body = entry.kind !== "session_notes" && entry.body ? entry.body : null;
  const empty = rows.length === 0 && !body && d?.kind !== "result";

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-3.5">
      <p className="-mt-1.5 text-body text-ink-2">{caption(entry)}</p>

      {d?.kind === "result" &&
        (d.results.length > 0 ? (
          <Card as="ul" aria-label="Results">
            {d.results.map((r) => (
              <li key={r.id} className="py-3">
                <Result r={r} />
              </li>
            ))}
          </Card>
        ) : (
          <p className="text-body text-ink-2">
            No results recorded yet.
            {editable && (
              <>
                {" "}
                <Link href={`/record/${entry.id}/edit`} className="font-semibold text-accent underline underline-offset-2">
                  Add results
                </Link>
              </>
            )}
          </p>
        ))}

      {(rows.length > 0 || body) && (
        <DetailList rows={[...rows, ...(body ? [{ label: entry.kind === "note" ? "Note" : "Notes", value: body }] : [])]} />
      )}

      {empty && <p className="text-body text-ink-2">Nothing else recorded{entry.upcoming ? " yet" : ""}.</p>}

      {entry.kind === "note" && <Notice tone="neutral">{PERSONAL_NOTE_LINE}</Notice>}
      {entry.kind === "session_notes" ? (
        <MentalHealthToggle entry={entry} />
      ) : (
        entry.is_mental_health && (
          <Notice tone="neutral">{MENTAL_HEALTH_LINE}</Notice>
        )
      )}

      {/* Entries the patient wrote are deleted from their Edit form, as everything else is.
          A doctor's session notes have no form, so theirs stays here. */}
      {entry.kind === "session_notes" && (
        <DeleteWithConfirm
          label="Delete these notes"
          title="Delete these notes?"
          body="They will be removed from your record. You can't undo this."
          onConfirm={async () => {
            const { error } = await createClient().from("entries").delete().eq("id", entry.id);
            if (error) return false;
            router.replace("/record");
            return true;
          }}
        />
      )}
    </div>
  );
}

/** A result with a range gets the range bar and its flag in words; one without shows its value. */
function Result({ r }: { r: ResultValue }) {
  if (r.ref_low !== null && r.ref_high !== null) {
    return <ResultRow name={r.name} value={r.value} unit={r.unit ?? ""} low={r.ref_low} high={r.ref_high} />;
  }
  const flag = r.flag;
  return (
    <span className="flex flex-col">
      <span className="text-row font-medium">{r.name}</span>
      <span className={flag ? "text-caption font-semibold text-urgent" : "text-caption text-ink-2"}>
        {`${r.value} ${r.unit ?? ""}`.trim()}
        {flag && `, ${flag}`}
      </span>
    </span>
  );
}

function MentalHealthToggle({ entry }: { entry: RecordEntry }) {
  const [on, setOn] = useState(entry.is_mental_health);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <SwitchRow
        surface="tile"
        title="About mental health"
        description={MENTAL_HEALTH_LINE}
        checked={on}
        onCheckedChange={async (next) => {
          setOn(next);
          setFailed(false);
          const { error } = await createClient().from("entries").update({ is_mental_health: next }).eq("id", entry.id);
          if (error) {
            setOn(!next);
            setFailed(true);
          }
        }}
      />
      {failed && (
        <Notice tone="critical" live="assertive">
          This couldn&apos;t be saved. Check your connection and try again.
        </Notice>
      )}
    </div>
  );
}

export default function EntryDetailPage() {
  return (
    <SessionReady>
      <EntryDetailScreen />
    </SessionReady>
  );
}
