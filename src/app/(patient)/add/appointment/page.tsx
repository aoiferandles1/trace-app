"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useBack } from "@/lib/back";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a visit (no board; the Add sheet's row): a past or upcoming visit, or another dated entry. */
function AddAppointmentScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const back = useBack("/add");
  return (
    <SubScreen
      title="Add a visit"
      backHref={back}
      footer={<SaveButton form={formId} busy={busy}>Save visit</SaveButton>}
    >
      <EntryForm key={formKey} {...control} variant="appointment" />
    </SubScreen>
  );
}

export default function AddAppointmentPage() {
  return (
    <SessionReady>
      <AddAppointmentScreen />
    </SessionReady>
  );
}
