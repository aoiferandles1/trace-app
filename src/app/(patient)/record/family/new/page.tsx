"use client";

import { useId, useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { SaveButton } from "../../../_components/forms/FormBits";
import { RelativeForm } from "../../../_components/forms/RelativeForm";
import { SubScreen } from "../../../_components/Screens";

/** Add a relative (no board; BRIEF.md 5.7 and section 7). */
function NewRelativeScreen() {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add a relative"
      titleSize="md"
      backHref="/record/family"
      backLabel="Back to Family history"
      footer={<SaveButton form={formId} busy={busy}>Save relative</SaveButton>}
    >
      <RelativeForm formId={formId} onSaving={setBusy} />
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
