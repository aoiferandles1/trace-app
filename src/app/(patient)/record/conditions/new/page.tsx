"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useBack } from "@/lib/back";
import { ConditionForm } from "../../../_components/forms/ConditionForm";
import { SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add a condition (no Figma frame), reached from Ongoing conditions on the record. */
function NewConditionScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const back = useBack("/record?tab=conditions");
  return (
    <SubScreen
      title="Add a condition"
      backHref={back}
      backLabel="Back"
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
