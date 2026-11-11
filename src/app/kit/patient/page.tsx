"use client";

import { useState } from "react";
import { PageHeader } from "@/components/patient/PageHeader";
import { TabBar } from "@/components/patient/TabBar";
import { PatientShell } from "@/components/layout/PatientShell";
import { Card, SectionHeading } from "@/components/ui/Card";
import { DemoStrip } from "@/components/ui/DemoStrip";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl, tabPanelProps } from "@/components/ui/SegmentedControl";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Kit demo: the PatientShell composed with the new pieces, after RecordA2's
 * Conditions tab. Static sample data. Not a real screen (Phase 2 rebuilds
 * /record).
 */
export default function KitPatientShell() {
  const [tab, setTab] = useState<"timeline" | "conditions" | "family">("conditions");
  return (
    <PatientShell demo={<DemoStrip />} header={<PageHeader title="Record" />} tabBar={<TabBar active="record" />}>
      <div className="flex flex-col gap-3.5 px-5 pb-8">
        <section
          aria-label="Critical safety information"
          className="flex h-12 items-center justify-between rounded-strip bg-critical-tint px-4"
        >
          <span className="text-label font-semibold text-critical">Penicillin allergy</span>
          <span className="text-caption text-ink-2">Blood type A+</span>
        </section>
        <SegmentedControl
          mode="tabs"
          idBase="kit-shell"
          label="Record sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "timeline", label: "Timeline" },
            { value: "conditions", label: "Conditions" },
            { value: "family", label: "Family" },
          ]}
        />
        <div {...tabPanelProps("kit-shell", tab)} className="flex flex-col gap-1">
          {tab === "conditions" ? (
            <>
              <Card as="ul">
                <li>
                  <ListRow title="Atrial fibrillation" caption="Dr O'Mahony, since 2019" value="Managed" href="/kit/patient" />
                </li>
                <li>
                  <ListRow title="Hypothyroidism" caption="Dr Walsh, since 2022" value="Ongoing" href="/kit/patient" />
                </li>
                <li>
                  <ListRow title="Mild asthma" caption="Dr Hennessy, since childhood" value="Managed" href="/kit/patient" />
                </li>
              </Card>
              <ButtonLink href="/kit/patient" variant="text" className="w-fit" iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}>
                Add a condition
              </ButtonLink>
            </>
          ) : (
            <section aria-labelledby="kit-shell-other" className="py-2">
              <SectionHeading id="kit-shell-other">{tab === "timeline" ? "Timeline" : "Family"}</SectionHeading>
              <p className="text-body text-ink-2">Sample panel.</p>
            </section>
          )}
        </div>
      </div>
    </PatientShell>
  );
}
