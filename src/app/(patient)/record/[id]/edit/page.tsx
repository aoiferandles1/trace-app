"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams } from "next/navigation";
import { useId, useState } from "react";
import { isUuid, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { EntryForm } from "../../../_components/forms/EntryForm";
import { SaveButton } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/** Edit an entry (no Figma frame). Session notes cannot be edited here. */
function EditEntryScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("entries").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Entry | null;
  }, [id]);
  const entry = data.status === "ready" ? data.data : null;
  const editable = entry && entry.kind !== "session_notes";

  return (
    <SubScreen
      title={entry?.kind === "note" ? "Edit note" : "Edit entry"}
      backHref={`/record/${id}`}
      footer={editable ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !editable ? (
        <NotFound what="entry" />
      ) : (
        <EntryForm formId={formId} variant={entry.kind === "note" ? "note" : "appointment"} entry={entry} onSaving={setBusy} />
      )}
    </SubScreen>
  );
}

export default function EditEntryPage() {
  return (
    <SessionReady>
      <EditEntryScreen />
    </SessionReady>
  );
}
