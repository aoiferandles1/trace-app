"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { RelativeForm } from "../../../_components/forms/RelativeForm";
import { SubScreen } from "../../../_components/Screens";

/** Add a relative (no board; BRIEF.md 5.7 and section 7). */
function NewRelativeScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Add a relative"
      titleSize="md"
      backHref="/record/family"
      backLabel="Back to Family history"
      footer={<SaveButton form={formId} busy={busy}>Save relative</SaveButton>}
    >
      <RelativeForm key={formKey} {...control} />
    </SubScreen>
  );
}

export default function NewRelativePage() {
  return (
    <SessionReady>
      <NewRelativeScreen />
    </SessionReady>
  );
}
