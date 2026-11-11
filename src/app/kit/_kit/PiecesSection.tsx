"use client";

import { useState } from "react";
import { AccessRequestDetails } from "@/components/patient/AccessRequestDetails";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { LiveShareBanner } from "@/components/patient/LiveShareBanner";
import { MedicationCard } from "@/components/patient/MedicationCard";
import { QuickActionTile } from "@/components/patient/QuickActionTile";
import { SessionStatusRow, SharedSummaryCard } from "@/components/patient/SharedSummaryCard";
import { ShareTodayCard } from "@/components/patient/ShareTodayCard";
import { StatTile } from "@/components/patient/StatTile";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { PatientSummaryCard } from "@/components/portal/PatientSummaryCard";
import { StepRow, StepRows } from "@/components/portal/PortalSplit";
import { RailDivider, RailItem, RailNotShared } from "@/components/portal/Rail";
import { SessionNotesPanel, type SessionNotes } from "@/components/portal/SessionNotesPanel";
import { BannerCard } from "@/components/ui/BannerCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";
import { DetailBlocks } from "./DetailBlocks";
import { KitSection, Specimen } from "./Specimen";

export function SheetsSection() {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const answer = (a: string) => {
    setLastAnswer(a);
    setOpen(false);
  };
  return (
    <KitSection
      id="sheets"
      title="Bottom sheet"
      description="A modal <dialog>: white, 28px top corners, a 40 x 4 handle, a 36px close button, the scrim behind, at most 75% of the screen tall. Focus moves in, Tab wraps inside, Escape closes (unless the sheet must be answered), focus returns to the opener."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Access request (ApproveA2)" note="Must be answered: no close button, Escape does nothing. Allow is filled; Deny is a 44px text button.">
          <div className="flex flex-col items-start gap-3">
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Open the access request
            </Button>
            <p role="status" className="text-caption text-ink-2">
              {lastAnswer && `Last answer: ${lastAnswer}`}
            </p>
          </div>
          <BottomSheet
            open={open}
            onClose={() => setOpen(false)}
            dismissible={false}
            eyebrow="Access request"
            title="Dr Hennessy wants access"
            actions={
              <>
                <Button size="lg" fullWidth onClick={() => answer("allowed")}>
                  Allow access
                </Button>
                <Button variant="text" className="px-4" onClick={() => answer("denied")}>
                  Deny
                </Button>
              </>
            }
          >
            <AccessRequestDetails
              clinician={{ name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" }}
              duration="30 min"
              shared={["Safety info", "Medications", "Conditions", "Recent visits", "Care team", "Can add session notes"]}
              notIncluded="Full timeline, Documents, Family history, Insurance, Mental health"
            />
            <p className="text-caption text-ink-2">Name and practice are as typed. Trace does not check them.</p>
          </BottomSheet>
        </Specimen>
        <Specimen title="Timeline entry (TimelineA2)" note="Dismissible: close button, Escape and the scrim close it.">
          <Button variant="secondary" onClick={() => setTimeline(true)}>
            Open a timeline entry
          </Button>
          <BottomSheet open={timeline} onClose={() => setTimeline(false)} title="Chest infection">
            <p className="-mt-3.5 text-caption text-ink-2">Aug 2026, Infection</p>
            <DetailBlocks />
          </BottomSheet>
        </Specimen>
      </div>
    </KitSection>
  );
}

export function PatientPiecesSection() {
  const [expanded, setExpanded] = useState(true);
  return (
    <KitSection
      id="patient"
      title="Patient pieces"
      description="Components the current patient screens use, in the new look. Phases 2 to 6 rebuild each screen against its board."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Today card (MainA2)" width="phone">
          <ShareTodayCard
            time="9:30am"
            title="GP visit today"
            place="Dr Hennessy, Rathmines Medical Centre"
            avatar={<Avatar initials="DH" size={48} tone="onAccent" />}
            href="#patient"
            actionLabel="Share record"
          />
        </Specimen>
        <Specimen title="Banner cards, stat and shortcut tiles" width="phone">
          <div className="flex flex-col gap-3">
            <BannerCard icon="calendar" eyebrow="Upcoming" title="INR blood test" meta="Tuesday 25 Nov, 9:00am" badge="14d" badgeLabel="in 14 days" href="#patient" />
            <BannerCard tone="urgent" icon="pill" eyebrow="Refill due soon" title="Warfarin 5mg, 8 days left" badge="8d" badgeLabel="in 8 days" href="#patient" />
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={4} label="added this month" />
              <StatTile value={4} label="medications" />
              <StatTile value="8 days" label="until refill" urgent />
            </div>
            <ul className="grid grid-cols-2 gap-3">
              <li>
                <QuickActionTile href="#patient" label="Add note" icon="pencil" />
              </li>
              <li>
                <QuickActionTile href="#patient" label="My record" icon="record" />
              </li>
            </ul>
          </div>
        </Specimen>
        <Specimen title="Safety strip and timeline (RecordA2)" width="phone">
          <div className="flex flex-col gap-3">
            <CriticalSafetyStrip items={["Penicillin allergy", "Blood type A+"]} />
            <TimelineYear>2026</TimelineYear>
            <TimelineList>
              <TimelineItem kind="visit" date="29 Dec" title="Cardiology follow-up" upcoming />
              <TimelineItem kind="result" date="2 Nov" title="Blood count and INR" meta="Mater Hospital" href="#patient" />
              <TimelineItem kind="note" date="31 Oct" title="Fatigue symptoms" href="#patient" />
            </TimelineList>
          </div>
        </Specimen>
        <Specimen title="Medication card (until Phase 4)" width="phone">
          <MedicationCard
            name="Warfarin 5mg"
            drugClass="Anticoagulant"
            summary="Tablet, once daily, evening"
            expanded={expanded}
            onExpandedChange={setExpanded}
            details={[
              { label: "Prescriber", value: "Dr O'Mahony, Mater Private" },
              { label: "Instructions", value: "Take at the same time each evening." },
            ]}
          />
        </Specimen>
        <Specimen title="Live share strip" bleed>
          <div className="w-full max-w-[390px]">
            <LiveShareBanner clinicianName="Dr Hennessy" timeLeft="24:12" href="#patient" />
          </div>
        </Specimen>
        <Specimen title="Session screens (CodeA2, SessionA2)" surface="session" width="phone">
          <div className="flex flex-col gap-5">
            <SessionStatusRow label="Session active" time="29:58" timeLabel="29 minutes 58 seconds left" minimiseHref="#patient" />
            <SharedSummaryCard
              heading="Sharing"
              headingStyle="heading"
              rows={[
                { label: "Safety info", detail: "Allergies, blood type" },
                { label: "Medications", detail: "3 active" },
                { label: "Conditions", detail: "3 items" },
              ]}
              notIncluded={["Full timeline", "Documents", "Family history", "Insurance", "Mental health"]}
            />
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}

const EMPTY_NOTES: SessionNotes = { chiefComplaint: "", assessment: "", plan: "", followUp: "" };

export function PortalPiecesSection() {
  const [notes, setNotes] = useState(EMPTY_NOTES);
  return (
    <KitSection
      id="portal"
      title="Portal pieces"
      description="The rail (session indigo), its items and its Not shared form; the patient header; the entry and waiting steps; the session notes panel. /kit/portal composes them as PortalRecordE."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Rail items" surface="session" desk className="max-w-[232px]">
          <ul className="flex flex-col gap-1">
            <li>
              <RailItem icon="grid" label="Overview" current href="#portal" />
            </li>
            <li>
              <RailItem icon="calendar" label="Recent visits" href="#portal" />
            </li>
            <li>
              <RailItem icon="pill" label="Medications" href="#portal" />
            </li>
            <li aria-hidden="true">
              <RailDivider />
            </li>
            <li>
              <RailNotShared icon="document" label="Documents" />
            </li>
            <li>
              <RailNotShared icon="smile" label="Mental health" />
            </li>
          </ul>
        </Specimen>
        <Specimen title="Patient header (PortalRecordE)" surface="surface" desk>
          <PatientSummaryCard
            name="Jane Doe"
            initials="JD"
            details="35, female, born 12 Mar 1991, Dublin"
            facts={[
              { label: "Allergy", value: "Penicillin", tone: "critical" },
              { label: "Blood type", value: "A+" },
              { label: "Shared for 30 min", value: "29:54 left" },
            ]}
            action={
              <Button variant="secondary" size="sm">
                End session
              </Button>
            }
          />
        </Specimen>
        <Specimen title="Steps (PortalEntryB, PortalWaitB)" surface="ground" desk>
          <StepRows label="What happens next">
            {["The patient generates a code", "You enter it here", "They approve, you read what they chose to share"].map((s, i) => (
              <StepRow
                key={s}
                marker={
                  <span aria-hidden="true" className="w-7 shrink-0 font-display text-numeral-lg font-light text-accent">
                    {i + 1}
                  </span>
                }
              >
                {s}
              </StepRow>
            ))}
          </StepRows>
        </Specimen>
        <Specimen title="Session notes panel" surface="ground" desk bleed className="max-w-[300px]">
          <SessionNotesPanel notes={notes} onChange={setNotes} onSave={() => {}} patientFirstName="Jane" />
        </Specimen>
        <Specimen title="Session notes, not allowed" surface="ground" desk bleed className="max-w-[300px]">
          <SessionNotesPanel notes={notes} onChange={setNotes} onSave={() => {}} patientFirstName="Jane" allowed={false} />
        </Specimen>
      </div>
    </KitSection>
  );
}
