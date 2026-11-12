"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useSearchParams } from "next/navigation";
import { useBack } from "@/lib/back";
import { MedicationForm } from "../../_components/forms/MedicationForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a medication (no Figma frame). */
function AddMedicationScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const fromMeds = useSearchParams().get("from") === "meds";
  const back = useBack(fromMeds ? "/meds" : "/add");
  return (
    <SubScreen
      title="Add a medication"
      backHref={back}
      backLabel="Back"
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
