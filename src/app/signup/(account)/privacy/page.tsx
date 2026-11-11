"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { SwitchRow } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { useStepSave } from "../_lib/useStepSave";

/** Sign-up step 5 of 7 (p-privacy): what is stored, who sees it, consent. */
function PrivacyScreen() {
  const { save, busy, error, profile } = useStepSave("privacy");
  const [agreed, setAgreed] = useState(Boolean(profile.terms_accepted_at));
  const [reminders, setReminders] = useState(profile.email_reminders);
  const [needsAgree, setNeedsAgree] = useState(false);

  async function agree() {
    if (!agreed) {
      setNeedsAgree(true);
      return;
    }
    await save({
      terms_accepted_at: profile.terms_accepted_at ?? new Date().toISOString(),
      email_reminders: reminders,
    });
  }

  return (
    <PatientShell
      header={<ProgressHeader step={5} backHref="/signup/medical" />}
      footer={
        <Button size="lg" fullWidth onClick={agree} loading={busy}>
          I agree
        </Button>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro eyebrow="Privacy & Consent" title="Your data, your rights.">
          Please read this before continuing. Under GDPR, you have the right to know exactly what we store and why.
        </StepIntro>
        <InfoCard title="What Trace stores" tone="indigo">
          Your health record, documents you upload, medications you add, and notes you write. Nothing is collected
          automatically.
        </InfoCard>
        <InfoCard title="Who can see your data" tone="teal">
          Only doctors you explicitly share with, for a session you control. Trace staff cannot access your health
          record. No data is ever sold or used for advertising.
        </InfoCard>
        <InfoCard title="Your rights" tone="peach">
          Access your data, correct it, export it, or delete your account at any time. Full GDPR rights apply. Irish
          data protection applies under the Data Protection Act 2018.
        </InfoCard>
        <div className="flex flex-col gap-2">
          <SwitchRow
            title={<span className="font-bold">I agree to Trace&apos;s Terms of Service and Privacy Policy</span>}
            description={
              <>
                You must agree to continue.{" "}
                <Link href="/terms" className="text-indigo-text underline underline-offset-2">
                  Read full terms
                </Link>
              </>
            }
            checked={agreed}
            onCheckedChange={(v) => {
              setAgreed(v);
              if (v) setNeedsAgree(false);
            }}
          />
          <SwitchRow
            title={<span className="font-bold">Receive reminders and health tips by email</span>}
            description="Optional — you can change this in settings"
            checked={reminders}
            onCheckedChange={setReminders}
          />
        </div>
        {needsAgree && (
          <HintStrip tone="danger" live="assertive">
            Turn on the agreement to continue.
          </HintStrip>
        )}
        {error && (
          <HintStrip tone="danger" live="assertive">
            {error}
          </HintStrip>
        )}
      </div>
    </PatientShell>
  );
}

const titleTone = {
  indigo: "text-indigo-text",
  teal: "text-teal-700",
  peach: "text-peach-700",
} as const;

function InfoCard({ title, tone, children }: { title: string; tone: keyof typeof titleTone; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-card border border-border-default bg-surface-card px-4 py-4">
      <h2 className={cn("text-body-lg font-bold", titleTone[tone])}>{title}</h2>
      <p className="text-body-sm text-text-tertiary">{children}</p>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <SessionReady>
      <PrivacyScreen />
    </SessionReady>
  );
}
