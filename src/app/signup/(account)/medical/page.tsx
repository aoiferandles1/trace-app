"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { BLOOD_TYPE_OPTIONS } from "@/lib/patient/options";
import { splitList } from "@/lib/patient/types";
import { useStepSave } from "../_lib/useStepSave";

/**
 * Sign-up step 4 of 7 (p-medical): critical safety information. Allergies
 * and implants are typed as one line each and saved as lists (split on
 * commas). "I'll add this later" moves on without saving anything.
 */
function MedicalScreen() {
  const { save, busy, error, profile } = useStepSave("medical");
  const [bloodType, setBloodType] = useState(profile.blood_type ?? "");
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [implants, setImplants] = useState(profile.implants.join(", "));
  const [skipping, setSkipping] = useState(false);

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
          <Button type="submit" form="medical-form" size="lg" fullWidth loading={busy && !skipping}>
            Continue
          </Button>
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
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro eyebrow="Medical Basics" tone="red" title="Critical safety information.">
          This is always shown to any doctor you share with — it can never be hidden. Providing this now protects you
          in an emergency.
        </StepIntro>
        <HintStrip tone="danger" icon={<CircleAlert aria-hidden="true" className="size-5 shrink-0" />} >
          This section is pinned to the top of your shared record. Every doctor who views your record will always see
          it — including in emergencies.
        </HintStrip>
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
            placeholder="e.g. Penicillin"
            hint="Include any drug, food, or contact allergies. Separate them with commas."
          />
          <TextField
            label="Implants or devices"
            optional
            value={implants}
            onChange={(e) => setImplants(e.target.value)}
            placeholder="e.g. pacemaker, stent"
          />
          {error && (
            <HintStrip tone="danger" live="assertive">
              {error}
            </HintStrip>
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
