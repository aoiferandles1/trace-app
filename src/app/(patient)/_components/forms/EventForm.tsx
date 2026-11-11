"use client";

import { useRouter } from "next/navigation";
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
import { checkErrors, FormFrame, MentalHealthSwitch, SAVE_FAILED, type FieldErrors } from "./FormBits";

const KIND_OPTIONS = [
  { value: "infection", label: "Infection" },
  { value: "condition", label: "Condition" },
];

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
}: {
  formId: string;
  event?: HealthEvent;
  onSaving: (busy: boolean) => void;
}) {
  const router = useRouter();
  const e = event;
  const [kind, setKind] = useState<string>(e?.kind ?? "infection");
  const [title, setTitle] = useState(e?.title ?? "");
  const [month, setMonth] = useState(e ? e.occurred_on.slice(0, 7) : dayKey().slice(0, 7));
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
  const ids = { title: `${formId}-title`, month: `${formId}-month` };

  function setRow(key: string, patch: Partial<RxRow>) {
    setRx((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const next: FieldErrors = {
      title: title.trim() ? undefined : "Say what it was, like Chest infection.",
      month: /^\d{4}-\d{2}$/.test(month) ? undefined : "Enter the month and year, like August 2026.",
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
      setSaveError(SAVE_FAILED);
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
      setSaveError(SAVE_FAILED);
      return;
    }
    onSaving(false); // Next.js may show this screen again: never leave it busy.
    router.push(`/record/timeline?event=${eventId}`);
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <SelectField label="Type" options={KIND_OPTIONS} value={kind} onChange={(x) => setKind(x.target.value)} />
      <TextField
        id={ids.title}
        label="What it was"
        value={title}
        onChange={(x) => setTitle(x.target.value)}
        placeholder={kind === "infection" ? "e.g. Chest infection" : "e.g. Hypothyroidism diagnosed"}
        maxLength={200}
        error={errors.title}
      />
      <TextField
        id={ids.month}
        label="Month"
        type="month"
        max={dayKey().slice(0, 7)}
        value={month}
        onChange={(x) => setMonth(x.target.value)}
        error={errors.month}
      />
      <TextField label="Seen by" optional value={clinician} onChange={(x) => setClinician(x.target.value)} placeholder="e.g. Dr Hennessy" maxLength={200} />
      <TextField label="Practice or hospital" optional value={place} onChange={(x) => setPlace(x.target.value)} placeholder="e.g. Rathmines Medical Centre" maxLength={200} />
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
              placeholder="e.g. Doxycycline 100mg"
              maxLength={200}
            />
            <TextField
              label="How long"
              optional
              value={r.detail}
              onChange={(x) => setRow(r.key, { detail: x.target.value })}
              placeholder="e.g. 7 days"
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
