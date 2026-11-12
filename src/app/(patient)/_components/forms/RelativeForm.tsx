"use client";

import { useState, type FormEvent } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchRow } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { CONDITION_CATEGORIES, RELATION_OPTIONS, type Relative } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, saveFailedMessage, type FieldErrors } from "./FormBits";

type Row = { key: string; id?: string; name: string; age: string; category: string; mental: boolean };

let keySeq = 0;
const newKey = () => `cond-${++keySeq}`;

const CATEGORY_OPTIONS = [{ value: "", label: "Not sure" }, ...CONDITION_CATEGORIES];

/**
 * Add or edit a relative and their conditions (BRIEF.md 4.4 and 5.7; no
 * board, so section 7: a full-screen form, the save button pinned at the
 * bottom). Each condition has an optional age at diagnosis, a group (which
 * drives the tree's filter) and the mental health flag: a relative's mental
 * health condition is hidden from a doctor unless the share includes mental
 * health. Removing a condition deletes it.
 */
export function RelativeForm({
  formId,
  relative,
  onSaving,
  onSaved,
}: {
  formId: string;
  relative?: Relative;
  onSaving: (busy: boolean) => void;
  onSaved: (href: string) => void;
}) {
  const r = relative;
  const defaultLabel = (rel: string) => RELATION_OPTIONS.find((o) => o.value === rel)?.label ?? "";
  const [relation, setRelation] = useState(r?.relation ?? "mother");
  // The shapes fill `label` with the default words; only a label the patient chose is kept as their own.
  const [label, setLabel] = useState(r && r.label !== defaultLabel(r.relation) ? r.label : "");
  const [rows, setRows] = useState<Row[]>(
    r?.conditions.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      age: c.age_at_diagnosis === null ? "" : String(c.age_at_diagnosis),
      category: c.category ?? "",
      mental: c.is_mental_health,
    })) ?? [{ key: newKey(), name: "", age: "", category: "", mental: false }],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  function setRow(key: string, patch: Partial<Row>) {
    setRows((all) => all.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    const ids: Record<string, string> = {};
    rows.forEach((x, i) => {
      const age = x.age.trim();
      if (age && !(Number.isInteger(Number(age)) && Number(age) >= 0 && Number(age) <= 130)) {
        next[`age${i}`] = "Enter an age between 0 and 130, or leave it empty.";
        ids[`age${i}`] = `${formId}-age-${x.key}`;
      }
    });
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const values = { relation, label: orNull(label) };
    const saved = r
      ? await supabase.from("relatives").update(values).eq("id", r.id).select("id").single()
      : await supabase.from("relatives").insert(values).select("id").single();
    if (saved.error || !saved.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(saved.error));
      return;
    }
    const relativeId = saved.data.id;
    const keep = rows.filter((x) => x.name.trim());
    const removed = (r?.conditions ?? []).filter((c) => !keep.some((x) => x.id === c.id)).map((c) => c.id);
    const results = await Promise.all([
      removed.length ? supabase.from("relative_conditions").delete().in("id", removed) : null,
      ...keep.map((x) => {
        const v = {
          name: x.name.trim(),
          age_at_diagnosis: x.age.trim() ? Number(x.age) : null,
          category: orNull(x.category),
          is_mental_health: x.mental,
        };
        return x.id
          ? supabase.from("relative_conditions").update(v).eq("id", x.id)
          : supabase.from("relative_conditions").insert({ ...v, relative_id: relativeId });
      }),
    ]);
    if (results.some((x) => x?.error)) {
      onSaving(false);
      setSaveError(saveFailedMessage(results.find((x) => x?.error)?.error));
      return;
    }
    onSaved("/record/family");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <SelectField label="Who" options={RELATION_OPTIONS} value={relation} onChange={(e) => setRelation(e.target.value)} />
      <TextField
        label="What you call them"
        optional
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={`e.g. ${defaultLabel(relation)}`}
        hint="Shown on your tree. Leave it empty to use the words above."
        maxLength={60}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label font-medium">Conditions</legend>
        {rows.length === 0 && <p className="text-caption text-ink-2">None known.</p>}
        {rows.map((x, i) => (
          <div key={x.key} className="flex flex-col gap-3 rounded-tile border border-border-card bg-surface p-4">
            <TextField
              label={`Condition ${i + 1}`}
              value={x.name}
              onChange={(e) => setRow(x.key, { name: e.target.value })}
              placeholder="e.g. Type 2 diabetes"
              maxLength={200}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id={`${formId}-age-${x.key}`}
                label="Age at diagnosis"
                optional
                inputMode="numeric"
                value={x.age}
                onChange={(e) => setRow(x.key, { age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                placeholder="e.g. 61"
                error={errors[`age${i}`]}
              />
              <SelectField label="Group" options={CATEGORY_OPTIONS} value={x.category} onChange={(e) => setRow(x.key, { category: e.target.value })} />
            </div>
            <SwitchRow
              title="About mental health"
              description="Kept out of every share unless you include mental health."
              checked={x.mental}
              onCheckedChange={(v) => setRow(x.key, { mental: v })}
            />
            <Button
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={() => setRows((all) => all.filter((y) => y.key !== x.key))}
              aria-label={`Remove condition ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <AddLink onClick={() => setRows((all) => [...all, { key: newKey(), name: "", age: "", category: "", mental: false }])} height={44}>
          Add a condition
        </AddLink>
      </fieldset>
    </FormFrame>
  );
}
