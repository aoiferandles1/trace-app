"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { isUuid, type Medication } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { DeleteWithConfirm, SaveButton } from "../../../_components/forms/FormBits";
import { MedicationForm } from "../../../_components/forms/MedicationForm";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/**
 * Edit a medication (no board; BRIEF.md section 7). To stop one, set "Ends
 * or ended"; it then moves to Past. Delete, a critical text button with a
 * confirm sheet, is for mistakes.
 */
function EditMedicationScreen() {
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const formId = useId();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const supabase = createClient();
    const [med, periods] = await Promise.all([
      supabase.from("medications").select("*").eq("id", id).maybeSingle(),
      supabase.from("medication_periods").select("id", { count: "exact", head: true }).eq("medication_id", id),
    ]);
    if (med.error) throw med.error;
    if (periods.error) throw periods.error;
    return med.data ? { medication: med.data as Medication, hasPeriods: (periods.count ?? 0) > 0 } : null;
  }, [id]);
  const found = data.status === "ready" ? data.data : null;
  const m = found?.medication ?? null;

  return (
    <SubScreen
      title="Edit medication"
      backHref={`/meds/${id}`}
      backLabel={m ? `Back to ${m.name}` : "Back"}
      footer={m ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !m ? (
        <NotFound what="medication" />
      ) : (
        <>
          <MedicationForm formId={formId} medication={m} hasPeriods={found?.hasPeriods} onSaving={setBusy} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete medication"
              title={`Delete ${m.name}?`}
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
