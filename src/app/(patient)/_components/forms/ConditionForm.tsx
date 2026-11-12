"use client";

import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { CONDITION_STATUS_OPTIONS } from "@/lib/patient/options";
import { orNull, type Condition } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MentalHealthSwitch, saveFailedMessage, type FieldErrors } from "./FormBits";

/** Add or edit a condition (no Figma frame; PLAN.md section 8, item 3). */
export function ConditionForm({
  formId,
  condition,
  onSaving,
  onSaved,
}: {
  formId: string;
  condition?: Condition;
  onSaving: (busy: boolean) => void;
  onSaved: (href: string) => void;
}) {
  const [name, setName] = useState(condition?.name ?? "");
  const [status, setStatus] = useState(condition?.status ?? "ongoing");
  const [clinician, setClinician] = useState(condition?.clinician ?? "");
  const [specialty, setSpecialty] = useState(condition?.specialty ?? "");
  // One field for one fact (A46): a year goes to diagnosed_year, words ("childhood") to diagnosed_note.
  const [since, setSince] = useState(
    condition?.diagnosed_year ? String(condition.diagnosed_year) : (condition?.diagnosed_note ?? "").replace(/^since\s+/i, ""),
  );
  const [mental, setMental] = useState(condition?.is_mental_health ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { name: `${formId}-name`, since: `${formId}-since` };
  const thisYear = new Date().getFullYear();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = since.trim();
    const isYear = /^\d{4}$/.test(text);
    const y = isYear ? Number(text) : null;
    const next: FieldErrors = {
      name: name.trim() ? undefined : "Enter the condition's name.",
      since:
        /^\d+$/.test(text) && !(y !== null && y >= 1900 && y <= thisYear)
          ? `Enter a year between 1900 and ${thisYear}, or words like childhood.`
          : undefined,
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
      diagnosed_note: isYear || !text ? null : `since ${text.replace(/^since\s+/i, "")}`,
      is_mental_health: mental,
    };
    const supabase = createClient();
    const result = condition
      ? await supabase.from("conditions").update(row).eq("id", condition.id).select("id").single()
      : await supabase.from("conditions").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(result.error));
      return;
    }
    onSaved(condition ? `/record/conditions/${condition.id}` : "/record?tab=conditions");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField
        id={ids.name}
        label="Condition"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        error={errors.name}
      />
      <SelectField label="Status" options={CONDITION_STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
      <TextField
        label="Doctor"
        optional
        value={clinician}
        onChange={(e) => setClinician(e.target.value)}
        maxLength={200}
      />
      <TextField
        label="Specialty"
        optional
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        maxLength={200}
      />
      <TextField
        id={ids.since}
        label="Since when"
        optional
        value={since}
        onChange={(e) => setSince(e.target.value)}
        hint="A year, like 2019, or words, like childhood."
        maxLength={190}
        error={errors.since}
      />
      <MentalHealthSwitch checked={mental} onChange={setMental} />
    </FormFrame>
  );
}
