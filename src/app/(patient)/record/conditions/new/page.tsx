"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { ConditionForm } from "../../../_components/forms/ConditionForm";
import { SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add a condition (no Figma frame), reached from Ongoing conditions on the record. */
function NewConditionScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Add a condition"
      backHref="/record?tab=conditions"
      backLabel="Back to Record"
      footer={<SaveButton form={formId} busy={busy}>Save condition</SaveButton>}
    >
      <ConditionForm key={formKey} {...control} />
    </SubScreen>
  );
}

export default function NewConditionPage() {
  return (
    <SessionReady>
      <NewConditionScreen />
    </SessionReady>
  );
}
