"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { MedicationCard } from "@/components/patient/MedicationCard";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { FilterTabs, tabPanelProps } from "@/components/ui/FilterTabs";
import { HintStrip } from "@/components/ui/HintStrip";
import type { Tone } from "@/components/ui/Pill";
import { addDays, dayKey, formatDay, yearOf } from "@/lib/dates";
import { isCurrentMedication, medicationName, medicationSummary, type Medication } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { LoadStatus, TabScreen } from "../_components/Screens";

/** Drug class tag colours in list order, as p-meds (indigo, teal, peach). */
const CLASS_TONES: Tone[] = ["indigo", "teal", "peach"];

async function loadMeds() {
  const supabase = createClient();
  return must(await supabase.from("medications").select("*").order("started_on", { ascending: false, nullsFirst: false }));
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Medications (p-meds, p-meds-expired). Current means no end date, or one
 * today or later. "Request repeat prescription" is left out: there is no
 * pharmacy to send it to (PLAN.md section 11).
 */
function MedsScreen() {
  const data = useLoad(loadMeds);
  const [tab, setTab] = useState<"current" | "expired">("current");
  const today = dayKey();

  return (
    <TabScreen header={<ScreenHeader title="My medication" />}>
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : (
        (() => {
          const current = data.data.filter((m) => isCurrentMedication(m, today));
          const expired = data.data
            .filter((m) => !isCurrentMedication(m, today))
            .sort((a, b) => (a.ended_on! < b.ended_on! ? 1 : -1));
          const yearAgo = addDays(today, -365);
          const expiredThisYear = expired.filter((m) => m.ended_on! >= yearAgo).length;
          const list = tab === "current" ? current : expired;
          return (
            <div className="flex flex-col gap-5 px-4 pb-8 pt-2">
              <HintStrip tone="indigo">
                {plural(current.length, "active prescription", "active prescriptions")} ·{" "}
                {expiredThisYear} expired in the last 12 months
              </HintStrip>
              <FilterTabs
                idBase="meds"
                label="Medication status"
                fill
                value={tab}
                onChange={setTab}
                items={[
                  { value: "current", label: "Current" },
                  { value: "expired", label: "Expired" },
                ]}
              />
              <div {...tabPanelProps("meds", tab)} className="flex flex-col gap-5 rounded-card">
                <SectionLabel>{tab === "current" ? "Current" : "Expired"}</SectionLabel>
                {list.length === 0 && (
                  <p className="text-body-sm text-text-tertiary">
                    {tab === "current" ? "No current medications." : "No expired medications."}
                  </p>
                )}
                {list.length > 0 && (
                  <ul className="flex flex-col gap-5">
                    {list.map((m, i) => (
                      <li key={m.id}>
                        <MedicationCard
                          name={medicationName(m)}
                          drugClass={m.drug_class ?? undefined}
                          drugClassTone={CLASS_TONES[i % CLASS_TONES.length]}
                          summary={medicationSummary(m) || undefined}
                          expired={tab === "expired"}
                          defaultExpanded={tab === "current" && i === 0}
                          details={details(m)}
                          footer={
                            <ButtonLink
                              href={`/meds/${m.id}/edit`}
                              variant="ghost"
                              size="sm"
                              className="mt-3"
                              iconLeft={<Pencil aria-hidden="true" className="size-4" />}
                              aria-label={`Edit ${medicationName(m)}`}
                            >
                              Edit
                            </ButtonLink>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <ButtonLink
                  href="/add/medication"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  iconLeft={<Plus aria-hidden="true" className="size-5" />}
                >
                  Add a medication
                </ButtonLink>
              </div>
            </div>
          );
        })()
      )}
    </TabScreen>
  );
}

function details(m: Medication) {
  const prescriber = m.prescriber
    ? `${m.prescriber}${m.prescriber_org ? `, ${m.prescriber_org}` : ""}${m.prescriber_specialty ? ` · ${m.prescriber_specialty}` : ""}`
    : [m.prescriber_org, m.prescriber_specialty].filter(Boolean).join(" · ");
  const endWord = m.ended_on && m.ended_on < dayKey() ? "ended" : "ends";
  const since = m.started_on
    ? `${yearOf(m.started_on)} · ${m.ended_on ? `${endWord} ${formatDay(m.ended_on)}` : "ongoing"}`
    : m.ended_on
      ? `${endWord === "ended" ? "Ended" : "Ends"} ${formatDay(m.ended_on)}`
      : null;
  return [
    prescriber && { label: "Prescriber", value: prescriber },
    m.indication && { label: "Indication", value: m.indication },
    since && { label: "Since", value: since },
    m.refill_due_on && { label: "Refill due", value: formatDay(m.refill_due_on) },
    m.instructions && { label: "Instructions", value: m.instructions },
  ].filter(Boolean) as { label: string; value: string }[];
}

export default function MedsPage() {
  return (
    <SessionReady>
      <MedsScreen />
    </SessionReady>
  );
}
