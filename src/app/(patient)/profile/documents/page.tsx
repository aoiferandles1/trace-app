"use client";

import { AddLink } from "@/components/patient/AddLink";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { StateMessage } from "@/components/ui/StateMessage";
import { documentCaption, loadSection } from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, SubScreen } from "../../_components/Screens";

async function loadDocuments() {
  return (await loadSection("documents")).data.documents;
}

/**
 * Documents (no board; the owner's Documents decision and BRIEF.md section
 * 7): a list card, each row with the document icon, its name, date and type,
 * opening the document's own screen. Empty: one line and "Upload a
 * document". Uploading is a focused flow without the tab bar.
 */
function DocumentsScreen() {
  const data = useLoad(loadDocuments);
  return (
    <SubScreen title="Documents" titleSize="md" backHref="/profile" backLabel="Back to Profile" tabBar>
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : data.data.length === 0 ? (
          <StateMessage message="No documents yet." action={{ label: "Upload a document", href: "/profile/documents/upload" }} />
        ) : (
          <>
            <Card as="ul" aria-label="Your documents">
              {data.data.map((d) => (
                <li key={d.id}>
                  <ListRow icon="document" title={d.title} caption={documentCaption(d)} chevron href={`/profile/documents/${d.id}`} />
                </li>
              ))}
            </Card>
            <AddLink href="/profile/documents/upload" height={44}>
              Upload a document
            </AddLink>
          </>
        )}
      </div>
    </SubScreen>
  );
}

export default function DocumentsPage() {
  return (
    <SessionReady>
      <DocumentsScreen />
    </SessionReady>
  );
}
