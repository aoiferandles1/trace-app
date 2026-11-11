"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SwitchRow } from "@/components/ui/Switch";
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
        <StepIntro eyebrow="Privacy and consent" title="Your data, your rights.">
          Please read this before continuing. Under GDPR, you have the right to know exactly what we store and why.
        </StepIntro>
        <InfoCard title="What Trace stores">
          Your health record: the visits, medications and notes you add. Nothing is collected
          automatically.
        </InfoCard>
        <InfoCard title="Who can see your data">
          Only doctors you explicitly share with, for a session you control. The database is run by Aoife Randles,
          who made Trace. No data is ever sold or used for advertising.
        </InfoCard>
        <InfoCard title="Your rights">
          Access your data, correct it, export it, or delete your account at any time. Full GDPR rights apply. Irish
          data protection applies under the Data Protection Act 2018.
        </InfoCard>
        <div className="flex flex-col gap-2">
          <SwitchRow
            title={<span className="font-semibold">I agree to Trace&apos;s Terms of Service and Privacy Policy</span>}
            description={
              <>
                You must agree to continue.{" "}
                <Link href="/terms" className="text-accent underline underline-offset-2">
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
            title={<span className="font-semibold">Receive reminders and health tips by email</span>}
            description="Optional. Trace does not send these yet. You can change this in Edit profile."
            checked={reminders}
            onCheckedChange={setReminders}
          />
        </div>
        {needsAgree && (
          <Notice tone="critical" live="assertive">
            Turn on the agreement to continue.
          </Notice>
        )}
        {error && (
          <Notice tone="critical" live="assertive">
            {error}
          </Notice>
        )}
      </div>
    </PatientShell>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-card border border-border-card bg-surface p-4.5">
      <h2 className="text-row font-medium">{title}</h2>
      <p className="text-caption text-ink-2">{children}</p>
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
