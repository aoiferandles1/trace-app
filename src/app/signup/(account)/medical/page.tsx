"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState, type FormEvent } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { BLOOD_TYPE_OPTIONS } from "@/lib/patient/options";
import { splitList } from "@/lib/patient/types";
import { useStepSave } from "../_lib/useStepSave";

/**
 * Sign-up step 4 of 7 (p-medical): critical safety information. Allergies
 * and implants are typed as one line each and saved as lists (split on
 * commas). "I'll add this later" moves on without saving; it only shows
 * while nothing is typed, so typed values are never dropped (A49).
 */
function MedicalScreen() {
  const { save, busy, error, profile } = useStepSave("medical");
  const [bloodType, setBloodType] = useState(profile.blood_type ?? "");
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [implants, setImplants] = useState(profile.implants.join(", "));
  const [skipping, setSkipping] = useState(false);
  const typed = Boolean(bloodType || allergies.trim() || implants.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    await save({
      blood_type: bloodType || null,
      allergies: splitList(allergies),
      implants: splitList(implants),
    });
  }

  return (
    <PatientShell
      header={<ProgressHeader step={4} backHref="/signup/about" />}
      footer={
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            form="medical-form"
            size="lg"
            fullWidth
            loading={busy && !skipping}
            onClick={() => setSkipping(false)}
          >
            Continue
          </Button>
          {!typed && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={busy && skipping}
              onClick={() => {
                setSkipping(true);
                void save({});
              }}
            >
              I&apos;ll add this later
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro title="Critical safety information">
          Every doctor you share with sees this first. It can never be hidden.
        </StepIntro>
        <form id="medical-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <SelectField
            label="Blood type"
            options={BLOOD_TYPE_OPTIONS}
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
          />
          <TextField
            label="Known allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            hint="Drug, food or contact allergies. Separate them with commas."
          />
          <TextField
            label="Implants or devices"
            optional
            value={implants}
            onChange={(e) => setImplants(e.target.value)}
            hint="Separate them with commas."
          />
          {error && (
            <Notice tone="critical" live="assertive">
              {error}
            </Notice>
          )}
        </form>
      </div>
    </PatientShell>
  );
}

export default function MedicalPage() {
  return (
    <SessionReady>
      <MedicalScreen />
    </SessionReady>
  );
}
