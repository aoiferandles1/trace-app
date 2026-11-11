"use client";

import { useState } from "react";
import { MedicationCard, type MedicationDetail } from "@/components/patient/MedicationCard";
import { FilterTabs, tabPanelProps } from "@/components/ui/FilterTabs";
import type { Tone } from "@/components/ui/Pill";
import type { Medication } from "../../_lib/api";
import { formatDateOnly, medicationName, medicationSummary, patientFirstName, prescriberLine } from "../../_lib/format";
import { useSectionRecord } from "./SessionContext";
import { EmptyLine, LoadingRecord, PageTitle } from "./RecordBits";

/**
 * c-meds (867:56239): Active / Expired chips, then each medication as an
 * expanded card with Prescriber, Indication, Since and Instructions.
 * Medications are always shared (PLAN.md section 2).
 */

const CLASS_TONE: Record<string, Tone> = {
  anticoagulant: "indigo",
  thyroid: "teal",
  bronchodilator: "peach",
};

function details(m: Medication, expired: boolean): MedicationDetail[] {
  const since = m.started_on ? m.started_on.slice(0, 4) : null;
  const sinceLine = expired
    ? [since, m.ended_on ? `ended ${formatDateOnly(m.ended_on)}` : null].filter(Boolean).join(" · ")
    : [since, "ongoing"].filter(Boolean).join(" · ");
  const rows: Array<[string, string | null]> = [
    ["Prescriber", prescriberLine(m) || null],
    ["Indication", m.indication],
    [expired ? "Taken" : "Since", sinceLine || null],
    ["Instructions", m.instructions],
    ["Refill due", !expired && m.refill_due_on ? formatDateOnly(m.refill_due_on) : null],
  ];
  return rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
}

export function MedicationsView() {
  const record = useSectionRecord("medications");
  const [tab, setTab] = useState<"active" | "expired">("active");
  if (!record) return <LoadingRecord />;
  const meds = record.medications ?? { current: [], expired: [] };
  const list = tab === "active" ? meds.current : meds.expired;
  return (
    <>
      <PageTitle title="Medications" meta={`Current and expired prescriptions from ${patientFirstName(record.patient)}'s record`} />
      <FilterTabs
        idBase="meds"
        label="Medication status"
        value={tab}
        onChange={setTab}
        items={[
          { value: "active", label: "Active", count: meds.current.length },
          { value: "expired", label: "Expired", count: meds.expired.length },
        ]}
      />
      <div {...tabPanelProps("meds", tab)} className="flex flex-col gap-6 rounded-card">
        {list.length === 0 ? (
          <EmptyLine>{tab === "active" ? "No current medications." : "No expired medications."}</EmptyLine>
        ) : (
          list.map((m) => (
            <MedicationCard
              key={m.id}
              name={medicationName(m)}
              drugClass={m.drug_class ?? undefined}
              drugClassTone={CLASS_TONE[(m.drug_class ?? "").toLowerCase()] ?? "neutral"}
              summary={medicationSummary(m)}
              details={details(m, tab === "expired")}
              expired={tab === "expired"}
              defaultExpanded
              headingLevel={2}
            />
          ))
        )}
      </div>
    </>
  );
}
