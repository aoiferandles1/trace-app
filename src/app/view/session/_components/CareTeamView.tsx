"use client";

import { Avatar } from "@/components/ui/Card";
import { initialsOf } from "@/lib/format";
import type { CareTeamMember } from "../../_lib/api";
import { patientFirstName } from "../../_lib/format";
import { useSectionRecord } from "./SessionContext";
import { EmptyLine, LoadingRecord, PageTitle } from "./RecordBits";

/**
 * Care team (BRIEF.md 6.8, after PortalRecordE's care team): a two-column
 * grid of people, each a 52px tinted avatar, the name with their kind, and
 * the role and organisation. GP first, then specialists, then pharmacies
 * (the database's order).
 */
const KIND = {
  gp: { label: "GP" },
  specialist: { label: "Specialist" },
  pharmacy: { label: "Pharmacy" },
} as const;

export function CareTeamView() {
  const record = useSectionRecord("care_team");
  if (!record) return <LoadingRecord />;
  const first = patientFirstName(record.patient);
  const team = record.care_team;
  return (
    <>
      <PageTitle title="Care team" meta={team ? `The people ${first} sees for their care` : undefined} />
      {!team ? (
        <EmptyLine>{first} did not share their care team for this visit.</EmptyLine>
      ) : team.length === 0 ? (
        <EmptyLine>No care team recorded.</EmptyLine>
      ) : (
        <ul className="grid gap-x-12 gap-y-8 xl:grid-cols-2">
          {team.map((m) => (
            <Member key={m.id} member={m} />
          ))}
        </ul>
      )}
    </>
  );
}

function Member({ member }: { member: CareTeamMember }) {
  const k = KIND[member.kind] ?? KIND.gp;
  return (
    <li className="flex items-center gap-4">
      <Avatar initials={initialsOf(member.name)} size={52} tone="tint" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-row-lg font-medium">
          {member.name} <span className="text-caption font-normal text-ink-2">{k.label}</span>
        </span>
        {(member.role || member.organisation) && (
          <span className="text-caption text-ink-2">{[member.role, member.organisation].filter(Boolean).join(", ")}</span>
        )}
      </span>
    </li>
  );
}
