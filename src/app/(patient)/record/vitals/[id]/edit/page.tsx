"use client";

import { useParams, useRouter } from "next/navigation";
import { SessionReady } from "@/components/patient/PatientSession";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import { DeleteWithConfirm, SaveButton, useFormScreen } from "../../../../_components/forms/FormBits";
import { VitalsForm, type VitalsRow } from "../../../../_components/forms/VitalsForm";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";

/** Edit or delete a set of vitals (F1). */
function EditVitalsScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("vitals").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as VitalsRow | null;
  }, [id]);
  const v = data.status === "ready" ? data.data : null;
  return (
    <SubScreen
      title="Edit vitals"
      backHref="/record/vitals"
      footer={v ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !v ? (
        <NotFound what="reading" />
      ) : (
        <>
          <VitalsForm key={`${formKey}-${v.updated_at}`} {...control} vitals={v} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete reading"
              title="Delete this reading?"
              body="It will be removed from your record. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("vitals").delete().eq("id", v.id);
                if (error) return false;
                router.replace("/record/vitals");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditVitalsPage() {
  return (
    <SessionReady>
      <EditVitalsScreen />
    </SessionReady>
  );
}
