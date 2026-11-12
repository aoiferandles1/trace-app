"use client";

import { Icon } from "@/components/ui/Icon";
import { SessionReady } from "@/components/patient/PatientSession";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { GP_VISIT_DEFAULTS, sharedScopes } from "@/lib/patient/share";
import { useStepSave } from "../_lib/useStepSave";

/** What a share starts with: the share screen's defaults (owner's decision of 11 Nov 2026), never a list of its own. */
const SEES = sharedScopes(GP_VISIT_DEFAULTS);

/**
 * Sign-up step 6 of 7 (p-profiles). The GP visit profile is the set of
 * defaults every share starts from (PLAN.md section 7, REVIEW.md D11): there
 * is nothing to set up or store, so the step says what a share starts with
 * and moves on with one button (E13). "Add Emergency and Specialist
 * profiles later" is hidden (PLAN.md section 11).
 */
function ProfilesScreen() {
  const { save, busy, error } = useStepSave("profiles");

  return (
    <PatientShell
      header={<ProgressHeader step={6} backHref="/signup/privacy" />}
      footer={
        <Button size="lg" fullWidth onClick={() => void save({})} loading={busy}>
          Continue
        </Button>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro title="What a doctor sees when you share">
          Every share starts with these. You choose again before each one, and can change any of it then.
        </StepIntro>
        <Card as="ul" className="px-4.5" divided aria-label="A share starts with">
          {SEES.map((s) => (
            <li key={s.label} className="flex h-11 items-center gap-3 text-body">
              <Icon name={s.icon} size={20} className="text-accent" />
              {s.label}
            </li>
          ))}
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

export default function ProfilesPage() {
  return (
    <SessionReady>
      <ProfilesScreen />
    </SessionReady>
  );
}
