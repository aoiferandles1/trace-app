"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { CONDITION_STATUS_OPTIONS } from "@/lib/patient/options";
import { orNull, type Condition } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MentalHealthSwitch, SAVE_FAILED, type FieldErrors } from "./FormBits";

/** Add or edit a condition (no Figma frame; PLAN.md section 8, item 3). */
export function ConditionForm({
  formId,
  condition,
  onSaving,
}: {
  formId: string;
  condition?: Condition;
  onSaving: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(condition?.name ?? "");
  const [status, setStatus] = useState(condition?.status ?? "ongoing");
  const [clinician, setClinician] = useState(condition?.clinician ?? "");
  const [specialty, setSpecialty] = useState(condition?.specialty ?? "");
  const [year, setYear] = useState(condition?.diagnosed_year ? String(condition.diagnosed_year) : "");
  const [note, setNote] = useState(condition?.diagnosed_note ?? "");
  const [mental, setMental] = useState(condition?.is_mental_health ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { name: `${formId}-name`, year: `${formId}-year` };
  const thisYear = new Date().getFullYear();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const y = year.trim() ? Number(year) : null;
    const next: FieldErrors = {
      name: name.trim() ? undefined : "Enter the condition's name.",
      year: y === null || (Number.isInteger(y) && y >= 1900 && y <= thisYear) ? undefined : `Enter a year between 1900 and ${thisYear}.`,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const row = {
      name: name.trim(),
      status,
      clinician: orNull(clinician),
      specialty: orNull(specialty),
      diagnosed_year: y,
      diagnosed_note: orNull(note),
      is_mental_health: mental,
    };
    const supabase = createClient();
    const result = condition
      ? await supabase.from("conditions").update(row).eq("id", condition.id).select("id").single()
      : await supabase.from("conditions").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(SAVE_FAILED);
      return;
    }
    router.push(condition ? `/record/conditions/${condition.id}` : "/record?tab=conditions");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField
        id={ids.name}
        label="Condition"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Atrial fibrillation"
        maxLength={200}
        error={errors.name}
      />
      <SelectField label="Status" options={CONDITION_STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
      <TextField
        label="Doctor"
        optional
        value={clinician}
        onChange={(e) => setClinician(e.target.value)}
        placeholder="e.g. Dr O'Mahony"
      />
      <TextField
        label="Specialty"
        optional
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        placeholder="e.g. Cardiology"
        maxLength={200}
      />
      <TextField
        id={ids.year}
        label="Year diagnosed"
        optional
        inputMode="numeric"
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="e.g. 2019"
        error={errors.year}
      />
      <TextField
        label="Or when it started"
        optional
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. since childhood"
        hint="Shown when there is no year."
        maxLength={200}
      />
      <MentalHealthSwitch checked={mental} onChange={setMental} />
    </FormFrame>
  );
}
