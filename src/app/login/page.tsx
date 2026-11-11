"use client";

import { useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { CodeForm, EmailForm } from "@/components/patient/EmailCodeForms";
import { ChevronLeft } from "lucide-react";
import { IconButton, IconLink } from "@/components/ui/IconButton";
import { StepIntro } from "@/components/patient/StepIntro";

/**
 * Sign in (no Figma frame; reuses p-create and p-verify without the
 * progress bar). Email, then the code or the emailed link. Never creates an
 * account.
 */
export default function LoginPage() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <PatientShell
      header={
        <div className="px-2.5 pt-2">
          {email ? (
            <IconButton icon={<ChevronLeft />} label="Use a different email" onClick={() => setEmail(null)} />
          ) : (
            <IconLink icon={<ChevronLeft />} label="Back to the welcome screen" href="/" />
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6 px-5 pb-10">
        {email ? (
          <>
            <StepIntro eyebrow="Sign In" title="Check your email.">
              We sent a 6-digit code to {email}
            </StepIntro>
            <CodeForm email={email} mode="login" />
          </>
        ) : (
          <>
            <StepIntro eyebrow="Sign In" title="Welcome back.">
              Enter the email you signed up with. We&apos;ll send you a code to sign in.
            </StepIntro>
            <EmailForm mode="login" onSent={setEmail} />
          </>
        )}
      </div>
    </PatientShell>
  );
}
