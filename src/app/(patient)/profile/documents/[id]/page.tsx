"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { SwitchRow } from "@/components/ui/Switch";
import { documentCaption, formatBytes, loadSection, type RecordDocument } from "@/lib/patient/record";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { NotFound } from "../../../_components/DetailList";
import { MENTAL_HEALTH_LINE } from "../../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../../_components/Screens";

/**
 * One document (no board; BRIEF.md section 7): its name, date, type and
 * size; "Open" (a photo) or "Download" (a PDF), which fetches the file from
 * /api/documents/<id> in a new tab, so it is never drawn into the app; the
 * mental health flag. The pencil opens Edit (name, date, Delete).
 */
function DocumentScreen() {
  const { id } = useParams<{ id: string }>();
  const data = useLoad(async () => {
    if (!isUuid(id)) return null;
    return (await loadSection("documents")).data.documents.find((d) => d.id === id) ?? null;
  }, [id]);
  const d = data.status === "ready" ? data.data : null;
  return (
    <SubScreen
      title={d?.title ?? "Document"}
      titleSize="md"
      backHref="/profile/documents"
      backLabel="Back to Documents"
      action={d ? <IconLink href={`/profile/documents/${d.id}/edit`} label={`Edit ${d.title}`} icon="pencil" size={32} /> : undefined}
      tabBar
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : !d ? (
        <NotFound what="document" />
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-6 pt-3.5">
          <p className="-mt-1.5 text-body text-ink-2">
            {documentCaption(d)}, {formatBytes(d.byte_size)}
          </p>
          <ButtonLink
            href={`/api/documents/${d.id}`}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            size="lg"
            fullWidth
            iconLeft={<Icon name={d.content_type === "application/pdf" ? "download" : "external"} size={20} />}
          >
            {d.content_type === "application/pdf" ? "Download" : "Open"}
            <span className="sr-only"> (opens in a new tab)</span>
          </ButtonLink>
          <MentalHealthToggle key={String(d.is_mental_health)} document={d} />
        </div>
      )}
    </SubScreen>
  );
}

function MentalHealthToggle({ document: d }: { document: RecordDocument }) {
  const [on, setOn] = useState(d.is_mental_health);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <SwitchRow
        surface="tile"
        title="About mental health"
        description={MENTAL_HEALTH_LINE}
        checked={on}
        onCheckedChange={async (next) => {
          setOn(next);
          setFailed(false);
          const { error } = await createClient().from("documents").update({ is_mental_health: next }).eq("id", d.id);
          if (error) {
            setOn(!next);
            setFailed(true);
          }
        }}
      />
      {failed && (
        <Notice tone="critical" live="assertive">
          This couldn&apos;t be saved. Check your connection and try again.
        </Notice>
      )}
    </div>
  );
}

export default function DocumentPage() {
  return (
    <SessionReady>
      <DocumentScreen />
    </SessionReady>
  );
}
