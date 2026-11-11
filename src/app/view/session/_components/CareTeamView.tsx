"use client";

import { Building2, Pill as PillIcon, Stethoscope } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import type { CareTeamMember } from "../../_lib/api";
import { patientFirstName } from "../../_lib/format";
import { useSectionRecord } from "./SessionContext";
import { EmptyLine, LoadingRecord, PageTitle } from "./RecordBits";

/**
 * Care team (new, no Figma frame; PLAN.md section 8 item 13). Composed from
 * the overview's list cards: one white card per person, GP first, then
 * specialists, then pharmacies (the database's order).
 */
const KIND = {
  gp: { label: "GP", tone: "indigo", icon: <Stethoscope /> },
  specialist: { label: "Specialist", tone: "teal", icon: <Stethoscope /> },
  pharmacy: { label: "Pharmacy", tone: "peach", icon: <PillIcon /> },
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
        <ul className="grid gap-4 xl:grid-cols-2">
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
    <li className="flex items-center gap-4 rounded-pill-tight border border-border-default bg-surface-card px-6 py-5 shadow-card">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-indigo-tint text-indigo-text [&_svg]:size-5"
      >
        {k.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold leading-snug">{member.name}</span>
        {(member.role || member.organisation) && (
          <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
            {member.organisation && <Building2 aria-hidden="true" className="size-3.5 shrink-0" />}
            {[member.role, member.organisation].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <Pill tone={k.tone}>{k.label}</Pill>
    </li>
  );
}
