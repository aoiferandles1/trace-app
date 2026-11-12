"use client";

import { useParams, useRouter } from "next/navigation";
import { SessionReady } from "@/components/patient/PatientSession";
import { loadSection } from "@/lib/patient/record";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import { DeleteWithConfirm, SaveButton, useFormScreen } from "../../../../_components/forms/FormBits";
import { RelativeForm } from "../../../../_components/forms/RelativeForm";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";

/** Edit or remove a relative (no board; BRIEF.md 5.7 and section 7). */
function EditRelativeScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    return (await loadSection("family_history")).data.relatives.find((r) => r.id === id) ?? null;
  }, [id]);
  const r = data.status === "ready" ? data.data : null;
  return (
    <SubScreen
      title={r ? `Edit ${r.label}` : "Edit relative"}
      titleSize="md"
      backHref={`/record/family?relative=${id}`}
      backLabel="Back to Family history"
      footer={r ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !r ? (
        <NotFound what="relative" />
      ) : (
        <>
          <RelativeForm key={`${formKey}-${JSON.stringify(r)}`} {...control} relative={r} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Remove relative"
              title={`Remove ${r.label}?`}
              body="They and their conditions will be removed from your family history. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("relatives").delete().eq("id", r.id);
                if (error) return false;
                router.replace("/record/family");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditRelativePage() {
  return (
    <SessionReady>
      <EditRelativeScreen />
    </SessionReady>
  );
}
