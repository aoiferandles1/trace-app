"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { MedicationForm } from "../../_components/forms/MedicationForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a medication (no Figma frame). */
function AddMedicationScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const fromMeds = useSearchParams().get("from") === "meds";
  return (
    <SubScreen
      title="Add a medication"
      backHref={fromMeds ? "/meds" : "/add"}
      backLabel={fromMeds ? "Back to Medications" : "Back"}
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
