"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { TextField } from "@/components/ui/TextField";
import { errorCode } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, SAVE_FAILED, SaveButton, type FieldErrors } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/**
 * Enter policy details manually (BRIEF.md 4.4, the fallback; no board, so
 * section 7). Calls `save_insurance` with `via: "manual"`. The member number
 * is sent as typed and only its last four characters are kept. No password
 * field: Trace never asks for one.
 */
function ManualScreen() {
  const formId = useId();
  const router = useRouter();
  const other = useSearchParams().get("other") === "1";
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setSaveError(null);
    const { error } = await createClient().rpc("save_insurance", {
      provider: provider.trim(),
      member_number: member.trim(),
      plan_name: orNull(plan) ?? undefined,
      renews_on: orNull(renews) ?? undefined,
      via: "manual",
    });
    if (error) {
      setBusy(false);
      if (errorCode(error) === "invalid_member_number") setErrors({ member: "Enter your member number. It has at least 4 letters or numbers." });
      else setSaveError(SAVE_FAILED);
      return;
    }
    router.push("/profile/insurance");
  }

  return (
    <SubScreen
      title={other ? "Other provider" : "Policy details"}
      titleSize="md"
      backHref="/profile/insurance"
      backLabel="Back to Insurance"
      footer={<SaveButton form={formId} busy={busy}>Save policy</SaveButton>}
    >
      <FormFrame id={formId} onSubmit={submit} error={saveError}>
        <TextField id={ids.provider} label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. VHI" maxLength={100} error={errors.provider} />
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
        <TextField label="Plan" optional value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="e.g. Comprehensive plan" maxLength={100} />
        <TextField label="Renewal date" optional type="date" value={renews} onChange={(e) => setRenews(e.target.value)} />
        <p className="text-caption text-ink-2">Read only. You can remove it any time.</p>
      </FormFrame>
    </SubScreen>
  );
}

export default function ManualInsurancePage() {
  return (
    <SessionReady>
      <ManualScreen />
    </SessionReady>
  );
}
