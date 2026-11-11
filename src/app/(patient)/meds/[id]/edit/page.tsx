"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { isUuid, medicationName, type Medication } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { DeleteWithConfirm, SaveButton } from "../../../_components/forms/FormBits";
import { MedicationForm } from "../../../_components/forms/MedicationForm";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/**
 * Edit a medication (no Figma frame). To stop one, set "Ends or ended"; it
 * then moves to the Expired tab. Delete is for mistakes.
 */
function EditMedicationScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("medications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Medication | null;
  }, [id]);
  const m = data.status === "ready" ? data.data : null;

  return (
    <SubScreen
      title="Edit medication"
      backHref="/meds"
      backLabel="Back to My medication"
      footer={m ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="medication" />
      ) : (
        <>
          <MedicationForm formId={formId} medication={m} onSaving={setBusy} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete medication"
              title={`Delete ${medicationName(m)}?`}
              body="It will be removed from your record. To show you stopped taking it, set an end date instead."
              onConfirm={async () => {
                const { error } = await createClient().from("medications").delete().eq("id", m.id);
                if (error) return false;
                router.replace("/meds");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditMedicationPage() {
  return (
    <SessionReady>
      <EditMedicationScreen />
    </SessionReady>
  );
}
