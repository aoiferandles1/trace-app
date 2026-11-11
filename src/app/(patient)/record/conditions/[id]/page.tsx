"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HintStrip } from "@/components/ui/HintStrip";
import { Pill } from "@/components/ui/Pill";
import { isUuid, type Condition } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DetailList, NotFound } from "../../../_components/DetailList";
import { DeleteWithConfirm } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/** Condition detail (no Figma frame; PLAN.md section 8, item 4). */
function ConditionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    const { data, error } = await createClient().from("conditions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Condition | null;
  }, [id]);
  const c = data.status === "ready" ? data.data : null;

  return (
    <SubScreen title="Condition" backHref="/record" backLabel="Back to Record">
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !c ? (
        <NotFound what="condition" />
      ) : (
        <div className="flex flex-col gap-5 px-4 pb-8 pt-2">
          <Card padding="lg" className="flex flex-col gap-3">
            <Pill tone={c.status === "resolved" ? "neutral" : "indigo"} size="md">
              {c.status}
            </Pill>
            <h2 className="text-h3 font-medium">{c.name}</h2>
            <DetailList
              rows={[
                ...(c.clinician ? [{ label: "Doctor", value: c.clinician }] : []),
                ...(c.specialty ? [{ label: "Specialty", value: c.specialty }] : []),
                ...(c.diagnosed_year || c.diagnosed_note
                  ? [{ label: "Diagnosed", value: c.diagnosed_year ? String(c.diagnosed_year) : c.diagnosed_note! }]
                  : []),
              ]}
            />
          </Card>
          {c.is_mental_health && (
            <HintStrip tone="indigo">About mental health. Left out of a share unless you include mental health.</HintStrip>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ButtonLink href={`/record/conditions/${c.id}/edit`} variant="secondary" iconLeft={<Pencil aria-hidden="true" className="size-4" />}>
              Edit
            </ButtonLink>
            <DeleteWithConfirm
              label="Delete condition"
              title="Delete this condition?"
              body="It will be removed from your record. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("conditions").delete().eq("id", c.id);
                if (error) return false;
                router.replace("/record");
                return true;
              }}
            />
          </div>
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
