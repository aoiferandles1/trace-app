"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { PageHeader } from "@/components/patient/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { loadSection, medicationCaption, type RecordMedication } from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus } from "../../_components/Screens";

export type MedsTab = "current" | "past";
type Tab = MedsTab;

async function loadMeds() {
  return (await loadSection("medications")).data;
}

/**
 * Medications (board MedsA2): Current | Past, one card of rows, "Add a
 * medication".
 *
 * - Current: name, the schedule with the strength changes, or the supply
 *   left in the urgent colour when a refill is 5 days away or less
 *   ("Evening, 3 days left"), and the strength in Sora on the right.
 * - Past: "2 Aug to 9 Aug 2026, Dr Hennessy" and the last strength.
 *
 * Every row opens the medication (/meds/[id]), where its history, notes,
 * edit and end are. Rows with a strength history show the chevron, as the
 * board's Concerta row does.
 *
 * `?tab=past` opens on Past (the detail screen's Back returns to it).
 *
 * The panel is the Medications screen's whole content, header included. At
 * desktop widths it is also the list beside a medication (`level={2}`,
 * `current` marks its row, `syncUrl={false}` leaves the detail's address
 * alone).
 */
export function MedsPanel({
  level = 1,
  initialTab,
  current,
  syncUrl = true,
}: {
  level?: 1 | 2;
  initialTab?: Tab;
  /** The medication open beside the list. */
  current?: string;
  syncUrl?: boolean;
}) {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab ?? (params.get("tab") === "past" ? "past" : "current"));
  const data = useLoad(loadMeds);
  const listId = useId();

  function choose(next: Tab) {
    setTab(next);
    if (!syncUrl) return;
    window.history.replaceState(window.history.state, "", next === "past" ? "/meds?tab=past" : "/meds");
  }

  return (
    <>
      <PageHeader title="Medications" level={level} />
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
        <SegmentedControl<Tab>
          label="Medication list"
          value={tab}
          onChange={choose}
          options={[
            { value: "current", label: "Current" },
            { value: "past", label: "Past" },
          ]}
        />
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : (
          <MedList
            id={listId}
            tab={tab}
            meds={tab === "current" ? data.data.current : data.data.past}
            current={current}
          />
        )}
        <AddLink href="/add/medication?from=meds" height={44}>
          Add a medication
        </AddLink>
      </div>
    </>
  );
}

function MedList({
  id,
  tab,
  meds,
  current,
}: {
  id: string;
  tab: Tab;
  meds: RecordMedication[];
  current?: string;
}) {
  if (meds.length === 0) {
    return (
      <p className="py-2 text-body text-ink-2">{tab === "current" ? "No current medications." : "No past medications."}</p>
    );
  }
  return (
    <Card as="ul" id={id} aria-label={tab === "current" ? "Current medications" : "Past medications"}>
      {meds.map((m) => {
        const caption = medicationCaption(m);
        return (
          <li key={m.id}>
            <ListRow
              title={m.name}
              caption={caption.text || undefined}
              captionTone={caption.urgent ? "urgent" : "default"}
              value={m.strength_label ?? undefined}
              valueStyle="numeral"
              gap={12}
              chevron={m.period_count > 1}
              href={`/meds/${m.id}${tab === "past" ? "?from=past" : ""}`}
              current={m.id === current}
            />
          </li>
        );
      })}
    </Card>
  );
}
