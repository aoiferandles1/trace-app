"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useId, useState } from "react";
import { MedicationForm } from "../../_components/forms/MedicationForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a medication (no Figma frame). */
function AddMedicationScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add a medication"
      backHref="/add"
      footer={<SaveButton form={formId} busy={busy}>Save medication</SaveButton>}
    >
      <MedicationForm formId={formId} onSaving={setBusy} />
    </SubScreen>
  );
}

export default function AddMedicationPage() {
  return (
    <SessionReady>
      <AddMedicationScreen />
    </SessionReady>
  );
}
