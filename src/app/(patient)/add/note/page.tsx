"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useBack } from "@/lib/back";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Log a note (no board; the Add sheet's row). Personal notes are never shared with a doctor. */
function AddNoteScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  const back = useBack("/add");
  return (
    <SubScreen title="Log a note" backHref={back} footer={<SaveButton form={formId} busy={busy}>Save note</SaveButton>}>
      <EntryForm key={formKey} {...control} variant="note" />
    </SubScreen>
  );
}

export default function AddNotePage() {
  return (
    <SessionReady>
      <AddNoteScreen />
    </SessionReady>
  );
}
