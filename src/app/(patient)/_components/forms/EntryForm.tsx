"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { EntryKind } from "@/components/patient/TimelineItem";
import { dayKey, dublinToIso, timeKey } from "@/lib/dates";
import { orNull, PATIENT_ENTRY_KINDS, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MentalHealthSwitch, SAVE_FAILED, type FieldErrors } from "./FormBits";

/**
 * Add or edit a timeline entry. No Figma frame (PLAN.md section 8):
 * - `variant="note"`: Write a note (kind `note`, never shared with a doctor).
 * - `variant="appointment"`: Log appointment. Defaults to a visit, and also
 *   takes results, prescriptions, letters and scans, so a whole record can be
 *   entered by hand.
 * Editing uses whichever fits the entry's kind. Session notes written by a
 * doctor are not edited here (only their mental health flag can change).
 */
export function EntryForm({
  formId,
  variant,
  entry,
  onSaving,
}: {
  formId: string;
  variant: "note" | "appointment";
  entry?: Entry;
  onSaving: (busy: boolean) => void;
}) {
  const router = useRouter();
  const now = new Date();
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? (variant === "note" ? "note" : "visit"));
  const [title, setTitle] = useState(entry?.title ?? "");
  const [day, setDay] = useState(entry ? dayKey(entry.occurs_at) : dayKey(now));
  const [time, setTime] = useState(entry ? timeKey(entry.occurs_at) : variant === "note" ? timeKey(now) : "09:00");
  const [clinician, setClinician] = useState(entry?.clinician ?? "");
  const [place, setPlace] = useState(entry?.place ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [mental, setMental] = useState(entry?.is_mental_health ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const isNote = variant === "note";
  const ids = { title: `${formId}-title`, day: `${formId}-day`, time: `${formId}-time`, body: `${formId}-body` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      title: title.trim() ? undefined : isNote ? "Give the note a title." : "Say what the appointment was for, like GP visit.",
      day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? undefined : "Enter a date, like 14/01/2026.",
      time: /^\d{2}:\d{2}$/.test(time) ? undefined : "Enter a time, like 09:30.",
      body: isNote && !body.trim() ? "Write the note." : undefined,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;

    onSaving(true);
    setSaveError(null);
    const row = {
      kind,
      title: title.trim(),
      occurs_at: dublinToIso(day, time),
      clinician: isNote ? null : orNull(clinician),
      place: isNote ? null : orNull(place),
      body: orNull(body),
      is_mental_health: mental,
    };
    const supabase = createClient();
    const result = entry
      ? await supabase.from("entries").update(row).eq("id", entry.id).select("id").single()
      : await supabase.from("entries").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(SAVE_FAILED);
      return;
    }
    router.push(entry ? `/record/${entry.id}` : "/record");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      {!isNote && (
        <SelectField
          label="What kind"
          options={PATIENT_ENTRY_KINDS}
          value={kind}
          onChange={(e) => setKind(e.target.value as EntryKind)}
        />
      )}
      <TextField
        id={ids.title}
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isNote ? "e.g. Fatigue symptoms" : "e.g. GP visit"}
        maxLength={300}
        error={errors.title}
      />
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
        <TextField id={ids.day} label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} />
        <TextField id={ids.time} label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} error={errors.time} />
      </div>
      {!isNote && (
        <>
          <TextField
            label="Doctor or clinician"
            optional
            value={clinician}
            onChange={(e) => setClinician(e.target.value)}
            placeholder="e.g. Dr Hennessy"
          />
          <TextField
            label="Where"
            optional
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Rathmines Medical Centre"
            maxLength={200}
          />
        </>
      )}
      <TextArea
        id={ids.body}
        label={isNote ? "Note" : "Notes"}
        optional={!isNote}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint={isNote ? "Only you can see personal notes. They are never shared with a doctor." : undefined}
        maxLength={20000}
        error={errors.body}
      />
      <MentalHealthSwitch checked={mental} onChange={setMental} />
    </FormFrame>
  );
}
