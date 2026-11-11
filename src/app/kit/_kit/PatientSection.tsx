"use client";

import { Activity, Calendar, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConditionCard, conditionTone } from "@/components/patient/ConditionCard";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { ListItemCard } from "@/components/patient/ListItemCard";
import { LiveShareBanner } from "@/components/patient/LiveShareBanner";
import { MedicationCard } from "@/components/patient/MedicationCard";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { QuickActionTile } from "@/components/patient/QuickActionTile";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { ShareTodayCard } from "@/components/patient/ShareTodayCard";
import { StatTile } from "@/components/patient/StatTile";
import { TabBar, type TabKey } from "@/components/patient/TabBar";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { KitSection, Specimen, StateLabel } from "./Specimen";

const TAB_STATES: Array<TabKey | "none"> = ["home", "timeline", "add", "meds", "profile", "none"];

/** A 390px-wide frame so patient components show at phone width on any screen. */
function Phone({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-[390px] bg-surface-page">{children}</div>;
}

export function PatientSection() {
  return (
    <KitSection
      id="patient"
      title="Patient app"
      description="Shown in a 390px frame. See /kit/patient for them composed in the PatientShell."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Screen header" className="flex flex-col gap-4">
          <Phone>
            <ScreenHeader title="Record" />
          </Phone>
          <Phone>
            <ScreenHeader title="My profile" backHref="#patient" />
          </Phone>
          <Phone>
            <ScreenHeader
              title="Share Record"
              backHref="#patient"
              action={
                <Button variant="ghost" size="sm">
                  Help
                </Button>
              }
            />
          </Phone>
          <Phone>
            <ScreenHeader variant="greeting" title="Good morning, Jane" subtitle="Wednesday · 14 Jan 2026" />
          </Phone>
        </Specimen>

        <Specimen title="Sign-up progress header" className="flex flex-col gap-4">
          <Phone>
            <ProgressHeader step={1} />
          </Phone>
          <Phone>
            <ProgressHeader step={3} backHref="#patient" />
          </Phone>
          <Phone>
            <ProgressHeader step={7} backHref="#patient" />
          </Phone>
        </Specimen>
      </div>

      <Specimen title="Tab bar" note="Active state follows the URL; pinned here with the active prop.">
        <div className="flex flex-col gap-6">
          {TAB_STATES.map((t) => (
            <div key={t} className="flex flex-col gap-1.5">
              <StateLabel>active: {t}</StateLabel>
              <Phone>
                <div className="pt-6">
                  <TabBar active={t} />
                </div>
              </Phone>
            </div>
          ))}
        </div>
      </Specimen>

      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Live share banner and appointment-day card" className="flex flex-col gap-4">
          <Phone>
            <LiveShareBanner clinicianName="Dr Hennessy" timeLeft="24:12" href="#patient" />
          </Phone>
          <Phone>
            <LiveShareBanner clinicianName="Dr Hennessy" href="#patient" />
          </Phone>
          <Phone>
            <ShareTodayCard
              time="9:30am"
              title="GP visit · Dr Hennessy"
              place="Rathmines Medical Centre · Dublin"
              href="#patient"
            />
          </Phone>
        </Specimen>

        <Specimen title="Stat tiles and quick actions" className="flex flex-col gap-6">
          <Phone>
            <div className="grid grid-cols-3 gap-2">
              <StatTile value={3} label="added this month" />
              <StatTile value={3} label="medications" />
              <StatTile value="8 days" label="until refill" tone="peach" />
            </div>
          </Phone>
          <Phone>
            <div className="grid grid-cols-3 gap-2">
              <StatTile size="lg" value={128} label="records" tone="indigo" />
              <StatTile size="lg" value={3} label="medications" tone="teal" />
              <StatTile size="lg" value={12} label="notes" tone="peach" />
            </div>
          </Phone>
          <Phone>
            <ul className="grid grid-cols-4 gap-2">
              <li>
                <QuickActionTile href="#patient" label="Add note" icon={<FileText />} />
              </li>
              <li>
                <QuickActionTile href="#patient" label="Log appt" icon={<Calendar />} tone="peach" />
              </li>
              <li>
                <QuickActionTile href="#patient" label="Prescriptions" icon={<Clock />} tone="indigo" />
              </li>
              <li>
                <QuickActionTile href="#patient" label="My record" icon={<Activity />} tone="neutral" />
              </li>
            </ul>
          </Phone>
        </Specimen>
      </div>

      <Specimen title="Critical safety strip (patient)" className="flex flex-col gap-4">
        <Phone>
          <CriticalSafetyStrip items={["Penicillin allergy", "A+ Blood Type"]} />
        </Phone>
        <Phone>
          <CriticalSafetyStrip items={["Penicillin allergy", "Latex allergy", "A+ Blood Type", "Pacemaker"]} />
        </Phone>
        <Phone>
          <CriticalSafetyStrip items={[]} />
        </Phone>
      </Specimen>

      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Condition cards and list items" className="flex flex-col gap-2">
          <Phone>
            <div className="flex flex-col gap-2">
              <ConditionCard
                name="Atrial fibrillation"
                status="managed"
                meta="Dr O'Mahony · Cardiology · Dx 2019"
                colour={conditionTone(0)}
                href="#patient"
              />
              <ConditionCard
                name="Hypothyroidism"
                status="ongoing"
                meta="Dr Walsh · Endocrinology · Dx 2022"
                colour={conditionTone(1)}
                href="#patient"
              />
              <ConditionCard
                name="Mild asthma"
                status="managed"
                meta="Dr Hennessy · GP · since childhood"
                colour={conditionTone(2)}
                href="#patient"
              />
              <ConditionCard name="Tonsillitis" status="resolved" meta="Dr Hennessy · GP · 2020" colour="neutral" />
              <ListItemCard
                title="Blood test"
                tag={{ label: "Result", tone: "teal" }}
                tone="teal"
                meta="5 Jan · Mater Hospital"
                href="#patient"
                chevronTone="teal"
              />
              <ListItemCard
                title="Personal note added"
                tag={{ label: "Note", tone: "neutral" }}
                tone="neutral"
                meta="3 Jan · fatigue symptoms"
                href="#patient"
                chevronTone="neutral"
              />
            </div>
          </Phone>
        </Specimen>

        <Specimen title="Timeline">
          <Phone>
            <div className="flex flex-col gap-3">
              <TimelineYear>2026</TimelineYear>
              <TimelineList>
                <TimelineItem
                  kind="result"
                  date="5 JAN 2026"
                  dateTime="2026-01-05"
                  title="Blood test, full blood count and INR"
                  meta="Mater Hospital · Ordered by Dr Hennessy"
                  href="#patient"
                />
                <TimelineItem
                  kind="note"
                  date="3 JAN 2026"
                  dateTime="2026-01-03"
                  title="Personal note added"
                  meta="Fatigue symptoms"
                  href="#patient"
                />
                <TimelineItem
                  kind="prescription"
                  date="2 JAN 2026"
                  dateTime="2026-01-02"
                  title="Warfarin prescription renewed"
                  meta="Boots, Rathmines"
                  href="#patient"
                />
              </TimelineList>
              <TimelineYear>2025</TimelineYear>
              <TimelineList>
                <TimelineItem
                  kind="visit"
                  date="2 DEC 2025"
                  dateTime="2025-12-02"
                  title="Cardiology review"
                  meta="Dr O'Mahony · Mater Private"
                  href="#patient"
                />
                <TimelineItem
                  kind="session_notes"
                  date="14 NOV 2025"
                  dateTime="2025-11-14"
                  title="Session notes from Dr Hennessy"
                  meta="GP visit"
                />
              </TimelineList>
              <TimelineYear>Upcoming</TimelineYear>
              <TimelineList>
                <TimelineItem
                  upcoming
                  kind="visit"
                  date="28 JAN 2026"
                  dateTime="2026-01-28"
                  title="INR blood test"
                  meta="Rathmines Medical Centre"
                  href="#patient"
                />
              </TimelineList>
            </div>
          </Phone>
        </Specimen>
      </div>

      <Specimen title="Medication cards" note="Header is a button with aria-expanded.">
        <Phone>
          <div className="flex flex-col gap-5">
            <MedicationCard
              name="Warfarin 5mg"
              drugClass="Anticoagulant"
              drugClassTone="indigo"
              summary="Tablet · once daily · evening"
              defaultExpanded
              details={[
                { label: "Prescriber", value: "Dr O'Mahony, Mater Private · Cardiology" },
                { label: "Indication", value: "Atrial fibrillation" },
                { label: "Since", value: "2019 · ongoing" },
                { label: "Instructions", value: "Take at the same time each evening. Needs regular INR blood tests." },
              ]}
            />
            <MedicationCard
              name="Levothyroxine 50mcg"
              drugClass="Thyroid"
              drugClassTone="teal"
              summary="Tablet · once daily · morning"
              details={[{ label: "Indication", value: "Hypothyroidism" }]}
            />
            <MedicationCard
              name="Salbutamol 100mcg"
              drugClass="Bronchodilator"
              drugClassTone="peach"
              summary="Inhaler · as needed"
              details={[{ label: "Indication", value: "Mild asthma" }]}
            />
            <MedicationCard
              name="Amoxicillin 500mg"
              drugClass="Antibiotic"
              summary="Ended 3 Mar 2025"
              expired
              details={[{ label: "Indication", value: "Chest infection" }]}
            />
          </div>
        </Phone>
      </Specimen>
    </KitSection>
  );
}
