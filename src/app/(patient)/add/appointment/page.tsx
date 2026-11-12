"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Add a visit (no board; the Add sheet's row): a past or upcoming visit, or another dated entry. */
function AddAppointmentScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Add a visit"
      backHref="/add"
      footer={<SaveButton form={formId} busy={busy}>Save to my record</SaveButton>}
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
