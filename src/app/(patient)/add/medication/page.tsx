"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { MedicationForm } from "../../_components/forms/MedicationForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a medication (no Figma frame). */
function AddMedicationScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add a medication"
      backHref="/add"
      footer={<SaveButton form="medication-form" busy={busy}>Save medication</SaveButton>}
    >
      <MedicationForm formId="medication-form" onSaving={setBusy} />
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
