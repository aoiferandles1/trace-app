"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { parseStrength } from "@/lib/patient/record";
import { orNull, type Medication } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { SelectField } from "@/components/ui/SelectField";
import { checkErrors, FormFrame, MoreDetails, saveFailedMessage, type FieldErrors } from "./FormBits";

/** "How often" and "When" as choices (B10); the values are the words the record stores. */
const FREQUENCY_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "once daily", label: "Once a day" },
  { value: "twice daily", label: "Twice a day" },
  { value: "three times daily", label: "Three times a day" },
  { value: "four times daily", label: "Four times a day" },
  { value: "weekly", label: "Once a week" },
  { value: "as needed", label: "As needed" },
];

const TIMING_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "evening", label: "Evening" },
  { value: "bedtime", label: "Bedtime" },
  { value: "morning and evening", label: "Morning and evening" },
];

/** A saved value as the matching option's value ("Once daily" is "once daily"), else as saved. */
function asOption(options: { value: string }[], saved: string | null | undefined): string {
  const t = (saved ?? "").trim();
  return options.find((o) => o.value.toLowerCase() === t.toLowerCase())?.value ?? t;
}

/** The options, plus the saved value when it is one of its own (typed before these were choices). */
function withCurrent(options: { value: string; label: string }[], current: string) {
  const found = options.some((o) => o.value.toLowerCase() === current.trim().toLowerCase());
  return found || !current.trim() ? options : [...options, { value: current, label: current }];
}

/**
 * Add or edit a medication (no board; BRIEF.md section 7: a full-screen form
 * with the save button pinned at the bottom). No mental health switch, on
 * purpose: medications are always shared.
 *
 * Adding writes the strength as `dose` ("36mg") with its `unit`, plus
 * `started_on` and `prescriber`; the database makes the first strength
 * period from them. Editing never changes the strength of a medication that
 * has a history: that is "Log a strength change" (a new period, never an
 * overwrite). To stop a medication, set "Ends or ended".
 */
export function MedicationForm({
  formId,
  medication,
  hasPeriods = false,
  onSaving,
  onSaved,
}: {
  formId: string;
  medication?: Medication;
  /** The medication already has strength periods: its strength is not edited here. */
  hasPeriods?: boolean;
  onSaving: (busy: boolean) => void;
  onSaved: (href: string) => void;
}) {
  const m = medication;
  const [v, setV] = useState({
    name: m?.name ?? "",
    dose: m?.dose ?? "",
    form: m?.form ?? "",
    frequency: asOption(FREQUENCY_OPTIONS, m?.frequency),
    timing: asOption(TIMING_OPTIONS, m?.timing),
    drug_class: m?.drug_class ?? "",
    indication: m?.indication ?? "",
    prescriber: m?.prescriber ?? "",
    prescriber_specialty: m?.prescriber_specialty ?? "",
    prescriber_org: m?.prescriber_org ?? "",
    started_on: m?.started_on ?? "",
    ended_on: m?.ended_on ?? "",
    refill_due_on: m?.refill_due_on ?? "",
    instructions: m?.instructions ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { name: `${formId}-name`, dose: `${formId}-dose`, ended_on: `${formId}-ended` };
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      name: v.name.trim() ? undefined : "Enter the medication's name.",
      // A strength that doesn't read as a number and a unit would have no history or chart (A5).
      dose:
        !(m && hasPeriods) && v.dose.trim() && !parseStrength(v.dose)
          ? "Enter a number and a unit, like 5mg or 100 mcg."
          : undefined,
      ended_on:
        v.started_on && v.ended_on && v.ended_on < v.started_on ? "The end date is before the start date." : undefined,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const lockedStrength = Boolean(m && hasPeriods);
    const parsed = parseStrength(v.dose);
    const row = {
      name: v.name.trim(),
      ...(lockedStrength ? {} : { dose: orNull(v.dose), unit: parsed?.unit ?? null }),
      form: orNull(v.form),
      frequency: orNull(v.frequency),
      timing: orNull(v.timing),
      drug_class: orNull(v.drug_class),
      indication: orNull(v.indication),
      prescriber: orNull(v.prescriber),
      prescriber_specialty: orNull(v.prescriber_specialty),
      prescriber_org: orNull(v.prescriber_org),
      started_on: orNull(v.started_on),
      ended_on: orNull(v.ended_on),
      refill_due_on: orNull(v.refill_due_on),
      instructions: orNull(v.instructions),
    };
    const supabase = createClient();
    const result = m
      ? await supabase.from("medications").update(row).eq("id", m.id).select("id").single()
      : await supabase.from("medications").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(result.error));
      return;
    }
    onSaved(m ? `/meds/${m.id}` : "/meds");
  }

  const moreOpen = Boolean(
    m && (v.form || v.drug_class || v.indication || v.prescriber || v.prescriber_specialty || v.prescriber_org || v.instructions),
  );
  const endField = (
    <TextField
      id={ids.ended_on}
      label="Ends or ended"
      optional
      type="date"
      value={v.ended_on}
      onChange={set("ended_on")}
      hint="Leave empty if you're still taking it."
      error={errors.ended_on}
    />
  );

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField id={ids.name} label="Name" value={v.name} onChange={set("name")} maxLength={200} error={errors.name} />
      {m && hasPeriods ? (
        <p className="text-body text-ink-2">
          To change the strength,{" "}
          <Link href={`/meds/${m.id}/change`} className="font-semibold text-accent underline underline-offset-2 hovered:text-accent-alt">
            log a strength change
          </Link>
          .
        </p>
      ) : (
        <TextField
          id={ids.dose}
          label="Strength"
          optional
          value={v.dose}
          onChange={set("dose")}
          placeholder="e.g. 5mg"
          hint="A number and a unit: mg, mcg, g, mL, units or IU."
          error={errors.dose}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="How often" optional options={withCurrent(FREQUENCY_OPTIONS, v.frequency)} value={v.frequency} onChange={set("frequency")} />
        <SelectField label="When" optional options={withCurrent(TIMING_OPTIONS, v.timing)} value={v.timing} onChange={set("timing")} />
      </div>
      <TextField label="Started" optional type="date" value={v.started_on} onChange={set("started_on")} />
      <TextField label="Next refill due" optional type="date" value={v.refill_due_on} onChange={set("refill_due_on")} />
      {m && endField}
      <MoreDetails initiallyOpen={moreOpen}>
        {!m && endField}
        <TextField label="Form" optional value={v.form} onChange={set("form")} hint="Tablet, inhaler, cream and so on." maxLength={100} />
        <TextField label="What it's for" optional value={v.indication} onChange={set("indication")} maxLength={200} />
        <TextField label="Type of medicine" optional value={v.drug_class} onChange={set("drug_class")} maxLength={100} />
        <TextField label="Prescribed by" optional value={v.prescriber} onChange={set("prescriber")} maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Their specialty" optional value={v.prescriber_specialty} onChange={set("prescriber_specialty")} maxLength={200} />
          <TextField label="Clinic or hospital" optional value={v.prescriber_org} onChange={set("prescriber_org")} maxLength={200} />
        </div>
        <TextArea label="Instructions" optional value={v.instructions} onChange={set("instructions")} maxLength={2000} />
      </MoreDetails>
    </FormFrame>
  );
}
