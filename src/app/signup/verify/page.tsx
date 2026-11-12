"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { CodeForm } from "@/components/patient/EmailCodeForms";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { CheckingScreen } from "@/components/patient/PatientSession";
import { StepIntro } from "@/components/patient/StepIntro";
import { usePendingEmail } from "@/lib/patient/pendingEmail";

/**
 * Sign-up step 2 of 7 (p-verify). Six boxes, not Figma's four: Supabase
 * codes are six digits (PLAN.md section 6).
 */
export default function SignupVerifyPage() {
  const router = useRouter();
  const email = usePendingEmail();

  useEffect(() => {
    if (email === null) router.replace("/signup");
  }, [email, router]);

  if (!email) return <CheckingScreen />;

  return (
    <PatientShell header={<ProgressHeader step={2} backHref="/signup" />}>
      <div className="flex flex-col gap-6 px-5 pb-10">
        <StepIntro title="Check your email">
          We sent a 6-digit code to {email}
        </StepIntro>
        <CodeForm email={email} mode="signup" />
      </div>
    </PatientShell>
  );
}
