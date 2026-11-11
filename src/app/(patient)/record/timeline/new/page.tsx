"use client";

import { useId, useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { EventForm } from "../../../_components/forms/EventForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add to the full timeline (no board; BRIEF.md section 7). */
function NewEventScreen() {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen
      title="Add to your timeline"
      titleSize="md"
      backHref="/record/timeline"
      backLabel="Back to Timeline"
      footer={<SaveButton form={formId} busy={busy}>Save to timeline</SaveButton>}
    >
      <EventForm formId={formId} onSaving={setBusy} />
    </SubScreen>
  );
}

export default function NewEventPage() {
  return (
    <SessionReady>
      <NewEventScreen />
    </SessionReady>
  );
}
