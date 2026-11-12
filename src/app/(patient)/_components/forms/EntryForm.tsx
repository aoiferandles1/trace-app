"use client";

import { useState, type FormEvent } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { EntryKind } from "@/components/patient/TimelineItem";
import { dayKey, dublinToIso, timeKey } from "@/lib/dates";
import { orNull, PATIENT_ENTRY_KINDS, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import {
  checkErrors,
  FormFrame,
  MentalHealthSwitch,
  MoreDetails,
  PERSONAL_NOTE_LINE,
  saveFailedMessage,
  type FieldErrors,
  type FormControl,
} from "./FormBits";

/** One result as the form holds it (result_values, supabase/README.md section 2). */
export type ResultInput = {
  id?: string;
  name: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
};

type ResultRow = { key: string; id?: string; name: string; value: string; unit: string; low: string; high: string };

let keySeq = 0;
const newKey = () => `result-${++keySeq}`;
const emptyRow = (): ResultRow => ({ key: newKey(), name: "", value: "", unit: "", low: "", high: "" });

/** "2.5" or "2,5" as a number; null for empty; NaN for anything else. */
function num(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Example titles by kind, for the title's error line. */
const TITLE_EXAMPLE: Record<string, string> = {
  visit: "GP visit",
  result: "Blood test",
  prescription: "Repeat prescription",
  letter: "Referral letter",
  imaging: "Chest X-ray",
};

/**
 * Add or edit an entry. No board (PLAN.md section 8):
 * - `variant="note"`: Log a note (kind `note`, never shared with a doctor).
 * - `variant="appointment"`: Add a visit. Defaults to a visit, and also
 *   takes results (with their values), prescriptions, letters and scans,
 *   so a whole record can be entered by hand.
 *
 * Essentials first; the rest is under "More details" (B8). Only a visit
 * asks for a time (the others are stored at midday, Irish time). A test
 * result has rows of values, not the visit's reason and plan. Session notes
 * written by a doctor are not edited here.
 */
export function EntryForm({
  formId,
  variant,
  entry,
  results,
  onSaving,
  onSaved,
}: FormControl & {
  variant: "note" | "appointment";
  entry?: Entry;
  /** The entry's result values, when editing a test result. */
  results?: ResultInput[];
}) {
  const now = new Date();
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? (variant === "note" ? "note" : "visit"));
  const [title, setTitle] = useState(entry?.title ?? "");
  const [day, setDay] = useState(entry ? dayKey(entry.occurs_at) : dayKey(now));
  const [time, setTime] = useState(entry ? timeKey(entry.occurs_at) : "");
  const [clinician, setClinician] = useState(entry?.clinician ?? "");
  const [place, setPlace] = useState(entry?.place ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [mental, setMental] = useState(entry?.is_mental_health ?? false);
  const [reason, setReason] = useState(entry?.reason ?? "");
  const [assessment, setAssessment] = useState(entry?.assessment ?? "");
  const [plan, setPlan] = useState(entry?.plan ?? "");
  const [rxMedication, setRxMedication] = useState(entry?.rx_medication ?? "");
  const [rxQuantity, setRxQuantity] = useState(entry?.rx_quantity ?? "");
  const [rxPharmacy, setRxPharmacy] = useState(entry?.rx_pharmacy ?? "");
  const [rows, setRows] = useState<ResultRow[]>(() =>
    results && results.length > 0
      ? results.map((r) => ({
          key: r.id ?? newKey(),
          id: r.id,
          name: r.name,
          value: String(r.value),
          unit: r.unit ?? "",
          low: r.ref_low === null ? "" : String(r.ref_low),
          high: r.ref_high === null ? "" : String(r.ref_high),
        }))
      : [emptyRow()],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const isNote = variant === "note";
  const isVisit = kind === "visit";
  const isResult = kind === "result";
  const ids: Record<string, string> = { title: `${formId}-title`, day: `${formId}-day`, time: `${formId}-time`, body: `${formId}-body` };
  const moreOpen = Boolean(entry && (reason || assessment || plan || body || mental));

  function setRow(key: string, patch: Partial<ResultRow>) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      title: title.trim()
        ? undefined
        : isNote
          ? "Give the note a title."
          : `Give it a title, like ${TITLE_EXAMPLE[kind] ?? "GP visit"}.`,
      day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? undefined : "Enter a date, like 14/01/2026.",
      time: !isVisit || /^\d{2}:\d{2}$/.test(time) ? undefined : "Enter the time of the visit, like 09:30.",
      body: isNote && !body.trim() ? "Write the note." : undefined,
    };
    const filled = isResult ? rows.filter((r) => r.name.trim() || r.value.trim()) : [];
    filled.forEach((r) => {
      const v = num(r.value);
      const lo = num(r.low);
      const hi = num(r.high);
      if (!r.name.trim()) {
        next[`name-${r.key}`] = "Say what was tested, like Haemoglobin.";
        ids[`name-${r.key}`] = `${formId}-name-${r.key}`;
      }
      if (v === null || Number.isNaN(v)) {
        next[`value-${r.key}`] = "Enter the result as a number, like 128.";
        ids[`value-${r.key}`] = `${formId}-value-${r.key}`;
      }
      if (Number.isNaN(lo) || Number.isNaN(hi) || (lo !== null && hi !== null && lo > hi)) {
        next[`range-${r.key}`] = "Enter the normal range as two numbers, low then high, or leave it empty.";
        ids[`range-${r.key}`] = `${formId}-low-${r.key}`;
      }
    });
    setErrors(next);
    if (!checkErrors(next, ids)) return;

    onSaving(true);
    setSaveError(null);
    // Only a visit has a time of its own; a note keeps the time it was written.
    const at = isVisit ? time : entry ? timeKey(entry.occurs_at) : isNote && day === dayKey(now) ? timeKey(now) : "12:00";
    const row = {
      kind,
      title: title.trim(),
      occurs_at: dublinToIso(day, at),
      clinician: isNote ? null : orNull(clinician),
      place: isNote ? null : orNull(place),
      body: orNull(body),
      is_mental_health: mental,
      reason: isNote || isResult ? null : orNull(reason),
      assessment: isNote || isResult ? null : orNull(assessment),
      plan: isNote || isResult ? null : orNull(plan),
      rx_medication: kind === "prescription" ? orNull(rxMedication) : null,
      rx_quantity: kind === "prescription" ? orNull(rxQuantity) : null,
      rx_pharmacy: kind === "prescription" ? orNull(rxPharmacy) : null,
    };
    const supabase = createClient();
    const result = entry
      ? await supabase.from("entries").update(row).eq("id", entry.id).select("id").single()
      : await supabase.from("entries").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(result.error));
      return;
    }
    const entryId = result.data.id;
    const keep = isResult ? filled : [];
    const removed = (results ?? []).filter((r) => r.id && !keep.some((k) => k.id === r.id)).map((r) => r.id!);
    const writes = await Promise.all([
      removed.length ? supabase.from("result_values").delete().in("id", removed) : null,
      ...keep.map((r, position) => {
        const values = {
          name: r.name.trim(),
          value: num(r.value)!,
          unit: orNull(r.unit),
          ref_low: num(r.low),
          ref_high: num(r.high),
          position,
        };
        return r.id
          ? supabase.from("result_values").update(values).eq("id", r.id)
          : supabase.from("result_values").insert({ ...values, entry_id: entryId });
      }),
    ]);
    const failed = writes.find((w) => w?.error);
    if (failed) {
      onSaving(false);
      setSaveError(saveFailedMessage(failed.error));
      return;
    }
    onSaved(entry ? `/record/${entry.id}` : "/record");
  }

  const notes = (
    <TextArea
      id={ids.body}
      label={isNote ? "Note" : "Notes"}
      optional={!isNote}
      value={body}
      onChange={(e) => setBody(e.target.value)}
      hint={isNote ? PERSONAL_NOTE_LINE : undefined}
      maxLength={20000}
      error={errors.body}
    />
  );

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
        placeholder={isNote ? undefined : `e.g. ${TITLE_EXAMPLE[kind] ?? "GP visit"}`}
        maxLength={300}
        error={errors.title}
      />
      {isVisit ? (
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
          <TextField id={ids.day} label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} />
          <TextField id={ids.time} label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} error={errors.time} />
        </div>
      ) : (
        <TextField id={ids.day} label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} />
      )}

      {isNote ? (
        <>
          {notes}
          <MentalHealthSwitch checked={mental} onChange={setMental} />
        </>
      ) : (
        <>
          <TextField
            label={isResult ? "Ordered by" : "Doctor or clinician"}
            optional
            value={clinician}
            onChange={(e) => setClinician(e.target.value)}
            maxLength={200}
          />
          <TextField label="Where" optional value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} />

          {kind === "prescription" && (
            <>
              <TextField
                label="Medicine and strength"
                optional
                value={rxMedication}
                onChange={(e) => setRxMedication(e.target.value)}
                maxLength={300}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Quantity" optional value={rxQuantity} onChange={(e) => setRxQuantity(e.target.value)} maxLength={100} />
                <TextField label="Pharmacy" optional value={rxPharmacy} onChange={(e) => setRxPharmacy(e.target.value)} maxLength={200} />
              </div>
            </>
          )}

          {isResult && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-label font-medium">Results</legend>
              {rows.length === 0 && <p className="text-caption text-ink-2">None added.</p>}
              {rows.map((r, i) => (
                <div key={r.key} className="flex flex-col gap-3 rounded-tile border border-border-card bg-surface p-4">
                  <TextField
                    id={`${formId}-name-${r.key}`}
                    label={`Test ${i + 1}`}
                    value={r.name}
                    onChange={(e) => setRow(r.key, { name: e.target.value })}
                    maxLength={200}
                    error={errors[`name-${r.key}`]}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      id={`${formId}-value-${r.key}`}
                      label="Result"
                      inputMode="decimal"
                      value={r.value}
                      onChange={(e) => setRow(r.key, { value: e.target.value })}
                      error={errors[`value-${r.key}`]}
                    />
                    <TextField label="Unit" optional value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value })} maxLength={40} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      id={`${formId}-low-${r.key}`}
                      label="Normal from"
                      optional
                      inputMode="decimal"
                      value={r.low}
                      onChange={(e) => setRow(r.key, { low: e.target.value })}
                      error={errors[`range-${r.key}`]}
                    />
                    <TextField
                      label="Normal to"
                      optional
                      inputMode="decimal"
                      value={r.high}
                      onChange={(e) => setRow(r.key, { high: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-fit"
                    onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                    aria-label={`Remove test ${i + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <AddLink onClick={() => setRows((all) => [...all, emptyRow()])} height={44}>
                Add a result
              </AddLink>
            </fieldset>
          )}

          <MoreDetails initiallyOpen={moreOpen}>
            {!isResult && (
              <>
                <TextArea label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
                <TextArea
                  label="What the doctor found"
                  optional
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  maxLength={5000}
                />
                <TextArea label="What happens next" optional value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={5000} />
              </>
            )}
            {notes}
            <MentalHealthSwitch checked={mental} onChange={setMental} />
          </MoreDetails>
        </>
      )}
    </FormFrame>
  );
}
