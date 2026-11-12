"use client";

import { useState, type FormEvent } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import { BLOOD_TYPE_OPTIONS, COUNTRIES } from "@/lib/patient/options";
import { orNull, splitList, type Profile } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import {
  checkErrors,
  FormFrame,
  SaveButton,
  saveFailedMessage,
  useFormScreen,
  type FieldErrors,
  type FormControl,
} from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/**
 * Edit details (no Figma frame; PLAN.md section 8, item 5): personal details
 * and the critical safety fields. No PPS number (PLAN.md section 11). The
 * email reminders switch is gone: Trace sends no reminders (the column stays).
 */
function EditProfileScreen() {
  const { profile } = usePatientSession();
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Edit details"
      backHref="/profile/details"
      backLabel="Back to Your details"
      footer={
        <SaveButton form={formId} busy={busy}>
          Save changes
        </SaveButton>
      }
    >
      <ProfileForm key={`${formKey}-${profile.updated_at}`} {...control} profile={profile} />
    </SubScreen>
  );
}

function ProfileForm({ formId, onSaving, onSaved, profile }: FormControl & { profile: Profile }) {
  const { setProfile } = usePatientSession();
  const [v, setV] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    date_of_birth: profile.date_of_birth ?? "",
    sex: profile.sex ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "Ireland",
    blood_type: profile.blood_type ?? "",
    allergies: profile.allergies.join(", "),
    implants: profile.implants.join(", "),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [key]: e.target.value }));
  const today = dayKey();
  const ids = {
    first_name: `${formId}-first`,
    last_name: `${formId}-last`,
    date_of_birth: `${formId}-dob`,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      first_name: v.first_name.trim() ? undefined : "Enter your first name.",
      last_name: v.last_name.trim() ? undefined : "Enter your last name.",
      date_of_birth:
        v.date_of_birth && (v.date_of_birth > today || v.date_of_birth < "1900-01-01")
          ? "Enter a real date of birth, like 12/03/1991."
          : undefined,
    };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { data, error } = await createClient()
      .from("profiles")
      .update({
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        date_of_birth: orNull(v.date_of_birth),
        sex: orNull(v.sex),
        phone: orNull(v.phone),
        address: orNull(v.address),
        city: orNull(v.city),
        country: orNull(v.country),
        blood_type: orNull(v.blood_type),
        allergies: splitList(v.allergies),
        implants: splitList(v.implants),
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (error || !data) {
      onSaving(false);
      setSaveError(saveFailedMessage(error));
      return;
    }
    setProfile(data);
    onSaved("/profile/details");
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <h2 className="font-display text-heading font-light">Personal details</h2>
      <TextField
        id={ids.first_name}
        label="First name"
        autoComplete="given-name"
        maxLength={100}
        value={v.first_name}
        onChange={set("first_name")}
        error={errors.first_name}
      />
      <TextField
        id={ids.last_name}
        label="Last name"
        autoComplete="family-name"
        maxLength={100}
        value={v.last_name}
        onChange={set("last_name")}
        error={errors.last_name}
      />
      <TextField
        id={ids.date_of_birth}
        label="Date of birth"
        type="date"
        optional
        min="1900-01-01"
        max={today}
        value={v.date_of_birth}
        onChange={set("date_of_birth")}
        error={errors.date_of_birth}
      />
      <TextField label="Sex" optional value={v.sex} onChange={set("sex")} maxLength={40} />
      <TextField label="Phone" optional type="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} maxLength={40} />
      <TextField label="Address" optional autoComplete="street-address" value={v.address} onChange={set("address")} maxLength={300} />
      <TextField label="Town or city" optional autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={100} />
      <SelectField label="Country" autoComplete="country-name" options={COUNTRIES} value={v.country} onChange={set("country")} />

      <h2 id="critical" className="mt-4 font-display text-heading font-light">
        Critical safety
      </h2>
      <p className="-mt-2 text-caption text-ink-2">Always shown first to any doctor you share with.</p>
      <SelectField label="Blood type" options={BLOOD_TYPE_OPTIONS} value={v.blood_type} onChange={set("blood_type")} />
      <TextField label="Known allergies" optional value={v.allergies} onChange={set("allergies")} hint="Separate them with commas." />
      <TextField label="Implants or devices" optional value={v.implants} onChange={set("implants")} hint="Separate them with commas." />
    </FormFrame>
  );
}

export default function EditProfilePage() {
  return (
    <SessionReady>
      <EditProfileScreen />
    </SessionReady>
  );
}
