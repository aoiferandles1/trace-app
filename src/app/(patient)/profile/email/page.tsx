"use client";

import { useState, type FormEvent } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { authErrorMessage, INVITE_ONLY, looksLikeEmail } from "@/lib/patient/auth";
import { createClient } from "@/lib/supabase/client";
import {
  checkErrors,
  FormFrame,
  SaveButton,
  useFormScreen,
  type FieldErrors,
  type FormControl,
} from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/**
 * Change the sign-in email (F4; no board). Supabase sends a link to confirm
 * the change; until it is followed, sign-in stays on the old address, and
 * Your details says which address is waiting. The invite list applies to a
 * new address as to a new account (supabase/README.md section 7). Demo
 * accounts have no email and never reach this screen.
 */
function EmailScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const { email, isAnonymous } = usePatientSession();
  return (
    <SubScreen
      title="Change email"
      backHref="/profile/details"
      backLabel="Back to Your details"
      footer={isAnonymous ? undefined : <SaveButton form={formId} busy={busy}>Send confirmation</SaveButton>}
    >
      {isAnonymous ? (
        <p className="px-5 py-6 text-body text-ink-2">The demo has no email to change.</p>
      ) : (
        <EmailForm key={formKey} {...control} current={email ?? ""} />
      )}
    </SubScreen>
  );
}

function EmailForm({ formId, onSaving, onSaved, current }: FormControl & { current: string }) {
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { email: `${formId}-email` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = next.trim();
    const errs: FieldErrors = {
      email: !looksLikeEmail(value)
        ? "Enter an email address like name@example.ie"
        : value.toLowerCase() === current.toLowerCase()
          ? "That's the email you use now."
          : undefined,
    };
    setErrors(errs);
    if (!checkErrors(errs, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { error } = await createClient().auth.updateUser(
      { email: value },
      { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    );
    if (error) {
      onSaving(false);
      const message = authErrorMessage(error, "send");
      setSaveError(message === INVITE_ONLY ? "Trace is invite-only for now, and that address isn't on the list." : message);
      return;
    }
    onSaved("/profile/details");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <p className="text-body text-ink-2">You sign in with {current} now.</p>
      <TextField
        id={ids.email}
        label="New email address"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.email}
      />
      <Notice tone="neutral">We&apos;ll email a link to confirm it. Until you open it, you sign in as before.</Notice>
    </FormFrame>
  );
}

export default function EmailPage() {
  return (
    <SessionReady>
      <EmailScreen />
    </SessionReady>
  );
}
