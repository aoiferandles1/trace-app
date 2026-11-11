import { ConditionCard, conditionTone } from "@/components/patient/ConditionCard";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { TabBar } from "@/components/patient/TabBar";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { PatientShell } from "@/components/layout/PatientShell";
import { SectionLabel } from "@/components/ui/Card";

/**
 * Kit demo: the PatientShell with p-record's components, static sample data.
 * Compare with the p-record export. Not a real screen (Phase 4 builds /record).
 */
export default function KitPatientShell() {
  return (
    <PatientShell header={<ScreenHeader title="Record" />} tabBar={<TabBar active="timeline" />}>
      <div className="flex flex-col gap-6 px-4 pb-8 pt-2">
        <section aria-labelledby="critical-label" className="flex flex-col gap-2">
          <SectionLabel id="critical-label">Critical</SectionLabel>
          <CriticalSafetyStrip items={["Penicillin allergy", "A+ Blood Type"]} />
        </section>
        <section aria-labelledby="conditions-label" className="flex flex-col gap-2">
          <SectionLabel id="conditions-label">Ongoing conditions</SectionLabel>
          <ul className="flex flex-col gap-2">
            {[
              ["Atrial fibrillation", "managed", "Dr O'Mahony · Cardiology · Dx 2019"],
              ["Hypothyroidism", "ongoing", "Dr Walsh · Endocrinology · Dx 2022"],
              ["Mild asthma", "managed", "Dr Hennessy · GP · since childhood"],
            ].map(([name, status, meta], i) => (
              <li key={name}>
                <ConditionCard
                  name={name}
                  status={status as "managed" | "ongoing"}
                  meta={meta}
                  colour={conditionTone(i)}
                  href="/kit/patient"
                />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="timeline-label" className="flex flex-col gap-3">
          <SectionLabel id="timeline-label">Timeline</SectionLabel>
          <TimelineYear>2026</TimelineYear>
          <TimelineList>
            <TimelineItem
              kind="result"
              date="5 JAN 2026"
              title="Blood test, full blood count and INR"
              meta="Mater Hospital · Ordered by Dr Hennessy"
              href="/kit/patient"
            />
            <TimelineItem kind="note" date="3 JAN 2026" title="Personal note added" meta="Fatigue symptoms" href="/kit/patient" />
            <TimelineItem
              kind="prescription"
              date="2 JAN 2026"
              title="Warfarin prescription renewed"
              meta="Boots, Rathmines"
              href="/kit/patient"
            />
          </TimelineList>
        </section>
      </div>
    </PatientShell>
  );
}
