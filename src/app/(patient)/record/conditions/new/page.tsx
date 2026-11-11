"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useId, useState } from "react";
import { ConditionForm } from "../../../_components/forms/ConditionForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add a condition (no Figma frame), reached from Ongoing conditions on the record. */
function NewConditionScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add a condition"
      backHref="/record?tab=conditions"
      backLabel="Back to Record"
      footer={<SaveButton form={formId} busy={busy}>Save condition</SaveButton>}
    >
      <ConditionForm formId={formId} onSaving={setBusy} />
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
