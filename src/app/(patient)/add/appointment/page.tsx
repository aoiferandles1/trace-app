"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useId, useState } from "react";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Log appointment (no Figma frame): a past or upcoming visit, or another dated entry. */
function AddAppointmentScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Log appointment"
      backHref="/add"
      footer={<SaveButton form={formId} busy={busy}>Save to my record</SaveButton>}
    >
      <EntryForm formId={formId} variant="appointment" onSaving={setBusy} />
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
