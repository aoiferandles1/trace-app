"use client";

import { Icon } from "@/components/ui/Icon";
import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { GP_PROFILE_KEY } from "../_lib/gpProfile";
import { useStepSave } from "../_lib/useStepSave";

const SEES = [
  { label: "Critical safety" },
  { label: "Medications" },
  { label: "Conditions" },
  { label: "Recent visits" },
  { label: "Care team" },
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
        <StepIntro eyebrow="Share Profiles" title="Set up your first share profile.">
          A share profile is a preset of what information a doctor can see. We&apos;ll create a GP visit profile to
          get you started.
        </StepIntro>
        <section
          aria-labelledby="gp-profile-title"
          className="flex flex-col gap-3 rounded-card border border-border-card bg-surface p-4.5"
        >
          <div className="flex items-center gap-3.5">
            <Icon name="calendar" className="text-accent" />
            <div className="min-w-0 flex-1">
              <h2 id="gp-profile-title" className="text-row font-medium">
                GP visit
              </h2>
              <p className="text-caption text-ink-2">Standard GP consultation, recommended</p>
            </div>
          </div>
          <div>
            <h3 className="mb-0.5 text-caption font-semibold text-ink-2">Doctor will see</h3>
            <ul className="divide-y divide-border-row">
              {SEES.map((s) => (
                <li key={s.label} className="flex h-9 items-center gap-3 text-body">
                  <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                    <Icon name="tick" size={12} strokeWidth={3.5} />
                  </span>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
        {error && (
          <Notice tone="critical" live="assertive">
            {error}
          </Notice>
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
