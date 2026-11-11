"use client";

import { EyeOff } from "lucide-react";
import { conditionTone } from "@/components/patient/ConditionCard";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { dotTone } from "@/components/patient/ListItemCard";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { ScopeSummary } from "@/components/portal/LiveBanner";
import { PatientSummaryCard } from "@/components/portal/PatientSummaryCard";
import { HintStrip } from "@/components/ui/HintStrip";
import { Pill, type Tone } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";
import type { Condition, Entry, Medication, PortalRecord, Vitals } from "../../_lib/api";
import {
  criticalItems,
  formatEntryDate,
  formatMonthYear,
  isoDay,
  medicationMeta,
  medicationName,
  patientDetails,
  patientFullName,
  scopeLists,
} from "../../_lib/format";
import { useSectionRecord } from "./SessionContext";
import { byYear, EmptyLine, entryMeta, ListCard, LoadingRecord, PageTitle, SectionHeading } from "./RecordBits";

/**
 * c-overview (1482:24077): patient band, what was shared, the critical
 * strip, then conditions, medications and vitals on the left and the
 * timeline and upcoming visits on the right. Sections the patient did not
 * share are left out entirely (the scope strip says so in words).
 */
export function Overview() {
  const record = useSectionRecord("overview");
  if (!record) return <LoadingRecord />;
  return <OverviewBody record={record} />;
}

function OverviewBody({ record }: { record: PortalRecord }) {
  const p = record.patient;
  const name = patientFullName(p);
  const { shared, notShared } = scopeLists(record.scope);
  const current = record.medications?.current ?? [];
  const conditions = record.conditions;
  const active = conditions?.filter((c) => c.status !== "resolved") ?? [];
  const meta = [p.age != null ? String(p.age) : null, p.sex, p.city, "Active session"].filter(Boolean).join(" · ");

  return (
    <>
      <PageTitle title="Overview" meta={meta} />
      <PatientSummaryCard
        name={name}
        initials={initialsOf(name)}
        details={patientDetails(p, { city: true })}
        figures={[
          ...(record.critical.blood_type ? [{ value: record.critical.blood_type, label: "Blood" }] : []),
          ...(conditions ? [{ value: String(active.length), label: "Conditions" }] : []),
          { value: String(current.length), label: "Medications" },
        ]}
      />
      <HintStrip tone="neutral" icon={<EyeOff aria-hidden="true" className="size-4 shrink-0" />}>
        <ScopeSummary shared={shared} notShared={notShared} />
      </HintStrip>
      <CriticalSafetyStrip variant="portal" items={criticalItems(record.critical)} />

      <div className="grid gap-12 xl:grid-cols-2">
        <div className="flex flex-col gap-12">
          {conditions && <ConditionsBlock conditions={conditions} activeCount={active.length} />}
          <MedicationsBlock meds={current} />
          {record.vitals && <VitalsBlock vitals={record.vitals} />}
        </div>
        {record.timeline && (
          <div className="flex flex-col gap-12">
            <TimelineBlock
              id="ov-timeline"
              title="Timeline"
              entries={record.timeline}
              empty="No past entries shared."
            />
            {record.upcoming && (
              <TimelineBlock id="ov-upcoming" title="Upcoming" entries={record.upcoming} upcoming empty="No upcoming visits." />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Row({ tone, title, meta, tag }: { tone: Tone; title: string; meta?: string; tag: { label: string; tone: Tone } }) {
  return (
    <li className="flex min-h-[68px] items-center gap-4 py-3">
      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", dotTone[tone])} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold leading-snug tracking-[-0.005em]">{title}</span>
        {meta && <span className="text-body-sm text-text-tertiary">{meta}</span>}
      </span>
      <Pill tone={tag.tone}>{tag.label}</Pill>
    </li>
  );
}

function conditionMeta(c: Condition): string {
  const dx = c.diagnosed_note ?? (c.diagnosed_year ? `Dx ${c.diagnosed_year}` : null);
  return [c.clinician, c.specialty, dx].filter(Boolean).join(" · ");
}

function ConditionsBlock({ conditions, activeCount }: { conditions: Condition[]; activeCount: number }) {
  return (
    <section aria-labelledby="ov-conditions" className="flex flex-col gap-4">
      <SectionHeading id="ov-conditions" title="Conditions" count={`${activeCount} active`} />
      <ListCard>
        {conditions.length === 0 ? (
          <EmptyLine>No conditions recorded.</EmptyLine>
        ) : (
          <ul>
            {conditions.map((c, i) => {
              const tone = conditionTone(i);
              return (
                <Row
                  key={c.id}
                  tone={tone}
                  title={c.name}
                  meta={conditionMeta(c)}
                  tag={{ label: c.status, tone: c.status === "resolved" ? "neutral" : tone }}
                />
              );
            })}
          </ul>
        )}
      </ListCard>
    </section>
  );
}

function MedicationsBlock({ meds }: { meds: Medication[] }) {
  return (
    <section aria-labelledby="ov-meds" className="flex flex-col gap-4">
      <SectionHeading
        id="ov-meds"
        title="Medications"
        count={`${meds.length} active`}
        link={{ href: "/view/session/medications", label: "View all" }}
      />
      <ListCard>
        {meds.length === 0 ? (
          <EmptyLine>No current medications.</EmptyLine>
        ) : (
          <ul>
            {meds.map((m, i) => {
              const tone = conditionTone(i);
              return (
                <Row key={m.id} tone={tone} title={medicationName(m)} meta={medicationMeta(m)} tag={{ label: "ongoing", tone }} />
              );
            })}
          </ul>
        )}
      </ListCard>
    </section>
  );
}

function VitalsBlock({ vitals }: { vitals: Vitals }) {
  const items = [
    {
      label: "Blood pressure",
      value: vitals.systolic != null ? String(vitals.systolic) : null,
      unit: vitals.diastolic != null ? `/${vitals.diastolic}` : "",
    },
    { label: "Heart rate", value: vitals.heart_rate != null ? String(vitals.heart_rate) : null, unit: "bpm" },
    { label: "Weight", value: vitals.weight_kg != null ? String(Number(vitals.weight_kg)) : null, unit: "kg" },
    { label: "O₂ saturation", value: vitals.spo2 != null ? String(vitals.spo2) : null, unit: "%" },
  ].filter((i) => i.value !== null);
  return (
    <section aria-labelledby="ov-vitals" className="flex flex-col gap-4">
      <SectionHeading id="ov-vitals" title="Last recorded vitals" count={formatMonthYear(vitals.recorded_on)} />
      <ListCard className="py-8 sm:px-11">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((i) => (
            <div key={i.label} className="flex flex-col-reverse gap-2">
              <dd className="flex items-baseline gap-1.5">
                <span className="font-display text-[34px] font-light leading-none">{i.value}</span>
                <span className="text-body-sm text-text-tertiary">{i.unit}</span>
              </dd>
              <dt className="text-body-tiny font-medium uppercase tracking-[0.02em] text-text-tertiary">{i.label}</dt>
            </div>
          ))}
        </dl>
      </ListCard>
    </section>
  );
}

function TimelineBlock({
  id,
  title,
  entries,
  upcoming = false,
  empty,
}: {
  id: string;
  title: string;
  entries: Entry[];
  upcoming?: boolean;
  empty: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <SectionHeading id={id} title={title} link={{ href: "/view/session/timeline", label: "View all" }} />
      {entries.length === 0 ? (
        <EmptyLine>{empty}</EmptyLine>
      ) : (
        byYear(entries).map((g) => (
          <div key={g.year} className="flex flex-col gap-3">
            <TimelineYear>{g.year}</TimelineYear>
            <TimelineList>
              {g.entries.map((e) => (
                <TimelineItem
                  key={e.id}
                  kind={e.kind}
                  date={formatEntryDate(e.occurs_at)}
                  dateTime={isoDay(e.occurs_at)}
                  title={e.title}
                  meta={entryMeta(e) || undefined}
                  upcoming={upcoming}
                />
              ))}
            </TimelineList>
          </div>
        ))
      )}
    </section>
  );
}
