"use client";

import { TickIndicator } from "@/components/ui/Toggle";
import { useSyncExternalStore, type ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { GP_PROFILE_KEY } from "../_lib/gpProfile";
import { useStepSave } from "../_lib/useStepSave";

function readLater(): boolean {
  try {
    return sessionStorage.getItem(GP_PROFILE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Sign-up step 7 of 7 (p-welcome): what was set up, then Home. */
function WelcomeStepScreen() {
  const { save, busy, error, profile } = useStepSave("welcome");
  const { email } = usePatientSession();
  const gpLater = useSyncExternalStore(
    () => () => {},
    readLater,
    () => false,
  );

  const critical = [
    profile.blood_type ? `Blood type ${profile.blood_type}` : null,
    ...profile.allergies.map((a) => `${a} allergy`),
    ...profile.implants,
  ].filter(Boolean);

  return (
    <PatientShell header={
        <div className="px-5 pt-2">
          <ProgressBar value={7} max={7} label="Sign-up progress" valueText="Step 7 of 7" />
        </div>
      }>
      <div className="flex flex-col gap-6 px-5 pb-10 pt-5">
        <h1 className="font-display text-title font-light">Welcome to Trace{profile.first_name ? `, ${profile.first_name}` : ""}!</h1>
        <p className="text-body text-ink-2">Your record is ready. Here&apos;s what you&apos;ve set up:</p>
        <ul className="flex flex-col gap-4 rounded-card border border-border-card bg-surface p-4.5">
          <Item done title="Account created">
            {email}
          </Item>
          {critical.length > 0 ? (
            <Item done title="Critical safety saved">
              {critical.join(" · ")}
            </Item>
          ) : (
            <Item title="Add your critical safety details">Blood type, allergies and implants, from Profile</Item>
          )}
          {gpLater ? (
            <Item title="GP visit profile">Ready whenever you share. You can check it before every share.</Item>
          ) : (
            <Item done title="GP visit profile ready">
              Critical safety · medications · conditions · recent visits · care team
            </Item>
          )}
          <Item title="Add your first entry">Log a visit, write a note, or add a medication</Item>
        </ul>
        {error && (
          <Notice tone="critical" live="assertive">
            {error}
          </Notice>
        )}
        <Button size="lg" fullWidth loading={busy} onClick={() => void save({}, "/home")}>
          Go to my record
        </Button>
      </div>
    </PatientShell>
  );
}

function Item({ done = false, title, children }: { done?: boolean; title: string; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <TickIndicator checked={done} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-row font-medium text-ink">
          {title}
          <span className="sr-only">{done ? ", done" : ", to do"}</span>
        </span>
        {children && <span className="break-words text-caption text-ink-2">{children}</span>}
      </span>
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
