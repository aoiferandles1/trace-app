"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton, useFormScreen } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Log a note (no board; the Add sheet's row). Personal notes are never shared with a doctor. */
function AddNoteScreen() {
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen title="Log a note" backHref="/add" footer={<SaveButton form={formId} busy={busy}>Save note</SaveButton>}>
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
