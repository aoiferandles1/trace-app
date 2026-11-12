"use client";

import { useRouter } from "next/navigation";
import { PatientShell } from "@/components/layout/PatientShell";
import { EmailForm } from "@/components/patient/EmailCodeForms";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { setPendingEmail } from "@/lib/patient/pendingEmail";

/** Sign-up step 1 of 7 (p-create): the email address. */
export default function SignupEmailPage() {
  const router = useRouter();
  return (
    <PatientShell header={<ProgressHeader step={1} backHref="/" />}>
      <div className="flex flex-col gap-5 px-5 pb-10">
        <StepIntro title="What's your email address?">
          We&apos;ll send a code to confirm it&apos;s yours. Trace is invite-only for now: use the email your invite went to.
        </StepIntro>
        <EmailForm
          mode="signup"
          onSent={(email) => {
            setPendingEmail(email);
            router.push("/signup/verify");
          }}
        />
        <p className="text-center text-caption text-ink-2">We&apos;ll never share your email address</p>
      </div>
    </PatientShell>
  );
}
