"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useId, useState } from "react";
import { CareMemberForm } from "../../../_components/forms/CareMemberForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add to the care team (no Figma frame). */
function NewCareMemberScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add to care team"
      backHref="/profile"
      backLabel="Back to My profile"
      footer={<SaveButton form={formId} busy={busy}>Save</SaveButton>}
    >
      <CareMemberForm formId={formId} onSaving={setBusy} />
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
