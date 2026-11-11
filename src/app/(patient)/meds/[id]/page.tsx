"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card, SectionHeading } from "@/components/ui/Card";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { StepChart } from "@/components/ui/StepChart";
import { TickIndicator } from "@/components/ui/Toggle";
import {
  formatAtPrecision,
  formatRange,
  medicationNowLine,
  type MedicationPeriod,
  type RecordMedication,
} from "@/lib/patient/record";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../_components/DetailList";
import { LoadStatus, SubScreen } from "../../_components/Screens";
import { loadMedication } from "./_components/loadMedication";

/**
 * Medication detail (board MedDetailA2, BRIEF.md 5.11): the name, "Now 36mg,
 * since Feb 2025", the step chart of every strength, then History, newest
 * first: the strength in Sora, the dates, who prescribed it and the
 * patient's own note.
 *
 * Not on the board, from the brief: each note can be edited, and has its own
 * "Share with doctors" switch (`note_shared`; a doctor sees a note only when
 * the share includes Medication notes and this is on). "Log a strength
 * change" adds a period and closes the last one (never overwrites); it shows
 * for current medications only (the database refuses a change to one that
 * has ended). The pencil in the header opens the edit form (edit, end,
 * delete).
 *
 * Works for any medication: one period draws a single level line.
 */
function MedDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const fromPast = useSearchParams().get("from") === "past";
  const data = useLoad(() => loadMedication(id), [id]);
  const m = data.status === "ready" ? data.data : null;

  return (
    <SubScreen
      title={m?.name ?? "Medication"}
      backHref={fromPast ? "/meds?tab=past" : "/meds"}
      backLabel="Back to Medications"
      action={m ? <IconLink href={`/meds/${m.id}/edit`} label={`Edit ${m.name}`} icon="pencil" size={32} /> : undefined}
      tabBar
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="medication" />
      ) : (
        <MedDetail m={m} />
      )}
    </SubScreen>
  );
}

function MedDetail({ m }: { m: RecordMedication }) {
  const now = medicationNowLine(m);
  const unit = m.unit ?? "";
  const oldestFirst = [...m.periods].reverse();
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
      {now && <p className="-mt-1.5 text-body text-ink-2">{now}</p>}

      {oldestFirst.length > 0 && (
        <Card padding="none" className="px-4 pb-1.5 pt-4">
          <StepChart
            unit={unit}
            caption={`${m.name} strength over time`}
            periods={oldestFirst.map((p) => ({
              value: p.strength,
              from: formatAtPrecision(p.start_date, p.date_precision),
              to: p.end_date ? formatAtPrecision(p.end_date, p.date_precision) : "now",
            }))}
          />
        </Card>
      )}

      {m.periods.length > 0 && (
        <section aria-labelledby={`history-${m.id}`} className="flex flex-col gap-3.5">
          <SectionHeading id={`history-${m.id}`} className="mt-1.5">
            History
          </SectionHeading>
          <Card as="ol" padding="none" divided className="px-4.5 py-1">
            {m.periods.map((p) => (
              // Keyed on the saved values, so the switch starts from them again after an edit.
              <PeriodRow key={`${p.id}:${p.note_shared}:${p.note}`} medicationId={m.id} period={p} />
            ))}
          </Card>
        </section>
      )}

      {m.status === "current" && (
        <AddLink href={`/meds/${m.id}/change`} height={44}>
          Log a strength change
        </AddLink>
      )}
    </div>
  );
}

/** "36mg, Feb 2025 to now": names a period for a control's accessible name. */
function periodName(p: MedicationPeriod): string {
  return `${p.strength_label}, ${formatRange(p.start_date, p.end_date, p.date_precision)}`;
}

function PeriodRow({ medicationId, period: p }: { medicationId: string; period: MedicationPeriod }) {
  const [shared, setShared] = useState(Boolean(p.note_shared));
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !shared;
    setShared(next);
    setFailed(false);
    const { error } = await createClient().from("medication_periods").update({ note_shared: next }).eq("id", p.id);
    if (error) {
      setShared(!next);
      setFailed(true);
    }
  }

  return (
    <li className="grid grid-cols-[76px_1fr] gap-x-3 py-3.5">
      <span className="font-display text-title-sm font-light">{p.strength_label}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-label font-medium">{formatRange(p.start_date, p.end_date, p.date_precision)}</span>
        {p.prescribed_by && <span className="text-meta text-ink-2">Prescribed by {p.prescribed_by}</span>}
        {p.note && <p className="mt-1 whitespace-pre-wrap break-words text-body">{p.note}</p>}
        <div className="-mb-2 mt-0.5 flex flex-wrap items-center justify-between gap-x-3">
          <Link
            href={`/meds/${medicationId}/notes/${p.id}`}
            aria-label={`${p.note ? "Edit note" : "Add a note"}, ${periodName(p)}`}
            title={p.note ? "Edit note" : undefined}
            className="flex min-h-11 items-center text-caption font-semibold text-accent transition-colors duration-150 ease-out hovered:text-accent-alt"
          >
            {p.note ? "Edit" : "Add a note"}
          </Link>
          {p.note && (
            <button
              type="button"
              role="switch"
              aria-checked={shared}
              aria-label={`Share with doctors, ${periodName(p)}`}
              onClick={toggle}
              className="-mr-1 flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full pl-1 pr-1 text-caption text-ink-2"
            >
              Share with doctors
              <TickIndicator checked={shared} size={20} />
            </button>
          )}
        </div>
        {failed && (
          <Notice tone="critical" live="assertive">
            This couldn&apos;t be saved. Check your connection and try again.
          </Notice>
        )}
      </div>
    </li>
  );
}

export default function MedDetailPage() {
  return (
    <SessionReady>
      <MedDetailScreen />
    </SessionReady>
  );
}
