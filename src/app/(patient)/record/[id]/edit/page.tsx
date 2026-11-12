"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams, useRouter } from "next/navigation";
import { isUuid, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { EntryForm, type ResultInput } from "../../../_components/forms/EntryForm";
import { DeleteWithConfirm, SaveButton, useFormScreen } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/**
 * Edit an entry (no Figma frame), with Delete at the bottom as on every
 * other Edit form. Session notes cannot be edited here.
 */
function EditEntryScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const supabase = createClient();
    const [entry, results] = await Promise.all([
      supabase.from("entries").select("*").eq("id", id).maybeSingle(),
      supabase.from("result_values").select("id, name, value, unit, ref_low, ref_high").eq("entry_id", id).order("position"),
    ]);
    if (entry.error) throw entry.error;
    if (results.error) throw results.error;
    return entry.data ? { entry: entry.data as Entry, results: (results.data ?? []) as ResultInput[] } : null;
  }, [id]);
  const found = data.status === "ready" ? data.data : null;
  const entry = found?.entry ?? null;
  const editable = entry && entry.kind !== "session_notes";

  return (
    <SubScreen
      title={entry?.kind === "note" ? "Edit note" : "Edit entry"}
      backHref={`/record/${id}`}
      footer={editable ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !editable || !found ? (
        <NotFound what="entry" />
      ) : (
        <>
          <EntryForm
            key={`${formKey}-${entry.updated_at}-${JSON.stringify(found.results)}`}
            {...control}
            variant={entry.kind === "note" ? "note" : "appointment"}
            entry={entry}
            results={found.results}
          />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label={entry.kind === "note" ? "Delete note" : "Delete entry"}
              title={entry.kind === "note" ? "Delete this note?" : "Delete this entry?"}
              body="It will be removed from your record. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("entries").delete().eq("id", entry.id);
                if (error) return false;
                router.replace("/record");
                return true;
              }}
            />
          </div>
        </>
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
