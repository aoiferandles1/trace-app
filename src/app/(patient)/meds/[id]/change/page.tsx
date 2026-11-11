"use client";

import { useParams, useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchRow } from "@/components/ui/Switch";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import { errorCode, formatAtPrecision, UNIT_OPTIONS, type RecordMedication } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { checkErrors, FormFrame, SAVE_FAILED, SaveButton, type FieldErrors } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";
import { loadMedication } from "../_components/loadMedication";

/**
 * Log a strength change (BRIEF.md 4.1 and 5.11; no board): a full-screen
 * form with the save button pinned at the bottom. `log_strength_change`
 * closes the current period on the date and opens the new one from it, in
 * one step; nothing earlier is overwritten. A note typed here is shared with
 * doctors unless the patient turns it off (owner's decision, 11 Nov 2026).
 */
function ChangeScreen() {
  const { id } = useParams<{ id: string }>();
  const data = useLoad(() => loadMedication(id), [id]);
  const m = data.status === "ready" ? data.data : null;
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Log a strength change"
      titleSize="md"
      backHref={`/meds/${id}`}
      backLabel={m ? `Back to ${m.name}` : "Back"}
      footer={m?.status === "current" ? <SaveButton form={formId} busy={busy}>Save change</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="medication" />
      ) : m.status !== "current" ? (
        <p className="px-5 py-6 text-body text-ink-2">{m.name} has ended, so its strength can&apos;t change.</p>
      ) : (
        <ChangeForm formId={formId} m={m} onSaving={setBusy} />
      )}
    </SubScreen>
  );
}

function ChangeForm({ formId, m, onSaving }: { formId: string; m: RecordMedication; onSaving: (b: boolean) => void }) {
  const router = useRouter();
  const current = m.periods.find((p) => p.end_date === null) ?? null;
  const [strength, setStrength] = useState("");
  const [unit, setUnit] = useState(m.unit ?? "mg");
  const [day, setDay] = useState(dayKey());
  const [by, setBy] = useState(current?.prescribed_by ?? m.prescriber ?? "");
  const [note, setNote] = useState("");
  const [shareNote, setShareNote] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { strength: `${formId}-strength`, day: `${formId}-day` };
  const today = dayKey();
  const shownUnit = m.unit ?? unit;
  const since = current ? formatAtPrecision(current.start_date, "day") : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = Number(strength.replace(",", "."));
    const next: FieldErrors = {
      strength:
        !strength.trim() || !Number.isFinite(value) || value <= 0
          ? `Enter the new strength in ${shownUnit}, like 36.`
          : current && value === current.strength
            ? `That's the strength you take now (${current.strength_label}).`
            : undefined,
      day: !/^\d{4}-\d{2}-\d{2}$/.test(day)
        ? "Enter the date the strength changed."
        : day > today
          ? "The date can't be in the future."
          : current && day <= current.start_date
            ? `Pick a date after ${since}, when the current strength started.`
            : undefined,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { error } = await createClient().rpc("log_strength_change", {
      medication_id: m.id,
      strength: value,
      changed_on: day,
      prescribed_by: orNull(by) ?? undefined,
      note: orNull(note) ?? undefined,
      note_shared: Boolean(orNull(note)) && shareNote,
      ...(m.unit ? {} : { unit }),
    });
    if (error) {
      onSaving(false);
      const code = errorCode(error);
      if (code === "same_strength") setErrors({ strength: "That's the strength you take now." });
      else if (code === "invalid_date") setErrors({ day: "Pick a date after the current strength started, and not in the future." });
      else if (code === "invalid_strength") setErrors({ strength: "Enter a strength above 0." });
      else setSaveError(code === "medication_not_current" ? `${m.name} has ended, so its strength can't change.` : SAVE_FAILED);
      return;
    }
    router.push(`/meds/${m.id}`);
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <p className="text-body text-ink-2">
        {current
          ? `${m.name} ${current.strength_label} ends on the date you pick, and the new strength starts the same day. Earlier strengths stay in your history.`
          : `Add the strength you take now. It starts on the date you pick.`}
      </p>
      <div className={m.unit ? undefined : "grid grid-cols-2 gap-3"}>
        <TextField
          id={ids.strength}
          label={m.unit ? `New strength (${m.unit})` : "New strength"}
          inputMode="decimal"
          value={strength}
          onChange={(e) => setStrength(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder={current ? `e.g. ${current.strength}` : "e.g. 36"}
          error={errors.strength}
        />
        {!m.unit && <SelectField label="Unit" options={UNIT_OPTIONS} value={unit} onChange={(e) => setUnit(e.target.value)} />}
      </div>
      <TextField
        id={ids.day}
        label="Date of the change"
        type="date"
        max={today}
        value={day}
        onChange={(e) => setDay(e.target.value)}
        error={errors.day}
      />
      <TextField label="Prescribed by" optional value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Dr Hennessy" maxLength={200} />
      <TextArea
        label="How it feels"
        optional
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Steadier through the afternoon."
        hint="Your own note. You can add or change it later."
        maxLength={2000}
      />
      {note.trim() && (
        <SwitchRow
          surface="tile"
          title="Share this note with doctors"
          description="A doctor sees it only when you include medication notes in a share."
          checked={shareNote}
          onCheckedChange={setShareNote}
        />
      )}
      {!current && m.periods.length === 0 && (
        <Notice tone="neutral">Trace couldn&apos;t read a strength for {m.name} yet, so this becomes its first.</Notice>
      )}
    </FormFrame>
  );
}

export default function ChangePage() {
  return (
    <SessionReady>
      <ChangeScreen />
    </SessionReady>
  );
}
