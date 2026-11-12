"use client";

import { useState, type FormEvent } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import type { HealthEvent } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MentalHealthSwitch, saveFailedMessage, type FieldErrors } from "./FormBits";

const KIND_OPTIONS = [
  { value: "infection", label: "Infection" },
  { value: "condition", label: "Condition" },
];

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

const OUTCOME_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "resolved", label: "Resolved" },
  { value: "settled", label: "Settled" },
  { value: "ongoing", label: "Ongoing" },
  { value: "seasonal", label: "Seasonal" },
  { value: "managed", label: "Managed" },
];

type RxRow = { key: string; id?: string; name: string; detail: string };

let keySeq = 0;
const newKey = () => `rx-${++keySeq}`;

/**
 * Add or edit a full timeline event (BRIEF.md 4.2; no board, so section 7: a
 * full-screen form with the save button pinned at the bottom). The month is
 * stored as the first of the month at month precision, as the boards show
 * it ("Aug 2026"). Prescriptions are lines of free text ("Doxycycline
 * 100mg" / "7 days, from 2 Aug"); removing one deletes it, and lines that
 * stay keep any link to a medication.
 */
export function EventForm({
  formId,
  event,
  onSaving,
  onSaved,
}: {
  formId: string;
  event?: HealthEvent;
  onSaving: (busy: boolean) => void;
  onSaved: (href: string) => void;
}) {
  const e = event;
  const [kind, setKind] = useState<string>(e?.kind ?? "infection");
  const [title, setTitle] = useState(e?.title ?? "");
  // Month and year as two fields: <input type="month"> is plain text in desktop Safari and Firefox (A50).
  const [monthNo, setMonthNo] = useState(e ? e.occurred_on.slice(5, 7) : dayKey().slice(5, 7));
  const [year, setYear] = useState(e ? e.occurred_on.slice(0, 4) : dayKey().slice(0, 4));
  const [clinician, setClinician] = useState(e?.clinician ?? "");
  const [place, setPlace] = useState(e?.place ?? "");
  const [outcome, setOutcome] = useState<string>(e?.outcome ?? "");
  const [notes, setNotes] = useState(e?.notes ?? "");
  const [mental, setMental] = useState(e?.is_mental_health ?? false);
  const [rx, setRx] = useState<RxRow[]>(
    e?.prescriptions.map((p) => ({ key: p.id, id: p.id, name: p.name, detail: p.detail ?? "" })) ?? [],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { title: `${formId}-title`, month: `${formId}-month`, year: `${formId}-year` };
  const thisMonth = dayKey().slice(0, 7);

  function setRow(key: string, patch: Partial<RxRow>) {
    setRx((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const month = `${year}-${monthNo}`;
    const y = Number(year);
    const next: FieldErrors = {
      title: title.trim() ? undefined : "Say what it was, like Chest infection.",
      year: !/^\d{4}$/.test(year) || y < 1900 ? "Enter the year, like 2026." : month > thisMonth ? "Pick this month or an earlier one." : undefined,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const row = {
      kind,
      title: title.trim(),
      occurred_on: `${month}-01`,
      date_precision: "month",
      clinician: orNull(clinician),
      place: orNull(place),
      outcome: orNull(outcome),
      notes: orNull(notes),
      is_mental_health: mental,
    };
    const saved = e
      ? await supabase.from("health_events").update(row).eq("id", e.id).select("id").single()
      : await supabase.from("health_events").insert(row).select("id").single();
    if (saved.error || !saved.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(saved.error));
      return;
    }
    const eventId = saved.data.id;
    const keep = rx.filter((r) => r.name.trim());
    const removed = (e?.prescriptions ?? []).filter((p) => !keep.some((r) => r.id === p.id)).map((p) => p.id);
    const results = await Promise.all([
      removed.length ? supabase.from("health_event_prescriptions").delete().in("id", removed) : null,
      ...keep.map((r, position) => {
        const values = { name: r.name.trim(), detail: orNull(r.detail), position };
        return r.id
          ? supabase.from("health_event_prescriptions").update(values).eq("id", r.id)
          : supabase.from("health_event_prescriptions").insert({ ...values, event_id: eventId });
      }),
    ]);
    if (results.some((r) => r?.error)) {
      onSaving(false);
      setSaveError(saveFailedMessage(results.find((r) => r?.error)?.error));
      return;
    }
    onSaved(`/record/timeline?event=${eventId}`);
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <SelectField label="Type" options={KIND_OPTIONS} value={kind} onChange={(x) => setKind(x.target.value)} />
      <TextField
        id={ids.title}
        label="What it was"
        value={title}
        onChange={(x) => setTitle(x.target.value)}
        maxLength={200}
        error={errors.title}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField id={ids.month} label="Month" options={MONTH_OPTIONS} value={monthNo} onChange={(x) => setMonthNo(x.target.value)} />
        <TextField
          id={ids.year}
          label="Year"
          inputMode="numeric"
          value={year}
          onChange={(x) => setYear(x.target.value.replace(/\D/g, "").slice(0, 4))}
          error={errors.year}
        />
      </div>
      <TextField label="Seen by" optional value={clinician} onChange={(x) => setClinician(x.target.value)} maxLength={200} />
      <TextField label="Practice or hospital" optional value={place} onChange={(x) => setPlace(x.target.value)} maxLength={200} />
      <SelectField label="Outcome" options={OUTCOME_OPTIONS} value={outcome} onChange={(x) => setOutcome(x.target.value)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label font-medium">Prescribed</legend>
        {rx.length === 0 && <p className="text-caption text-ink-2">Nothing added.</p>}
        {rx.map((r, i) => (
          <div key={r.key} className="flex flex-col gap-3 rounded-tile border border-border-card bg-surface p-4">
            <TextField
              label={`Medicine ${i + 1}`}
              value={r.name}
              onChange={(x) => setRow(r.key, { name: x.target.value })}
              maxLength={200}
            />
            <TextField
              label="How long"
              optional
              value={r.detail}
              onChange={(x) => setRow(r.key, { detail: x.target.value })}
              maxLength={200}
            />
            <Button
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={() => setRx((rows) => rows.filter((x) => x.key !== r.key))}
              aria-label={`Remove medicine ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <AddLink onClick={() => setRx((rows) => [...rows, { key: newKey(), name: "", detail: "" }])} height={44}>
          Add a medicine
        </AddLink>
      </fieldset>

      <TextArea label="Doctor's notes" optional value={notes} onChange={(x) => setNotes(x.target.value)} maxLength={5000} />
      <MentalHealthSwitch checked={mental} onChange={setMental} />
    </FormFrame>
  );
}
