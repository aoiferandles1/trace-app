"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { CareMemberForm } from "../../../_components/forms/CareMemberForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add to the care team (no Figma frame). */
function NewCareMemberScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add to care team"
      backHref="/profile"
      backLabel="Back to My profile"
      footer={<SaveButton form="care-form" busy={busy}>Save</SaveButton>}
    >
      <CareMemberForm formId="care-form" onSaving={setBusy} />
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
