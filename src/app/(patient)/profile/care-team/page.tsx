"use client";

import Link from "next/link";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { loadSection } from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, SubScreen } from "../../_components/Screens";

const KIND_LABEL = { gp: "GP", specialist: "Specialist", pharmacy: "Pharmacy" } as const;

/**
 * Care team (Profile's row; no board): GP first, then specialists, then
 * pharmacies, as my_record('care_team') orders them. Each opens its edit
 * screen; "Add to your care team" at the end.
 */
function CareTeamScreen() {
  const data = useLoad(() => loadSection("care_team"));
  return (
    <SubScreen title="Care team" backHref="/profile" backLabel="Back to Profile" tabBar>
      <div className="flex flex-col gap-1 px-5 pb-6 pt-2">
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : data.data.data.care_team.length === 0 ? (
          <p className="py-2 text-body text-ink-2">No one on your care team yet.</p>
        ) : (
          <Card as="ul">
            {data.data.data.care_team.map((m) => (
              <li key={m.id}>
                <ListRow
                  title={m.name}
                  caption={[m.role, m.organisation ?? KIND_LABEL[m.kind]].filter(Boolean).join(", ")}
                  chevron
                  href={`/profile/care-team/${m.id}`}
                />
              </li>
            ))}
          </Card>
        )}
        <Link
          href="/profile/care-team/new"
          className="flex min-h-12 w-fit items-center gap-2 text-label font-semibold text-accent transition-colors duration-150 ease-out hovered:text-accent-alt"
        >
          <Icon name="plus" size={20} strokeWidth={2.25} />
          Add to your care team
        </Link>
      </div>
    </SubScreen>
  );
}

export default function CareTeamPage() {
  return (
    <SessionReady>
      <CareTeamScreen />
    </SessionReady>
  );
}
