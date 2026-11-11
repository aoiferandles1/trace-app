"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useId, useState } from "react";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Log a note (no board; the Add sheet's row). Personal notes are never shared with a doctor. */
function AddNoteScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen title="Log a note" backHref="/add" footer={<SaveButton form={formId} busy={busy}>Save note</SaveButton>}>
      <EntryForm formId={formId} variant="note" onSaving={setBusy} />
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
