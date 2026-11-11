"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useState } from "react";
import { EntryForm } from "../../_components/forms/EntryForm";
import { SaveButton } from "../../_components/forms/FormBits";
import { SubScreen } from "../../_components/Screens";

/** Write a note (no Figma frame). Personal notes are never shared with a doctor. */
function AddNoteScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <SubScreen title="Write a note" backHref="/add" footer={<SaveButton form="note-form" busy={busy}>Save note</SaveButton>}>
      <EntryForm formId="note-form" variant="note" onSaving={setBusy} />
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
