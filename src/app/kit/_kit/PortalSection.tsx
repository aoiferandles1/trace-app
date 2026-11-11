"use client";

import { useState } from "react";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { HintStrip } from "@/components/ui/HintStrip";
import { LiveBanner, ScopeSummary } from "@/components/portal/LiveBanner";
import { PatientSummaryCard } from "@/components/portal/PatientSummaryCard";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar, portalNavItems } from "@/components/portal/PortalSidebar";
import { SessionNotesPanel, type SaveState, type SessionNotes } from "@/components/portal/SessionNotesPanel";
import { EyeOff } from "lucide-react";
import { KitSection, Specimen, StateLabel } from "./Specimen";

const PATIENT = { name: "Jane Doe", initials: "JD", details: "34 · Female · DOB 12 Mar 1991" };
const EMPTY: SessionNotes = { chiefComplaint: "", assessment: "", plan: "", followUp: "" };

export function PortalSection() {
  const [notes, setNotes] = useState<SessionNotes>(EMPTY);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  return (
    <KitSection
      id="portal"
      title="Clinician portal"
      description="Desktop-first. The sidebar becomes a row of tabs below 1024px. See /kit/portal for them composed in the PortalShell."
    >
      <Specimen title="Header" className="flex flex-col gap-4 overflow-hidden p-0 sm:p-0">
        <PortalHeader />
        <PortalHeader clinician={{ name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" }} />
      </Specimen>

      <Specimen title="Live banner" className="flex flex-col gap-4">
        <LiveBanner patientName="Jane Doe" timeLeft="24:31" onEndSession={() => {}} />
        <LiveBanner patientName="Jane Doe" onEndSession={() => {}} ending />
      </Specimen>

      <Specimen title="Patient summary, scope and critical strip" className="flex flex-col gap-4">
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
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-[256px_1fr]">
        <Specimen title="Sidebar" className="overflow-hidden p-0 sm:p-0">
          <PortalSidebar patient={PATIENT} items={portalNavItems()} active="overview" />
        </Specimen>
        <Specimen title="Sidebar, care team not shared, Timeline active" className="overflow-hidden p-0 sm:p-0">
          <PortalSidebar
            patient={PATIENT}
            items={portalNavItems(["documents", "insurance", "care-team"])}
            active="timeline"
          />
        </Specimen>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <Specimen title="Session notes (live)" className="overflow-hidden p-0 sm:p-0">
          <SessionNotesPanel
            notes={notes}
            onChange={(n) => {
              setNotes(n);
              setSaveState("idle");
            }}
            onSave={() => {
              setSaveState("saving");
              setTimeout(() => setSaveState("saved"), 600);
            }}
            onEndSession={() => {}}
            saveState={saveState}
            patientFirstName="Jane"
          />
        </Specimen>
        <Specimen title="Session notes (save failed)" className="overflow-hidden p-0 sm:p-0">
          <SessionNotesPanel
            notes={{ ...EMPTY, chiefComplaint: "Fatigue for two weeks." }}
            onChange={() => {}}
            onSave={() => {}}
            onEndSession={() => {}}
            saveState="error"
            patientFirstName="Jane"
          />
        </Specimen>
        <Specimen title="Session notes (paused)" className="overflow-hidden p-0 sm:p-0">
          <SessionNotesPanel
            notes={EMPTY}
            onChange={() => {}}
            onSave={() => {}}
            onEndSession={() => {}}
            disabled
            patientFirstName="Jane"
          />
        </Specimen>
      </div>

      <Specimen title="Footer" className="overflow-hidden p-0 sm:p-0">
        <PortalFooter />
        <div className="p-4">
          <StateLabel>Copy changed from Figma; see docs/REVIEW.md.</StateLabel>
        </div>
      </Specimen>
    </KitSection>
  );
}
