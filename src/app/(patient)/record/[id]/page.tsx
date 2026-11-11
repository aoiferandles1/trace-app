"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ENTRY_KINDS } from "@/components/patient/TimelineItem";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HintStrip } from "@/components/ui/HintStrip";
import { Pill } from "@/components/ui/Pill";
import { SwitchRow } from "@/components/ui/Switch";
import { formatLongDateTime } from "@/lib/dates";
import { isUuid, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DetailList, NotFound } from "../../_components/DetailList";
import { DeleteWithConfirm } from "../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../_components/Screens";

const NOTE_FIELDS = [
  ["chief_complaint", "Chief complaint"],
  ["assessment", "Assessment"],
  ["plan", "Plan"],
  ["follow_up", "Follow-up"],
] as const;

/**
 * Entry detail (no Figma frame; PLAN.md section 8, item 4): one timeline
 * entry with Edit and Delete. Session notes from a doctor are read-only apart
 * from their mental health flag (the database enforces this), so they get
 * that switch instead of Edit. This is also the session notes view the next
 * phase links to from the ended screen.
 */
function EntryDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("entries").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Entry | null;
  }, [id]);

  const entry = data.status === "ready" ? data.data : null;
  const kind = entry ? ENTRY_KINDS[entry.kind] : null;

  return (
    <SubScreen title={kind?.label ?? "Entry"} backHref="/record" backLabel="Back to Record">
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !entry || !kind ? (
        <NotFound what="entry" />
      ) : (
        <div className="flex flex-col gap-5 px-4 pb-8 pt-2">
          <Card padding="lg" className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone={kind.tone} size="md">
                {kind.label}
              </Pill>
              {entry.occurs_at > new Date().toISOString() && (
                <Pill tone="neutral" size="md">
                  Upcoming
                </Pill>
              )}
            </div>
            <h2 className="text-h3 font-medium">{entry.title}</h2>
            <DetailList
              rows={[
                { label: "When", value: formatLongDateTime(entry.occurs_at) },
                ...(entry.clinician ? [{ label: entry.kind === "session_notes" ? "Written by" : "Doctor", value: entry.clinician }] : []),
                ...(entry.place ? [{ label: "Where", value: entry.place }] : []),
                ...(entry.kind === "session_notes" ? sessionNoteRows(entry) : entry.body ? [{ label: entry.kind === "note" ? "Note" : "Notes", value: entry.body }] : []),
              ]}
            />
          </Card>
          {entry.kind === "note" && (
            <HintStrip tone="neutral">Personal note. Only you can see it; it is never shared with a doctor.</HintStrip>
          )}
          {entry.kind === "session_notes" ? (
            <MentalHealthToggle entry={entry} />
          ) : (
            entry.is_mental_health && (
              <HintStrip tone="indigo">About mental health. Left out of a share unless you include mental health.</HintStrip>
            )
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {entry.kind !== "session_notes" && (
              <ButtonLink href={`/record/${entry.id}/edit`} variant="secondary" iconLeft={<Pencil aria-hidden="true" className="size-4" />}>
                Edit
              </ButtonLink>
            )}
            <DeleteWithConfirm
              label="Delete entry"
              title="Delete this entry?"
              body="It will be removed from your record. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("entries").delete().eq("id", entry.id);
                if (error) return false;
                router.replace("/record");
                return true;
              }}
            />
          </div>
        </div>
      )}
    </SubScreen>
  );
}

function sessionNoteRows(entry: Entry) {
  const detail = (entry.detail ?? {}) as Record<string, string | null>;
  const rows = NOTE_FIELDS.filter(([key]) => detail[key]).map(([key, label]) => ({ label, value: detail[key] as string }));
  if (rows.length === 0 && entry.body) return [{ label: "Notes", value: entry.body }];
  return rows;
}

function MentalHealthToggle({ entry }: { entry: Entry }) {
  const [on, setOn] = useState(entry.is_mental_health);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <SwitchRow
        surface="sunken"
        title="About mental health"
        description="Kept out of every share unless you include mental health for that share."
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
        <HintStrip tone="danger" live="assertive">
          This couldn&apos;t be saved. Check your connection and try again.
        </HintStrip>
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
