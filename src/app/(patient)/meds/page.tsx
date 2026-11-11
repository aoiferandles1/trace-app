"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { PageHeader } from "@/components/patient/PageHeader";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { loadSection, medicationCaption, type RecordMedication } from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, TabScreen } from "../_components/Screens";

type Tab = "current" | "past";

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
 */
function MedsScreen() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "past" ? "past" : "current");
  const data = useLoad(loadMeds);
  const listId = useId();

  function choose(next: Tab) {
    setTab(next);
    window.history.replaceState(window.history.state, "", next === "past" ? "/meds?tab=past" : "/meds");
  }

  return (
    <TabScreen header={<PageHeader title="Medications" />}>
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
          <MedList id={listId} tab={tab} meds={tab === "current" ? data.data.current : data.data.past} />
        )}
        <AddLink href="/add/medication?from=meds" height={44}>
          Add a medication
        </AddLink>
      </div>
    </TabScreen>
  );
}

function MedList({ id, tab, meds }: { id: string; tab: Tab; meds: RecordMedication[] }) {
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
            />
          </li>
        );
      })}
    </Card>
  );
}

export default function MedsPage() {
  return (
    <SessionReady>
      <MedsScreen />
    </SessionReady>
  );
}
