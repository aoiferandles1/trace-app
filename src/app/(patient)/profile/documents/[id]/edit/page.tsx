"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { TextField } from "@/components/ui/TextField";
import { loadSection, type RecordDocument } from "@/lib/patient/record";
import { isUuid, orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import {
  checkErrors,
  DeleteWithConfirm,
  FormFrame,
  SaveButton,
  saveFailedMessage,
  useFormScreen,
  type FieldErrors,
  type FormControl,
} from "../../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";

/**
 * Edit a document's name and date (F8; no board, the other Edit forms'
 * pattern). The database lets the browser change only these two and the
 * mental health flag (which stays on the document's screen); the file
 * itself never changes. Delete is at the bottom, as on every Edit form.
 */
function EditDocumentScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    return (await loadSection("documents")).data.documents.find((d) => d.id === id) ?? null;
  }, [id]);
  const d = data.status === "ready" ? data.data : null;
  return (
    <SubScreen
      title="Edit document"
      titleSize="md"
      backHref={`/profile/documents/${id}`}
      footer={d ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !d ? (
        <NotFound what="document" />
      ) : (
        <>
          <DocumentForm key={`${formKey}-${d.title}-${d.document_date}`} {...control} document={d} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete document"
              title={`Delete ${d.title}?`}
              body="The file is removed from Trace. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("documents").delete().eq("id", d.id);
                if (error) return false;
                router.replace("/profile/documents");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

function DocumentForm({ formId, onSaving, onSaved, document: d }: FormControl & { document: RecordDocument }) {
  const [title, setTitle] = useState(d.title);
  const [day, setDay] = useState(d.document_date ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { title: `${formId}-title` };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = { title: title.trim() ? undefined : "Give the document a name, like Discharge letter." };
    setErrors(next);
    if (!checkErrors(next, ids)) return;
    onSaving(true);
    setSaveError(null);
    const { error } = await createClient()
      .from("documents")
      .update({ title: title.trim(), document_date: orNull(day) })
      .eq("id", d.id);
    if (error) {
      onSaving(false);
      setSaveError(saveFailedMessage(error));
      return;
    }
    onSaved(`/profile/documents/${d.id}`);
  }

  return (
    <FormFrame id={formId} onSubmit={submit} error={saveError}>
      <TextField id={ids.title} label="Name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} error={errors.title} />
      <TextField label="Date on the document" optional type="date" value={day} onChange={(e) => setDay(e.target.value)} />
    </FormFrame>
  );
}

export default function EditDocumentPage() {
  return (
    <SessionReady>
      <EditDocumentScreen />
    </SessionReady>
  );
}
