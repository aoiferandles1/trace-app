"use client";

import { useState, type FormEvent } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { CARE_KIND_OPTIONS } from "@/lib/patient/options";
import { orNull, type CareMember } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, saveFailedMessage, type FieldErrors } from "./FormBits";

/** Add or edit someone on the care team (no Figma frame; PLAN.md section 8, item 6). */
export function CareMemberForm({
  formId,
  member,
  onSaving,
  onSaved,
}: {
  formId: string;
  member?: CareMember;
  onSaving: (busy: boolean) => void;
  onSaved: (href: string) => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [kind, setKind] = useState(member?.kind ?? "gp");
  const [role, setRole] = useState(member?.role ?? "");
  const [org, setOrg] = useState(member?.organisation ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { name: `${formId}-name` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = { name: name.trim() ? undefined : "Enter their name." };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const row = { name: name.trim(), kind, role: orNull(role), organisation: orNull(org) };
    const supabase = createClient();
    const result = member
      ? await supabase.from("care_team").update(row).eq("id", member.id).select("id").single()
      : await supabase.from("care_team").insert(row).select("id").single();
    if (result.error || !result.data) {
      onSaving(false);
      setSaveError(saveFailedMessage(result.error));
      return;
    }
    onSaved("/profile/care-team");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField id={ids.name} label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} error={errors.name} />
      <SelectField label="Type" options={CARE_KIND_OPTIONS} value={kind} onChange={(e) => setKind(e.target.value)} />
      <TextField
        label="Role or specialty"
        optional
        value={role}
        onChange={(e) => setRole(e.target.value)}
        maxLength={200}
      />
      <TextField
        label="Practice, clinic or shop"
        optional
        value={org}
        onChange={(e) => setOrg(e.target.value)}
        maxLength={200}
      />
    </FormFrame>
  );
}
