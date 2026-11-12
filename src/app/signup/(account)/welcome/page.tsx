"use client";

import { TickIndicator } from "@/components/ui/Toggle";
import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { allergyLabels } from "@/lib/patient/types";
import { GP_VISIT_DEFAULTS, joinLabels, sharedScopes } from "@/lib/patient/share";
import { useStepSave } from "../_lib/useStepSave";

/** Sign-up step 7 of 7 (p-welcome): what was set up, then Home. */
function WelcomeStepScreen() {
  const { save, busy, error, profile } = useStepSave("welcome");
  const { email } = usePatientSession();

  const critical = [
    profile.blood_type ? `Blood type ${profile.blood_type}` : null,
    ...allergyLabels(profile.allergies),
    ...profile.implants,
  ].filter(Boolean);

  return (
    <PatientShell
      header={
        <div className="px-5 pt-2">
          <ProgressBar value={7} max={7} label="Sign-up progress" valueText="Step 7 of 7" />
        </div>
      }
      footer={
        <Button size="lg" fullWidth loading={busy} onClick={() => void save({}, "/home")}>
          Go to your record
        </Button>
      }
    >
      <div className="flex flex-col gap-6 px-5 pb-10 pt-5">
        <h1 className="font-display text-title font-light">Welcome to Trace{profile.first_name ? `, ${profile.first_name}` : ""}</h1>
        <p className="text-body text-ink-2">Your record is ready.</p>
        <ul className="flex flex-col gap-4 rounded-card border border-border-card bg-surface p-4.5">
          <Item done title="Account created">
            {email}
          </Item>
          {critical.length > 0 ? (
            <Item done title="Critical safety saved">
              {critical.join(", ")}
            </Item>
          ) : (
            <Item title="Add your critical safety details" onGo={() => void save({}, "/profile/edit")}>
              Blood type, allergies and implants
            </Item>
          )}
          <Item done title="Sharing ready">
            A share starts with {joinLabels(sharedScopes(GP_VISIT_DEFAULTS))}
          </Item>
          <Item title="Add your first entry" onGo={() => void save({}, "/add")}>
            A visit, a note or a medication
          </Item>
        </ul>
        {error && (
          <Notice tone="critical" live="assertive">
            {error}
          </Notice>
        )}
      </div>
    </PatientShell>
  );
}

/** A line of what was set up; a to-do is a button that finishes sign-up and opens it (B22). */
function Item({
  done = false,
  title,
  children,
  onGo,
}: {
  done?: boolean;
  title: string;
  children?: ReactNode;
  onGo?: () => void;
}) {
  const text = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={onGo ? "text-row font-medium text-accent underline underline-offset-2" : "text-row font-medium text-ink"}>
        {title}
        <span className="sr-only">{done ? ", done" : ", to do"}</span>
      </span>
      {children && <span className="break-words text-caption text-ink-2">{children}</span>}
    </span>
  );
  return (
    <li className="flex items-start gap-3">
      <TickIndicator checked={done} />
      {onGo ? (
        <button type="button" onClick={onGo} className="flex min-w-0 flex-1 text-left">
          {text}
        </button>
      ) : (
        text
      )}
    </li>
  );
}

export default function WelcomeStepPage() {
  return (
    <SessionReady>
      <WelcomeStepScreen />
    </SessionReady>
  );
}
