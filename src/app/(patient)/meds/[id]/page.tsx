"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { SessionReady } from "@/components/patient/PatientSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { StepChart } from "@/components/ui/StepChart";
import { TickIndicator } from "@/components/ui/Toggle";
import { addDays, dayKey, daysUntil } from "@/lib/dates";
import {
  capitalise,
  errorCode,
  formatAtPrecision,
  formatRange,
  medicationNowLine,
  type MedicationPeriod,
  type RecordMedication,
  URGENT_REFILL_DAYS,
} from "@/lib/patient/record";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DetailList, NotFound } from "../../_components/DetailList";
import { LoadStatus, SubScreen } from "../../_components/Screens";
import { MedsPanel } from "../_components/MedsPanel";
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
      aside={<MedsPanel level={2} initialTab={fromPast ? "past" : "current"} current={id} syncUrl={false} />}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="medication" />
      ) : (
        <MedDetail m={m} reload={data.reload} />
      )}
    </SubScreen>
  );
}

function MedDetail({ m, reload }: { m: RecordMedication; reload: () => void }) {
  const now = medicationNowLine(m);
  const unit = m.unit ?? "";
  const oldestFirst = [...m.periods].reverse();
  const details = detailRows(m);
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
      {now && <p className="-mt-1.5 text-body text-ink-2">{now}</p>}
      {m.status === "current" && <RefillLine key={m.refill_due_on ?? ""} m={m} onSaved={reload} />}

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
            {m.periods.map((p, i) => (
              // Keyed on the saved values, so the switch starts from them again after an edit.
              <PeriodRow
                key={`${p.id}:${p.note_shared}:${p.note}`}
                medicationId={m.id}
                period={p}
                undo={i === 0 && m.status === "current" && m.periods.length > 1 ? { previous: m.periods[1], onDone: reload } : undefined}
              />
            ))}
          </Card>
        </section>
      )}

      {m.status === "current" && (
        <AddLink href={`/meds/${m.id}/change`} height={44}>
          Log a strength change
        </AddLink>
      )}

      {details.length > 0 && (
        <section aria-labelledby={`details-${m.id}`} className="flex flex-col gap-3.5">
          <SectionHeading id={`details-${m.id}`} className="mt-1.5">
            Details
          </SectionHeading>
          <DetailList rows={details} />
        </section>
      )}
    </div>
  );
}

/** Everything else the form takes, so nothing typed is write-only (A7). */
function detailRows(m: RecordMedication): { label: string; value: string }[] {
  const often = [m.frequency && capitalise(m.frequency), m.timing].filter(Boolean).join(", ");
  const by = [m.prescriber, m.prescriber_specialty, m.prescriber_org].filter(Boolean).join(", ");
  const rows: [string, string | null][] = [
    ["How often", often || null],
    ["Form", m.form],
    ["What it's for", m.indication],
    ["Type of medicine", m.drug_class],
    ["Prescribed by", by || null],
    ["Started", m.started_on ? formatAtPrecision(m.started_on, "day") : null],
    ["Next refill due", m.status === "current" && m.refill_due_on ? formatAtPrecision(m.refill_due_on, "day") : null],
    ["Instructions", m.instructions],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, value]) => ({ label, value }));
}

/**
 * A refill due in 5 days or fewer, or overdue: says so in words, with
 * "Refilled", which asks for the next refill date (B9). Taking the refill
 * off without a date would drop it from Home without a trace.
 */
function RefillLine({ m, onSaved }: { m: RecordMedication; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = dayKey();
  const [next, setNext] = useState(addDays(today, 28));
  const [error, setError] = useState<string | undefined>();
  const fieldId = useId();
  if (!m.refill_due_on) return null;
  const days = daysUntil(m.refill_due_on);
  if (days > URGENT_REFILL_DAYS) return null;
  const text =
    days < 0
      ? `Refill overdue since ${formatAtPrecision(m.refill_due_on, "day")}`
      : days === 0
        ? "Refill due today"
        : `Refill due in ${days} ${days === 1 ? "day" : "days"}`;

  async function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next <= today) {
      setError("Pick a date after today.");
      document.getElementById(fieldId)?.focus();
      return;
    }
    setError(undefined);
    setBusy(true);
    setFailed(false);
    const { error: e } = await createClient().from("medications").update({ refill_due_on: next }).eq("id", m.id);
    setBusy(false);
    if (e) {
      setFailed(true);
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-tile bg-urgent-tint py-1 pl-3.5 pr-1.5 text-urgent">
        <p className="text-label font-semibold">{text}</p>
        <Button variant="text" size="md" className="px-2" onClick={() => setOpen(true)}>
          Refilled
        </Button>
      </div>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`${m.name} refilled`}
        actions={
          <>
            <Button size="lg" fullWidth loading={busy} onClick={save}>
              Save
            </Button>
            <Button variant="text" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <TextField
          id={fieldId}
          label="Next refill due"
          type="date"
          min={addDays(today, 1)}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={error}
        />
        {failed && (
          <Notice tone="critical" live="assertive">
            This couldn&apos;t be saved. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
    </>
  );
}

/** "36mg, Feb 2025 to now": names a period for a control's accessible name. */
function periodName(p: MedicationPeriod): string {
  return `${p.strength_label}, ${formatRange(p.start_date, p.end_date, p.date_precision)}`;
}

function PeriodRow({
  medicationId,
  period: p,
  undo,
}: {
  medicationId: string;
  period: MedicationPeriod;
  /** The newest period of a current medication: a change logged by mistake can be undone (A6). */
  undo?: { previous: MedicationPeriod; onDone: () => void };
}) {
  const [shared, setShared] = useState(Boolean(p.note_shared));
  const [failed, setFailed] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);

  async function undoChange() {
    setUndoing(true);
    setUndoFailed(false);
    const { error } = await createClient().rpc("undo_strength_change", { medication_id: medicationId });
    setUndoing(false);
    if (error && errorCode(error) !== "nothing_to_undo") {
      setUndoFailed(true);
      return;
    }
    setConfirmUndo(false);
    undo?.onDone();
  }

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
    // At least the board's 76px for the strength; a long one ("1000mcg") widens it rather than overflowing (A32).
    <li className="grid grid-cols-[minmax(76px,max-content)_1fr] gap-x-3 py-3.5">
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
        {undo && (
          <>
            <Button variant="text" size="sm" className="-mb-1 w-fit" onClick={() => setConfirmUndo(true)}>
              Undo this change
            </Button>
            <BottomSheet
              open={confirmUndo}
              onClose={() => setConfirmUndo(false)}
              title={`Undo the change to ${p.strength_label}?`}
              actions={
                <>
                  <Button size="lg" fullWidth loading={undoing} onClick={undoChange}>
                    Undo change
                  </Button>
                  <Button variant="text" onClick={() => setConfirmUndo(false)}>
                    Keep it
                  </Button>
                </>
              }
            >
              <p className="text-body text-ink-2">
                {undo.previous.strength_label} becomes the current strength again, and this entry leaves your history.
              </p>
              {undoFailed && (
                <Notice tone="critical" live="assertive">
                  This couldn&apos;t be undone. Check your connection and try again.
                </Notice>
              )}
            </BottomSheet>
          </>
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
