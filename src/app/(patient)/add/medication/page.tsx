"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useSearchParams } from "next/navigation";
import { MedicationForm } from "../../_components/forms/MedicationForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a medication (no Figma frame). */
function AddMedicationScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const fromMeds = useSearchParams().get("from") === "meds";
  return (
    <SubScreen
      title="Add a medication"
      backHref={fromMeds ? "/meds" : "/add"}
      backLabel={fromMeds ? "Back to Medications" : "Back"}
      footer={<SaveButton form={formId} busy={busy}>Save medication</SaveButton>}
    >
      <MedicationForm key={formKey} {...control} />
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
