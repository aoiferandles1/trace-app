"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Log appointment (no Figma frame): a past or upcoming visit, or another dated entry. */
function AddAppointmentScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Log appointment"
      backHref="/add"
      footer={<SaveButton form="appointment-form" busy={busy}>Save to my record</SaveButton>}
    >
      <EntryForm formId="appointment-form" variant="appointment" onSaving={setBusy} />
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
