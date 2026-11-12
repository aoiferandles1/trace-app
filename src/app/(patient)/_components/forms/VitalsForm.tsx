"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, saveFailedMessage, type FieldErrors, type FormControl } from "./FormBits";

export type VitalsRow = Tables<"vitals">;

/** Each measure: its label, the column, the range a real reading falls in, and whether it may have decimals. */
const MEASURES = [
  { key: "systolic", label: "Blood pressure, top number", min: 50, max: 260, decimals: false },
  { key: "diastolic", label: "Blood pressure, bottom number", min: 30, max: 160, decimals: false },
  { key: "heart_rate", label: "Heart rate (beats a minute)", min: 20, max: 250, decimals: false },
  { key: "weight_kg", label: "Weight (kg)", min: 1, max: 400, decimals: true },
  { key: "spo2", label: "Oxygen level (SpO2, %)", min: 50, max: 100, decimals: false },
] as const;

type Key = (typeof MEASURES)[number]["key"];

/**
 * Log or edit a set of vitals (F1; no board, the other forms' pattern): the
 * day, then any of blood pressure, heart rate, weight and oxygen level. At
 * least one is needed; each is checked against a range a real reading falls
 * in, so a typo ("1288") is caught here.
 */
export function VitalsForm({ formId, onSaving, onSaved, vitals: v }: FormControl & { vitals?: VitalsRow }) {
  const [day, setDay] = useState(v?.recorded_on ?? dayKey());
  const [values, setValues] = useState<Record<Key, string>>({
    systolic: v?.systolic?.toString() ?? "",
    diastolic: v?.diastolic?.toString() ?? "",
    heart_rate: v?.heart_rate?.toString() ?? "",
    weight_kg: v?.weight_kg?.toString() ?? "",
    spo2: v?.spo2?.toString() ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids: Record<string, string> = { day: `${formId}-day` };
  for (const m of MEASURES) ids[m.key] = `${formId}-${m.key}`;
  const today = dayKey();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      day: !/^\d{4}-\d{2}-\d{2}$/.test(day) ? "Enter the date, like 14/01/2026." : day > today ? "The date can't be in the future." : undefined,
    };
    const parsed: Partial<Record<Key, number | null>> = {};
    for (const m of MEASURES) {
      const t = values[m.key].trim().replace(",", ".");
      if (!t) {
        parsed[m.key] = null;
        continue;
      }
      const n = Number(t);
      const ok = (m.decimals ? /^\d+(\.\d+)?$/ : /^\d+$/).test(t) && n >= m.min && n <= m.max;
      if (!ok) next[m.key] = `Enter a number from ${m.min} to ${m.max}${m.decimals ? "" : ", no decimals"}.`;
      else parsed[m.key] = n;
    }
    const any = MEASURES.some((m) => parsed[m.key] !== null && parsed[m.key] !== undefined);
    if (!any && !Object.keys(next).some((k) => next[k])) next.systolic = "Enter at least one reading.";
    if ((parsed.systolic === null) !== (parsed.diastolic === null) && !next.systolic && !next.diastolic)
      next[parsed.systolic === null ? "systolic" : "diastolic"] = "Enter both blood pressure numbers, or neither.";
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const row = { recorded_on: day, ...parsed };
    const supabase = createClient();
    const result = v
      ? await supabase.from("vitals").update(row).eq("id", v.id).select("id").single()
      : await supabase.from("vitals").insert(row).select("id").single();
    if (result.error) {
      onSaving(false);
      setSaveError(saveFailedMessage(result.error));
      return;
    }
    onSaved("/record/vitals");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField id={ids.day} label="Date" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} />
      {MEASURES.map((m) => (
        <TextField
          key={m.key}
          id={ids[m.key]}
          label={m.label}
          optional
          inputMode={m.decimals ? "decimal" : "numeric"}
          value={values[m.key]}
          onChange={(e) => setValues((s) => ({ ...s, [m.key]: e.target.value }))}
          error={errors[m.key]}
        />
      ))}
    </FormFrame>
  );
}

/** "128/82, heart rate 74, 58 kg, oxygen 98%". */
export function vitalsLine(v: Pick<VitalsRow, "systolic" | "diastolic" | "heart_rate" | "weight_kg" | "spo2">): string {
  return [
    v.systolic !== null && v.diastolic !== null ? `${v.systolic}/${v.diastolic}` : null,
    v.heart_rate !== null ? `heart rate ${v.heart_rate}` : null,
    v.weight_kg !== null ? `${v.weight_kg} kg` : null,
    v.spo2 !== null ? `oxygen ${v.spo2}%` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
