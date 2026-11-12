"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams, useRouter } from "next/navigation";
import { isUuid, type Condition } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import { ConditionForm } from "../../../../_components/forms/ConditionForm";
import { DeleteWithConfirm, SaveButton, useFormScreen } from "../../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";

/** Edit a condition (no Figma frame), with Delete at the bottom as on every Edit form. */
function EditConditionScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("conditions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Condition | null;
  }, [id]);
  const c = data.status === "ready" ? data.data : null;

  return (
    <SubScreen
      title="Edit condition"
      backHref={`/record/conditions/${id}`}
      footer={c ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !c ? (
        <NotFound what="condition" />
      ) : (
        <>
          <ConditionForm key={`${formKey}-${c.updated_at}`} {...control} condition={c} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete condition"
              title="Delete this condition?"
              body="It will be removed from your record. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("conditions").delete().eq("id", c.id);
                if (error) return false;
                router.replace("/record?tab=conditions");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditConditionPage() {
  return (
    <SessionReady>
      <EditConditionScreen />
    </SessionReady>
  );
}
