"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { isUuid, type CareMember } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { CareMemberForm } from "../../../_components/forms/CareMemberForm";
import { DeleteWithConfirm, SaveButton } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/** Edit or remove someone on the care team (no Figma frame). */
function EditCareMemberScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("care_team").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as CareMember | null;
  }, [id]);
  const m = data.status === "ready" ? data.data : null;

  return (
    <SubScreen
      title="Care team"
      backHref="/profile/care-team"
      backLabel="Back to Care team"
      footer={m ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="person" />
      ) : (
        <>
          <CareMemberForm formId={formId} member={m} onSaving={setBusy} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Remove from care team"
              title={`Remove ${m.name}?`}
              body="They will be removed from your care team. Nothing else in your record changes."
              onConfirm={async () => {
                const { error } = await createClient().from("care_team").delete().eq("id", m.id);
                if (error) return false;
                router.replace("/profile/care-team");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditCareMemberPage() {
  return (
    <SessionReady>
      <EditCareMemberScreen />
    </SessionReady>
  );
}
