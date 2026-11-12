"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { SwitchRow } from "@/components/ui/Switch";
import { TextArea } from "@/components/ui/TextArea";
import { formatRange, type MedicationPeriod } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import { FormFrame, SaveButton, saveFailedMessage, useFormScreen, type FormControl } from "../../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";
import { loadMedication } from "../../_components/loadMedication";

/**
 * A strength period's note (BRIEF.md 5.11; no board): the patient's own
 * "how it felt", and whether doctors may see it (`note_shared`). Only these
 * two can change on a period. A note added where there was none starts
 * shared (owner's decision, 11 Nov 2026); an existing note keeps its setting.
 */
function NoteScreen() {
  const { id, periodId } = useParams<{ id: string; periodId: string }>();
  const data = useLoad(async () => {
    const m = await loadMedication(id);
    const p = m?.periods.find((x) => x.id === periodId) ?? null;
    return m && p ? { name: m.name, period: p } : null;
  }, [id, periodId]);
  const found = data.status === "ready" ? data.data : null;
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title={found?.period.note ? "Edit note" : "Add a note"}
      backHref={`/meds/${id}`}
      backLabel={found ? `Back to ${found.name}` : "Back"}
      footer={found ? <SaveButton form={formId} busy={busy}>Save note</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !found ? (
        <NotFound what="note" />
      ) : (
        <NoteForm
          // Next.js may keep this screen in memory: start again from the saved note.
          key={`${formKey}:${found.period.id}:${found.period.note}:${found.period.note_shared}`}
          {...control}
          medicationId={id}
          name={found.name}
          period={found.period}
        />
      )}
    </SubScreen>
  );
}

function NoteForm({
  formId,
  medicationId,
  name,
  period: p,
  onSaving,
  onSaved,
}: FormControl & {
  medicationId: string;
  name: string;
  period: MedicationPeriod;
}) {
  const [note, setNote] = useState(p.note ?? "");
  const [shared, setShared] = useState(p.note ? Boolean(p.note_shared) : true);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    onSaving(true);
    setSaveError(null);
    const text = orNull(note);
    const { error } = await createClient()
      .from("medication_periods")
      .update({ note: text, note_shared: text ? shared : false })
      .eq("id", p.id);
    if (error) {
      onSaving(false);
      setSaveError(saveFailedMessage(error));
      return;
    }
    onSaved(`/meds/${medicationId}`);
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <p className="text-body text-ink-2">
        {name} {p.strength_label}, {formatRange(p.start_date, p.end_date, p.date_precision)}
        {p.prescribed_by ? `, prescribed by ${p.prescribed_by}` : ""}.
      </p>
      <TextArea
        label="How it felt"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Steady all day. Good for work."
        hint="Leave it empty to remove the note."
        maxLength={2000}
      />
      {note.trim() && (
        <SwitchRow
          surface="tile"
          title="Share this note with doctors"
          description="A doctor sees it only when you include medication notes in a share."
          checked={shared}
          onCheckedChange={setShared}
        />
      )}
    </FormFrame>
  );
}

export default function NotePage() {
  return (
    <SessionReady>
      <NoteScreen />
    </SessionReady>
  );
}
