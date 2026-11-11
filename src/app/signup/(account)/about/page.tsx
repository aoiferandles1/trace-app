"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState, type FormEvent } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { StepIntro } from "@/components/patient/StepIntro";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import { COUNTRIES } from "@/lib/patient/options";
import { useStepSave } from "../_lib/useStepSave";

/** Sign-up step 3 of 7 (p-about): name, date of birth, country. */
function AboutScreen() {
  const { save, busy, error, profile } = useStepSave("about");
  const [first, setFirst] = useState(profile.first_name ?? "");
  const [last, setLast] = useState(profile.last_name ?? "");
  const [dob, setDob] = useState(profile.date_of_birth ?? "");
  const [country, setCountry] = useState(profile.country ?? "Ireland");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = dayKey();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!first.trim()) next.first = "Enter your first name.";
    if (!last.trim()) next.last = "Enter your last name.";
    if (!dob) next.dob = "Enter your date of birth.";
    else if (dob > today || dob < "1900-01-01") next.dob = "Enter a real date of birth, like 12/03/1991.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`about-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    await save({
      first_name: first.trim(),
      last_name: last.trim(),
      date_of_birth: dob,
      country,
    });
  }

  return (
    <PatientShell
      header={<ProgressHeader step={3} />}
      footer={
        <Button type="submit" form="about-form" size="lg" fullWidth loading={busy}>
          Continue
        </Button>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-8">
        <StepIntro eyebrow="About You" title="Tell us a little about yourself.">
          This information helps identify your record and is never shared without your permission.
        </StepIntro>
        <form id="about-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <TextField
            id="about-first"
            label="First name"
            autoComplete="given-name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            hint="As it appears on your medical records"
            error={errors.first}
          />
          <TextField
            id="about-last"
            label="Last name"
            autoComplete="family-name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            hint="As it appears on your medical records"
            error={errors.last}
          />
          <TextField
            id="about-dob"
            label="Date of birth"
            type="date"
            autoComplete="bday"
            min="1900-01-01"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            hint="Used to match your records with your providers"
            error={errors.dob}
          />
          <SelectField
            id="about-country"
            label="Country"
            autoComplete="country-name"
            options={COUNTRIES}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
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

export default function AboutPage() {
  return (
    <SessionReady>
      <AboutScreen />
    </SessionReady>
  );
}
