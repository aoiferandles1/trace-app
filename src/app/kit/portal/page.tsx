"use client";

import { useState } from "react";
import { PatientSummaryCard } from "@/components/portal/PatientSummaryCard";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { RecordFrame } from "@/components/portal/RecordFrame";
import { ResizableNotes, SessionNotesPanel, type SessionNotes } from "@/components/portal/SessionNotesPanel";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DayMonth } from "@/components/ui/ListRow";

/**
 * Kit demo: the live record's frame (RecordFrame, the rail, the header and
 * the resizable notes) around PortalRecordE's Overview. Static sample data.
 * Resize below 1024px to see it stack. Not a real screen: /view/session is.
 */

const MEDS: Array<[string, string, string, IconName]> = [
  ["Concerta", "36mg", "Morning", "sun"],
  ["Levothyroxine", "50mcg", "Morning", "sun"],
  ["Warfarin", "5mg", "Evening", "moon"],
  ["Salbutamol", "100mcg", "As needed", "wind"],
];

const VISITS: Array<[string, string, string, string, boolean]> = [
  ["29", "Dec", "Cardiology follow-up", "Upcoming", true],
  ["25", "Nov", "INR blood test", "Upcoming", true],
  ["11", "Nov", "GP visit", "Visit", false],
  ["2", "Nov", "Blood count and INR", "Result", false],
  ["30", "Oct", "Warfarin renewed", "Prescription", false],
];

const VIEWS: Array<[string, string, IconName, boolean]> = [
  ["Overview", "overview", "grid", true],
  ["Recent visits", "visits", "calendar", true],
  ["Medications", "medications", "pill", true],
  ["Full timeline", "timeline", "clock", false],
  ["Care team", "care-team", "person", true],
  ["Family history", "family", "tree", true],
  ["Documents", "documents", "document", false],
  ["Mental health", "mental-health", "smile", false],
];

export default function KitPortalShell() {
  const [notes, setNotes] = useState<SessionNotes>({ chiefComplaint: "", assessment: "", plan: "", followUp: "" });
  return (
    <RecordFrame
      rail={
        <PortalSidebar
          views={VIEWS.map(([label, key, icon, shared]) => ({ key, label, icon, shared, href: "/kit/portal" }))}
          active="overview"
          clinician={{ name: "Dr Hennessy", practice: "Rathmines Medical Centre" }}
        />
      }
      header={
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
        >
          <Countdown layout="inline" msLeft={29 * 60_000 + 54_000} msTotal={30 * 60_000} label="Time left" />
        </PatientSummaryCard>
      }
      notes={
        <ResizableNotes>
          {(collapse) => (
            <SessionNotesPanel notes={notes} onChange={setNotes} onSave={() => {}} patientFirstName="Jane" {...collapse} />
          )}
        </ResizableNotes>
      }
    >
      <div className="flex flex-col gap-11 pt-8.5 @min-[640px]:flex-row @min-[640px]:gap-14">
        <div className="flex min-w-0 flex-col gap-11 @min-[640px]:flex-[2]">
          <section aria-labelledby="kp-cond">
            <h2 id="kp-cond" className="mb-3 font-display text-heading font-light">
              Conditions
            </h2>
            <ul className="flex flex-col gap-4.5">
              {[
                ["Atrial fibrillation", "Managed, since 2019"],
                ["Hypothyroidism", "Ongoing, since 2022"],
                ["Mild asthma", "Managed, since childhood"],
              ].map(([n, c]) => (
                <li key={n} className="flex flex-col">
                  <span className="text-row-lg font-medium">{n}</span>
                  <span className="text-caption text-ink-2">{c}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="kp-visits">
            <h2 id="kp-visits" className="mb-3 font-display text-heading font-light">
              Recent visits
            </h2>
            <ul className="flex flex-col gap-3.5">
              {VISITS.map(([d, m, t, k, up]) => (
                <li key={t} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-x-3">
                  <DayMonth day={d} month={m} accent={up} />
                  <span className="text-row font-medium">{t}</span>
                  <span className={up ? "text-caption text-accent" : "text-caption text-ink-2"}>{k}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section aria-labelledby="kp-meds" className="min-w-0 @min-[640px]:flex-1">
          <h2 id="kp-meds" className="mb-3 font-display text-heading font-light">
            Medications
          </h2>
          <ul className="flex flex-col gap-4.5">
            {MEDS.map(([n, s, w, i]) => (
              <li key={n}>
                <button type="button" className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-row-lg font-medium">
                      {n} <span className="text-caption font-normal text-ink-2">{s}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-caption text-ink-2">
                      <Icon name={i} size={18} className="text-accent" />
                      {w}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={18} className="text-ink-2" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </RecordFrame>
  );
}
