"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchRow } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { dayKey } from "@/lib/dates";
import { BLOOD_TYPE_OPTIONS, COUNTRIES } from "@/lib/patient/options";
import { orNull, splitList } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, SAVE_FAILED, SaveButton, type FieldErrors } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/**
 * Edit profile (no Figma frame; PLAN.md section 8, item 5): personal details
 * and the critical safety fields, plus the email reminders choice from
 * sign-up. No PPS number (PLAN.md section 11).
 */
function EditProfileScreen() {
  const router = useRouter();
  const { profile, setProfile } = usePatientSession();
  const [busy, setBusy] = useState(false);
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
  const [reminders, setReminders] = useState(profile.email_reminders);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [key]: e.target.value }));
  const today = dayKey();
  const ids = { first_name: "profile-first", last_name: "profile-last", date_of_birth: "profile-dob" };

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
    setBusy(true);
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
        email_reminders: reminders,
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (error || !data) {
      setBusy(false);
      setSaveError(SAVE_FAILED);
      return;
    }
    setProfile(data);
    router.push("/profile/details");
  }

  return (
    <SubScreen
      title="Edit profile"
      backHref="/profile/details"
      backLabel="Back to Your details"
      footer={<SaveButton form="profile-form" busy={busy}>Save changes</SaveButton>}
    >
      <FormFrame id="profile-form" onSubmit={submit} error={saveError}>
        <h2 className="font-display text-heading font-light">Personal details</h2>
        <TextField id={ids.first_name} label="First name" autoComplete="given-name" value={v.first_name} onChange={set("first_name")} error={errors.first_name} />
        <TextField id={ids.last_name} label="Last name" autoComplete="family-name" value={v.last_name} onChange={set("last_name")} error={errors.last_name} />
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
        <TextField label="Sex" optional value={v.sex} onChange={set("sex")} placeholder="e.g. Female" maxLength={40} />
        <TextField label="Phone" optional type="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} placeholder="e.g. +353 86 123 4567" />
        <TextField label="Address" optional autoComplete="street-address" value={v.address} onChange={set("address")} placeholder="e.g. Rathmines, Dublin 6" maxLength={300} />
        <TextField label="Town or city" optional autoComplete="address-level2" value={v.city} onChange={set("city")} placeholder="e.g. Dublin" />
        <SelectField label="Country" autoComplete="country-name" options={COUNTRIES} value={v.country} onChange={set("country")} />

        <h2 id="critical" className="mt-4 font-display text-heading font-light">
          Critical safety
        </h2>
        <p className="-mt-2 text-caption text-ink-2">Always shown first to any doctor you share with.</p>
        <SelectField label="Blood type" options={BLOOD_TYPE_OPTIONS} value={v.blood_type} onChange={set("blood_type")} />
        <TextField
          label="Known allergies"
          optional
          value={v.allergies}
          onChange={set("allergies")}
          placeholder="e.g. Penicillin"
          hint="Separate them with commas."
        />
        <TextField label="Implants or devices" optional value={v.implants} onChange={set("implants")} placeholder="e.g. pacemaker, stent" />

        <h2 className="mt-4 font-display text-heading font-light">Email</h2>
        <SwitchRow
          surface="tile"
          title="Reminders and health tips by email"
          description="Optional. Trace does not send these yet."
          checked={reminders}
          onCheckedChange={setReminders}
        />
      </FormFrame>
    </SubScreen>
  );
}

export default function EditProfilePage() {
  return (
    <SessionReady>
      <EditProfileScreen />
    </SessionReady>
  );
}
