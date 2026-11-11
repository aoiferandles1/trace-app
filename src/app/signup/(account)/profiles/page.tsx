"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { Pill, type Tone } from "@/components/ui/Pill";
import { GP_PROFILE_KEY } from "../_lib/gpProfile";
import { useStepSave } from "../_lib/useStepSave";

const SEES: { label: string; tone: Tone }[] = [
  { label: "Critical safety", tone: "red" },
  { label: "Medications", tone: "peach" },
  { label: "Conditions", tone: "indigo" },
  { label: "Recent visits", tone: "indigo" },
  { label: "Care team", tone: "teal" },
];

/**
 * Sign-up step 6 of 7 (p-profiles). The GP visit profile is the set of
 * defaults every share starts from (PLAN.md section 7), so there is nothing
 * to store: both buttons move on, and Welcome only lists the profile as ready
 * after "Set up GP visit profile". "Add Emergency and Specialist profiles
 * later" is hidden (PLAN.md section 11).
 */
function ProfilesScreen() {
  const { save, busy, error } = useStepSave("profiles");
  const [later, setLater] = useState(false);

  function go(skip: boolean) {
    setLater(skip);
    try {
      if (skip) sessionStorage.setItem(GP_PROFILE_KEY, "1");
      else sessionStorage.removeItem(GP_PROFILE_KEY);
    } catch {
      // Storage blocked: Welcome lists the profile as ready, which it is.
    }
    void save({});
  }

  return (
    <PatientShell
      header={<ProgressHeader step={6} backHref="/signup/privacy" />}
      footer={
        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth onClick={() => go(false)} loading={busy && !later}>
            Set up GP visit profile
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={() => go(true)} loading={busy && later}>
            I&apos;ll do this later
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro eyebrow="Share Profiles" tone="teal" title="Set up your first share profile.">
          A share profile is a preset of what information a doctor can see. We&apos;ll create a GP visit profile to
          get you started.
        </StepIntro>
        <section
          aria-labelledby="gp-profile-title"
          className="flex flex-col gap-4 rounded-card border border-border-default bg-surface-card p-4"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-teal-tint text-teal-700 [&_svg]:size-5"
            >
              <Stethoscope />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="gp-profile-title" className="text-body-sm font-bold">
                GP visit
              </h2>
              <p className="text-body-sm text-text-tertiary">Standard GP consultation</p>
            </div>
            <Pill tone="teal" size="md">
              Recommended
            </Pill>
          </div>
          <h3 className="text-body-sm text-text-tertiary">Doctor will see</h3>
          <ul className="flex flex-wrap gap-2">
            {SEES.map((s) => (
              <li key={s.label}>
                <Pill tone={s.tone} variant="outlined" size="md">
                  {s.label}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
        {error && (
          <HintStrip tone="danger" live="assertive">
            {error}
          </HintStrip>
        )}
      </div>
    </PatientShell>
  );
}

export default function ProfilesPage() {
  return (
    <SessionReady>
      <ProfilesScreen />
    </SessionReady>
  );
}
