"use client";

import { useState, type FormEvent } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchRow } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { categoryOfConditionName, CONDITION_CATEGORIES, RELATION_OPTIONS, type Relative } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MENTAL_HEALTH_LINE, saveFailedMessage, type FieldErrors } from "./FormBits";

type Row = { key: string; id?: string; name: string; age: string; category: string; mental: boolean };

let keySeq = 0;
const newKey = () => `cond-${++keySeq}`;

const CATEGORY_OPTIONS = [{ value: "", label: "Not sure" }, ...CONDITION_CATEGORIES];

/** Relations a person has only one of: a second is refused (A3). */
const SINGLE = new Set([
  "mother",
  "father",
  "maternal_grandmother",
  "maternal_grandfather",
  "paternal_grandmother",
  "paternal_grandfather",
]);

const WHO_OPTIONS = [{ value: "", label: "Choose who" }, ...RELATION_OPTIONS];

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
  // Nothing chosen to start with, so an empty form can't save a second "Mum" (A3).
  const [relation, setRelation] = useState(r?.relation ?? "");
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

  /** A typed name suggests its group (B14), unless one was chosen already. */
  function setName(x: Row, name: string) {
    const suggested = x.category ? null : categoryOfConditionName(name);
    setRow(x.key, suggested ? { name, category: suggested } : { name });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    const ids: Record<string, string> = { relation: `${formId}-relation` };
    if (!relation) next.relation = "Choose who this is.";
    rows.forEach((x, i) => {
      // A row with an age or a group but no name would be dropped without a word (A44).
      if (!x.name.trim() && (x.age.trim() || x.category || x.mental)) {
        next[`name${i}`] = "Name the condition, or remove this one.";
        ids[`name${i}`] = `${formId}-name-${x.key}`;
      }
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
    if (SINGLE.has(relation)) {
      const same = await supabase.from("relatives").select("id").eq("relation", relation);
      if (!same.error && same.data.some((x) => x.id !== r?.id)) {
        onSaving(false);
        const who = defaultLabel(relation);
        setErrors({ relation: `${who} is already in your family history. Edit ${who} there instead.` });
        document.getElementById(ids.relation)?.focus();
        return;
      }
    }
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
      <SelectField
        id={`${formId}-relation`}
        label="Who"
        options={WHO_OPTIONS}
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        error={errors.relation}
      />
      <TextField
        label="What you call them"
        optional
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        hint="Shown on your tree. Leave it empty to use the words above."
        maxLength={60}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label font-medium">Conditions</legend>
        <p className="-mt-1 text-caption text-ink-2">A condition about mental health is {MENTAL_HEALTH_LINE.charAt(0).toLowerCase() + MENTAL_HEALTH_LINE.slice(1)}</p>
        {rows.length === 0 && <p className="text-caption text-ink-2">None known.</p>}
        {rows.map((x, i) => (
          <div key={x.key} className="flex flex-col gap-3 rounded-tile border border-border-card bg-surface p-4">
            <TextField
              id={`${formId}-name-${x.key}`}
              label={`Condition ${i + 1}`}
              value={x.name}
              onChange={(e) => setName(x, e.target.value)}
              maxLength={200}
              error={errors[`name${i}`]}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id={`${formId}-age-${x.key}`}
                label="Age at diagnosis"
                optional
                inputMode="numeric"
                value={x.age}
                onChange={(e) => setRow(x.key, { age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                error={errors[`age${i}`]}
              />
              <SelectField label="Group" options={CATEGORY_OPTIONS} value={x.category} onChange={(e) => setRow(x.key, { category: e.target.value })} />
            </div>
            <SwitchRow
              title="About mental health"
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
