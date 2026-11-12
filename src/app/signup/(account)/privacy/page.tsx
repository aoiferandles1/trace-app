"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import Link from "next/link";
import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Card } from "@/components/ui/Card";
import { useStepSave } from "../_lib/useStepSave";

/**
 * Sign-up step 5 of 7 (p-privacy): what is stored, who sees it, and consent
 * as one act (B21): the line above the button says what "I agree" accepts,
 * so there is no switch to turn on first (and no notice below the fold when
 * it is off, A38). Terms has the full text. No reminders switch: Trace sends
 * no reminders (E34).
 */
function PrivacyScreen() {
  const { save, busy, error, profile } = useStepSave("privacy");

  return (
    <PatientShell
      header={<ProgressHeader step={5} backHref="/signup/medical" />}
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-caption text-ink-2">
            By agreeing you accept Trace&apos;s terms and privacy policy.{" "}
            <Link href="/terms?back=/signup/privacy" className="font-semibold text-accent underline underline-offset-2">
              Read the terms
            </Link>
          </p>
          <Button
            size="lg"
            fullWidth
            loading={busy}
            onClick={() => void save({ terms_accepted_at: profile.terms_accepted_at ?? new Date().toISOString() })}
          >
            I agree
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro title="Your data, your rights" />
        <Card as="ul" className="px-4.5" divided>
          <Point title="What Trace stores">Only what you add. Nothing is collected automatically.</Point>
          <Point title="Who can see it">You, and a doctor you share with, for as long as you allow. It is never sold.</Point>
          <Point title="Your rights">See, correct, export or delete your record at any time.</Point>
        </Card>
        {error && (
          <Notice tone="critical" live="assertive">
            {error}
          </Notice>
        )}
      </div>
    </PatientShell>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5 py-3.5">
      <h2 className="text-row font-medium">{title}</h2>
      <p className="text-caption text-ink-2">{children}</p>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <SessionReady>
      <PrivacyScreen />
    </SessionReady>
  );
}
