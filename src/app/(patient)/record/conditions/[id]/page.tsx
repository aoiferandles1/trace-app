"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { useParams } from "next/navigation";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { capitalise } from "@/lib/patient/record";
import { isUuid, type Condition } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DetailList, NotFound } from "../../../_components/DetailList";
import { MENTAL_HEALTH_LINE } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";
import { RecordPanel } from "../../_components/RecordPanel";

/**
 * Condition detail (no board): the visit detail's pattern (BRIEF.md 5.9).
 * The condition as the title, a caption ("Managed, since 2019", the
 * portal's Overview line), labelled blocks, and the pencil in the header for
 * Edit, where "Delete condition" is (as on every Edit form).
 */
function ConditionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("conditions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Condition | null;
  }, [id]);
  const c = data.status === "ready" ? data.data : null;

  return (
    <SubScreen
      title={c?.name ?? "Condition"}
      titleSize="md"
      backHref="/record?tab=conditions"
      backLabel="Back to Record"
      action={c ? <IconLink href={`/record/conditions/${c.id}/edit`} label={`Edit ${c.name}`} icon="pencil" size={32} /> : undefined}
      tabBar
      aside={<RecordPanel level={2} initialTab="conditions" current={id} syncUrl={false} />}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !c ? (
        <NotFound what="condition" />
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-6 pt-3.5">
          <p className="-mt-1.5 text-body text-ink-2">
            {[capitalise(c.status), c.diagnosed_year ? `since ${c.diagnosed_year}` : c.diagnosed_note].filter(Boolean).join(", ")}
          </p>
          {(c.clinician || c.specialty) && (
            <DetailList
              rows={[
                ...(c.clinician ? [{ label: "Doctor", value: c.clinician }] : []),
                ...(c.specialty ? [{ label: "Specialty", value: c.specialty }] : []),
              ]}
            />
          )}
          {c.is_mental_health && (
            <Notice tone="neutral">{MENTAL_HEALTH_LINE}</Notice>
          )}
        </div>
      )}
    </SubScreen>
  );
}

export default function ConditionDetailPage() {
  return (
    <SessionReady>
      <ConditionDetailScreen />
    </SessionReady>
  );
}
