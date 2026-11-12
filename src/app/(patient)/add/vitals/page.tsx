"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useBack } from "@/lib/back";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { VitalsForm } from "../../_components/forms/VitalsForm";
import { SubScreen } from "../../_components/Screens";

/** Log vitals (F1; the Add sheet's row and Vitals' "Log vitals"). */
function AddVitalsScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const back = useBack("/record/vitals");
  return (
    <SubScreen title="Log vitals" backHref={back} footer={<SaveButton form={formId} busy={busy}>Save vitals</SaveButton>}>
      <VitalsForm key={formKey} {...control} />
    </SubScreen>
  );
}

export default function AddVitalsPage() {
  return (
    <SessionReady>
      <AddVitalsScreen />
    </SessionReady>
  );
}
