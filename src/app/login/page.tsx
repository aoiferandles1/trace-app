"use client";

import { useEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { CodeForm, EmailForm } from "@/components/patient/EmailCodeForms";
import { IconButton, IconLink } from "@/components/ui/IconButton";
import { StepIntro } from "@/components/patient/StepIntro";
import { LOGIN_EMAIL_KEY } from "@/lib/patient/auth";

function readEmail(): string | null {
  try {
    return sessionStorage.getItem(LOGIN_EMAIL_KEY);
  } catch {
    return null;
  }
}

function keepEmail(email: string | null) {
  try {
    if (email) sessionStorage.setItem(LOGIN_EMAIL_KEY, email);
    else sessionStorage.removeItem(LOGIN_EMAIL_KEY);
  } catch {
    // Storage blocked: a reload starts at the email step again.
  }
}

/**
 * Sign in (no Figma frame; reuses p-create and p-verify without the
 * progress bar). Email, then the code or the emailed link. Never creates an
 * account. The email is kept in this tab's session storage, as sign-up's
 * is, so reloading the code step keeps it.
 */
export default function LoginPage() {
  const [email, setEmailState] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const saved = readEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setEmailState(saved);
  }, []);
  function setEmail(next: string | null) {
    if (next === null && email) setTyped(email);
    keepEmail(next);
    setEmailState(next);
  }

  return (
    <PatientShell
      header={
        <div className="px-2.5 pt-2">
          {email ? (
            <IconButton icon="chevron-left" label="Use a different email" onClick={() => setEmail(null)} />
          ) : (
            <IconLink icon="chevron-left" label="Back to the welcome screen" href="/" />
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6 px-5 pb-10">
        {email ? (
          <>
            <StepIntro eyebrow="Sign in" title="Check your email">
              We sent a 6-digit code to {email}
            </StepIntro>
            <CodeForm email={email} mode="login" />
          </>
        ) : (
          <>
            <StepIntro eyebrow="Sign in" title="Welcome back">
              Enter the email you signed up with. We&apos;ll send you a code to sign in.
            </StepIntro>
            <EmailForm key={typed} mode="login" onSent={setEmail} initialEmail={typed} />
          </>
        )}
      </div>
    </PatientShell>
  );
}
