"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { ConditionForm } from "../../../_components/forms/ConditionForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add a condition (no Figma frame), reached from Ongoing conditions on the record. */
function NewConditionScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add a condition"
      backHref="/record"
      backLabel="Back to Record"
      footer={<SaveButton form="condition-form" busy={busy}>Save condition</SaveButton>}
    >
      <ConditionForm formId="condition-form" onSaving={setBusy} />
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
