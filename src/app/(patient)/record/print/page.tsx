"use client";

import type { ReactNode } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { Button } from "@/components/ui/Button";
import { formatDay, formatShortDate } from "@/lib/dates";
import {
  capitalise,
  conditionCaption,
  ENTRY_KIND_LABEL,
  entryTitle,
  EVENT_KIND_LABEL,
  formatAtPrecision,
  loadSections,
} from "@/lib/patient/record";
import { allergyLabels, fullName } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { vitalsLine } from "../../_components/forms/VitalsForm";
import { LoadStatus, SubScreen } from "../../_components/Screens";

async function loadPrint() {
  const [r, vitals] = await Promise.all([
    loadSections("conditions", "medications", "recent_visits", "full_timeline", "family_history", "care_team"),
    createClient().from("vitals").select("*").order("recorded_on", { ascending: false }).limit(5),
  ]);
  return { ...r, vitals: must(vitals) };
}

/**
 * Your record to print (F10; no board): the whole record as plain text in
 * one column, to print or save as a PDF from the browser's print dialog.
 * The JSON export stays for moving the data; this is for reading it. The
 * shell's chrome (demo strip, banner, the Print button) is left off the
 * paper.
 */
function PrintScreen() {
  const { profile } = usePatientSession();
  const data = useLoad(loadPrint);
  return (
    <SubScreen
      title="Your record to print"
      titleSize="md"
      backHref="/profile/privacy"
      backLabel="Back to Privacy and data"
      footer={
        <Button size="lg" fullWidth onClick={() => window.print()} disabled={data.status !== "ready"}>
          Print or save as PDF
        </Button>
      }
    >
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : (
        <div className="flex flex-col gap-6 px-5 pb-8 pt-3.5 text-body print:text-[11pt]">
          <Part title="You">
            <Line>{fullName(profile) || "Name not added"}</Line>
            {profile.date_of_birth && <Line>Born {formatDay(profile.date_of_birth)}</Line>}
            {[profile.address, profile.city, profile.country].filter(Boolean).length > 0 && (
              <Line>{[profile.address, profile.city, profile.country].filter(Boolean).join(", ")}</Line>
            )}
            {profile.phone && <Line>{profile.phone}</Line>}
          </Part>
          <Part title="Critical safety">
            <Line>Blood type: {profile.blood_type ?? "not known"}</Line>
            <Line>Allergies: {allergyLabels(profile.allergies).join(", ") || "none recorded"}</Line>
            {profile.implants.length > 0 && <Line>Implants or devices: {profile.implants.join(", ")}</Line>}
          </Part>
          <Part title="Conditions" empty={data.data.conditions.conditions.length === 0}>
            {data.data.conditions.conditions.map((c) => (
              <Line key={c.id}>
                {c.name}: {[capitalise(c.status), conditionCaption(c)].filter(Boolean).join(", ")}
              </Line>
            ))}
          </Part>
          <Part title="Medications" empty={data.data.medications.current.length === 0}>
            {data.data.medications.current.map((m) => (
              <Line key={m.id}>
                {[m.name, m.strength_label].filter(Boolean).join(" ")}
                {m.frequency || m.timing ? `: ${[m.frequency, m.timing].filter(Boolean).join(", ")}` : ""}
                {m.instructions ? `. ${m.instructions}` : ""}
              </Line>
            ))}
          </Part>
          {data.data.medications.past.length > 0 && (
            <Part title="Past medications">
              {data.data.medications.past.map((m) => (
                <Line key={m.id}>
                  {[m.name, m.strength_label].filter(Boolean).join(" ")}
                  {m.ended_on ? `, stopped ${formatAtPrecision(m.ended_on, "day")}` : ""}
                </Line>
              ))}
            </Part>
          )}
          <Part title="Visits, results and notes" empty={data.data.full_timeline.visits.length === 0}>
            {[...data.data.recent_visits.upcoming, ...data.data.full_timeline.visits].map((e) => (
              <Line key={e.id}>
                {formatShortDate(e.occurs_at)}: {entryTitle(e)} ({ENTRY_KIND_LABEL[e.kind].toLowerCase()}
                {e.upcoming ? ", upcoming" : ""})
                {e.detail?.kind === "result" && e.detail.results.length > 0
                  ? `. ${e.detail.results.map((v) => `${v.name} ${v.value}${v.unit ? ` ${v.unit}` : ""}${v.flag ? `, ${v.flag}` : ""}`).join("; ")}`
                  : ""}
              </Line>
            ))}
          </Part>
          <Part title="Timeline" empty={data.data.full_timeline.events.length === 0}>
            {data.data.full_timeline.events.map((e) => (
              <Line key={e.id}>
                {formatAtPrecision(e.occurred_on, e.date_precision)}: {e.title} ({EVENT_KIND_LABEL[e.kind].toLowerCase()})
                {e.prescriptions.length > 0 ? `. ${e.prescriptions.map((p) => p.name).join(", ")}` : ""}
              </Line>
            ))}
          </Part>
          {data.data.vitals.length > 0 && (
            <Part title="Vitals">
              {data.data.vitals.map((v) => (
                <Line key={v.id}>
                  {formatDay(v.recorded_on)}: {vitalsLine(v)}
                </Line>
              ))}
            </Part>
          )}
          <Part title="Family history" empty={data.data.family_history.relatives.length === 0}>
            {data.data.family_history.relatives.map((r) => (
              <Line key={r.id}>
                {r.label}: {r.conditions.length ? r.conditions.map((c) => c.label).join(", ") : "none known"}
              </Line>
            ))}
          </Part>
          <Part title="Care team" empty={data.data.care_team.care_team.length === 0}>
            {data.data.care_team.care_team.map((p) => (
              <Line key={p.id}>{[p.name, p.role, p.organisation].filter(Boolean).join(", ")}</Line>
            ))}
          </Part>
        </div>
      )}
    </SubScreen>
  );
}

function Part({ title, empty = false, children }: { title: string; empty?: boolean; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 break-inside-avoid-page">
      <h2 className="font-display text-heading font-light">{title}</h2>
      {empty ? <p>None recorded.</p> : <ul className="flex flex-col gap-1">{children}</ul>}
    </section>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <li className="list-none break-words">{children}</li>;
}

export default function PrintPage() {
  return (
    <SessionReady>
      <PrintScreen />
    </SessionReady>
  );
}
