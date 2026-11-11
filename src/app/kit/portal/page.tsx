"use client";

import { EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { ConditionCard, conditionTone } from "@/components/patient/ConditionCard";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { HintStrip } from "@/components/ui/HintStrip";
import { LiveBanner, ScopeSummary } from "@/components/portal/LiveBanner";
import { PatientSummaryCard } from "@/components/portal/PatientSummaryCard";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar, portalNavItems } from "@/components/portal/PortalSidebar";
import { SessionNotesPanel, type SessionNotes } from "@/components/portal/SessionNotesPanel";

/**
 * Kit demo: the PortalShell with c-overview's components, static sample data.
 * Compare with the c-overview export at 1440 to 1728 wide, and resize below
 * 1024px to see it stack. Not a real screen (Phase 6 builds /view/session).
 */
export default function KitPortalShell() {
  const [notes, setNotes] = useState<SessionNotes>({ chiefComplaint: "", assessment: "", plan: "", followUp: "" });
  return (
    <PortalShell
      header={<PortalHeader clinician={{ name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" }} />}
      sidebar={
        <PortalSidebar
          patient={{ name: "Jane Doe", initials: "JD", details: "34 · Female · DOB 12 Mar 1991" }}
          items={portalNavItems()}
          active="overview"
        />
      }
      notes={
        <SessionNotesPanel
          notes={notes}
          onChange={setNotes}
          onSave={() => {}}
          onEndSession={() => {}}
          patientFirstName="Jane"
        />
      }
      footer={<PortalFooter />}
    >
      <div className="flex flex-col gap-6 px-4 py-8 sm:px-12">
        <LiveBanner patientName="Jane Doe" timeLeft="24:31" onEndSession={() => {}} />
        <div>
          <h1 className="font-display text-[40px] font-light leading-tight">Overview</h1>
          <p className="mt-1 text-body-tiny text-text-tertiary">34 · Female · Dublin · Active session</p>
        </div>
        <PatientSummaryCard
          name="Jane Doe"
          initials="JD"
          details="34 · Female · DOB 12 Mar 1991 · Dublin"
          figures={[
            { value: "A+", label: "Blood" },
            { value: "3", label: "Conditions" },
            { value: "3", label: "Medications" },
          ]}
        />
        <HintStrip tone="neutral" icon={<EyeOff aria-hidden="true" className="size-4 shrink-0" />}>
          <ScopeSummary
            shared={["Critical safety", "Active conditions", "Medications", "Recent visits (last 3)", "Care team"]}
            notShared={["Mental health", "Documents", "Full timeline", "Insurance"]}
          />
        </HintStrip>
        <CriticalSafetyStrip variant="portal" items={["Penicillin allergy", "A+"]} />
        <div className="grid gap-12 xl:grid-cols-2">
          <section aria-labelledby="conditions-h" className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 id="conditions-h" className="font-display text-[34px] font-light">
                Conditions <span className="text-body-sm text-text-tertiary">3 active</span>
              </h2>
              <Link href="/kit/portal" className="text-label font-medium text-indigo-text">
                View all
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                ["Atrial fibrillation", "managed", "Dr O'Mahony · Cardiology · Dx 2019"],
                ["Hypothyroidism", "ongoing", "Dr Walsh · Endocrinology · Dx 2022"],
                ["Mild asthma", "managed", "Dr Hennessy · GP · since childhood"],
              ].map(([name, status, meta], i) => (
                <li key={name}>
                  <ConditionCard name={name} status={status as "managed" | "ongoing"} meta={meta} colour={conditionTone(i)} />
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="timeline-h" className="flex flex-col gap-3">
            <h2 id="timeline-h" className="font-display text-[34px] font-light">
              Timeline
            </h2>
            <TimelineYear>2026</TimelineYear>
            <TimelineList>
              <TimelineItem
                kind="result"
                date="5 JAN 2026"
                title="Blood test, full blood count and INR"
                meta="Mater Hospital · Ordered by Dr Hennessy"
              />
              <TimelineItem kind="prescription" date="2 JAN 2026" title="Warfarin prescription renewed" meta="Boots, Rathmines" />
            </TimelineList>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
