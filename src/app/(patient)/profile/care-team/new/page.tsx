"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { CareMemberForm } from "../../../_components/forms/CareMemberForm";
import { SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add to the care team (no Figma frame). */
function NewCareMemberScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Add to care team"
      backHref="/profile/care-team"
      backLabel="Back to Care team"
      footer={<SaveButton form={formId} busy={busy}>Save</SaveButton>}
    >
      <CareMemberForm key={formKey} {...control} />
    </SubScreen>
  );
}

export default function NewCareMemberPage() {
  return (
    <SessionReady>
      <NewCareMemberScreen />
    </SessionReady>
  );
}
