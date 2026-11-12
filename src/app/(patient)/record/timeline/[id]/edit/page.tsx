"use client";

import { useParams, useRouter } from "next/navigation";
import { SessionReady } from "@/components/patient/PatientSession";
import { loadSection } from "@/lib/patient/record";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../../_components/DetailList";
import { EventForm } from "../../../../_components/forms/EventForm";
import { DeleteWithConfirm, SaveButton, useFormScreen } from "../../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../../_components/Screens";

/** Edit or delete a full timeline event (no board; BRIEF.md section 7). */
function EditEventScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formId, busy, formKey, control } = useFormScreen();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    return (await loadSection("full_timeline")).data.events.find((e) => e.id === id) ?? null;
  }, [id]);
  const e = data.status === "ready" ? data.data : null;
  return (
    <SubScreen
      title="Edit timeline"
      titleSize="md"
      backHref={`/record/timeline?event=${id}`}
      backLabel="Back to Timeline"
      footer={e ? <SaveButton form={formId} busy={busy}>Save changes</SaveButton> : undefined}
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !e ? (
        <NotFound what="event" />
      ) : (
        <>
          <EventForm key={`${formKey}-${JSON.stringify(e)}`} {...control} event={e} />
          <div className="px-5 pb-8">
            <DeleteWithConfirm
              label="Delete from timeline"
              title={`Delete ${e.title}?`}
              body="It will be removed from your timeline, with what was prescribed for it. You can't undo this."
              onConfirm={async () => {
                const { error } = await createClient().from("health_events").delete().eq("id", e.id);
                if (error) return false;
                router.replace("/record/timeline");
                return true;
              }}
            />
          </div>
        </>
      )}
    </SubScreen>
  );
}

export default function EditEventPage() {
  return (
    <SessionReady>
      <EditEventScreen />
    </SessionReady>
  );
}
