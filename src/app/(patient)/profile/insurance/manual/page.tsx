"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { TextField } from "@/components/ui/TextField";
import { errorCode, loadSection, type InsuranceConnection } from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
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
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/**
 * Enter policy details manually (BRIEF.md 4.4, the fallback; no board, so
 * section 7). Calls `save_insurance` with `via: "manual"`. The member number
 * is sent as typed and only its last four characters are kept. No password
 * field: Trace never asks for one.
 *
 * `?edit=1` edits a policy typed in by hand (A41): the same form, filled in,
 * and the member number may stay empty to keep the one ending as before.
 */
function ManualScreen() {
  const params = useSearchParams();
  const other = params.get("other") === "1";
  const editing = params.get("edit") === "1";
  const { formId, busy, formKey, control } = useFormScreen();
  const existing = useLoad(async () => (editing ? ((await loadSection("insurance")).data.connections[0] ?? null) : null), [editing]);
  const current = existing.status === "ready" ? existing.data : null;
  return (
    <SubScreen
      title={editing ? "Edit policy" : other ? "Other provider" : "Policy details"}
      titleSize="md"
      backHref="/profile/insurance"
      backLabel="Back to Insurance"
      footer={
        <SaveButton form={formId} busy={busy}>
          Save policy
        </SaveButton>
      }
    >
      {existing.status !== "ready" ? (
        <LoadStatus status={existing.status} onRetry={existing.reload} />
      ) : (
        <ManualForm key={`${formKey}-${current?.id ?? "new"}`} {...control} existing={current} />
      )}
    </SubScreen>
  );
}

function ManualForm({ formId, onSaving, onSaved, existing }: FormControl & { existing: InsuranceConnection | null }) {
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [member, setMember] = useState("");
  const [plan, setPlan] = useState(existing?.plan_name ?? "");
  const [renews, setRenews] = useState(existing?.renews_on ?? "");
  // The last four kept from before ("•••• 4821" gives "4821"): sent again when the number is left empty.
  const kept = existing ? existing.member_number_masked.replace(/[^a-z0-9]/gi, "").slice(-4) : "";
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { provider: `${formId}-provider`, member: `${formId}-member` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      provider: provider.trim() ? undefined : "Enter your insurer's name, like VHI.",
      member:
        member.replace(/[^a-z0-9]/gi, "").length >= 4 || (kept && !member.trim())
          ? undefined
          : "Enter your member number. It has at least 4 letters or numbers.",
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { error } = await createClient().rpc("save_insurance", {
      provider: provider.trim(),
      member_number: member.trim() || kept,
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
        optional={Boolean(kept)}
        hint={kept ? `Trace keeps only the last four characters. Leave it empty to keep the one ending ${kept}.` : "Trace keeps only the last four characters."}
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
