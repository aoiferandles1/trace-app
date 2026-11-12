"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useBack } from "@/lib/back";
import { EventForm } from "../../../_components/forms/EventForm";
import { SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

/** Add to the full timeline (no board; BRIEF.md section 7). */
function NewEventScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const back = useBack("/record/timeline");
  return (
    <SubScreen
      title="Add to your timeline"
      titleSize="md"
      backHref={back}
      backLabel="Back"
      footer={<SaveButton form={formId} busy={busy}>Save to timeline</SaveButton>}
    >
      <EventForm key={formKey} {...control} />
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
