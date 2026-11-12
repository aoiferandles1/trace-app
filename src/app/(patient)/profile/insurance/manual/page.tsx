"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { TextField } from "@/components/ui/TextField";
import { errorCode } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import {
  checkErrors,
  FormFrame,
  SaveButton,
  saveFailedMessage,
  useFormScreen,
  type FieldErrors,
  type FormControl,
} from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/**
 * Enter policy details manually (BRIEF.md 4.4, the fallback; no board, so
 * section 7). Calls `save_insurance` with `via: "manual"`. The member number
 * is sent as typed and only its last four characters are kept. No password
 * field: Trace never asks for one.
 */
function ManualScreen() {
  const other = useSearchParams().get("other") === "1";
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title={other ? "Other provider" : "Policy details"}
      titleSize="md"
      backHref="/profile/insurance"
      backLabel="Back to Insurance"
      footer={
        <SaveButton form={formId} busy={busy}>
          Save policy
        </SaveButton>
      }
    >
      <ManualForm key={formKey} {...control} />
    </SubScreen>
  );
}

function ManualForm({ formId, onSaving, onSaved }: FormControl) {
  const [provider, setProvider] = useState("");
  const [member, setMember] = useState("");
  const [plan, setPlan] = useState("");
  const [renews, setRenews] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { provider: `${formId}-provider`, member: `${formId}-member` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      provider: provider.trim() ? undefined : "Enter your insurer's name, like VHI.",
      member: member.replace(/[^a-z0-9]/gi, "").length >= 4 ? undefined : "Enter your member number. It has at least 4 letters or numbers.",
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { error } = await createClient().rpc("save_insurance", {
      provider: provider.trim(),
      member_number: member.trim(),
      plan_name: orNull(plan) ?? undefined,
      renews_on: orNull(renews) ?? undefined,
      via: "manual",
    });
    if (error) {
      onSaving(false);
      if (errorCode(error) === "invalid_member_number")
        setErrors({ member: "Enter your member number. It has at least 4 letters or numbers." });
      else setSaveError(saveFailedMessage(error));
      return;
    }
    onSaved("/profile/insurance");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField
        id={ids.provider}
        label="Provider"
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        placeholder="e.g. VHI"
        maxLength={100}
        error={errors.provider}
      />
      <TextField
        id={ids.member}
        label="Member number"
        value={member}
        onChange={(e) => setMember(e.target.value)}
        autoComplete="off"
        hint="Trace keeps only the last four characters."
        maxLength={40}
        error={errors.member}
      />
      <TextField label="Plan" optional value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={100} />
      <TextField label="Renewal date" optional type="date" value={renews} onChange={(e) => setRenews(e.target.value)} />
    </FormFrame>
  );
}

export default function ManualInsurancePage() {
  return (
    <SessionReady>
      <ManualScreen />
    </SessionReady>
  );
}
