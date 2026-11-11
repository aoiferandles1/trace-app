"use client";

import { useState } from "react";
import type { EntryKind } from "@/components/patient/TimelineItem";
import { FilterTabs, tabPanelProps } from "@/components/ui/FilterTabs";
import type { Entry } from "../../_lib/api";
import { patientFirstName } from "../../_lib/format";
import { useSectionRecord } from "./SessionContext";
import { byYear, EmptyLine, LoadingRecord, PageTitle, TimelineRow } from "./RecordBits";

/**
 * c-timeline (867:56194): filter chips, then a white card per year with the
 * day, month, title, meta and kind tag of each entry. Upcoming visits follow.
 *
 * Figma's chips are All / Letters / Results / Imaging / Vitals. Built from
 * the kinds actually in the shared entries, so a chip never shows an empty
 * list; vitals are not timeline entries (they are on the overview).
 */
const ORDER: EntryKind[] = ["visit", "letter", "result", "imaging", "prescription", "vaccination", "session_notes"];
const PLURAL: Record<EntryKind, string> = {
  visit: "Visits",
  letter: "Letters",
  result: "Results",
  imaging: "Imaging",
  prescription: "Prescriptions",
  vaccination: "Vaccinations",
  session_notes: "Session notes",
  note: "Notes",
};

type Filter = "all" | EntryKind;

export function TimelineView() {
  const record = useSectionRecord("timeline");
  const [filter, setFilter] = useState<Filter>("all");
  if (!record) return <LoadingRecord />;

  const first = patientFirstName(record.patient);
  const entries = record.timeline ?? [];
  const kinds = ORDER.filter((k) => entries.some((e) => e.kind === k));
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
  const meta = record.scope.full_timeline
    ? `Every entry ${first} chose to share`
    : `The 3 most recent entries ${first} chose to share`;

  if (!record.timeline) {
    return (
      <>
        <PageTitle title="Timeline" />
        <EmptyLine>{first} did not share their timeline for this visit.</EmptyLine>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Timeline" meta={meta} />
      {kinds.length > 1 && (
        <FilterTabs<Filter>
          idBase="timeline"
          label="Filter the timeline"
          value={filter}
          onChange={setFilter}
          items={[{ value: "all", label: "All" }, ...kinds.map((k) => ({ value: k as Filter, label: PLURAL[k] }))]}
        />
      )}
      <div {...(kinds.length > 1 ? tabPanelProps("timeline", filter) : {})} className="flex flex-col gap-6 rounded-md">
        {shown.length === 0 ? (
          <EmptyLine>No past entries shared.</EmptyLine>
        ) : (
          byYear(shown).map((g) => <YearCard key={g.year} year={g.year} entries={g.entries} />)
        )}
      </div>
      {record.upcoming && record.upcoming.length > 0 && (
        <section aria-labelledby="tl-upcoming" className="flex flex-col gap-4 pt-4">
          <h2 id="tl-upcoming" className="font-display text-[28px] font-light leading-tight lg:text-[34px]">
            Upcoming
          </h2>
          {byYear(record.upcoming).map((g) => (
            <YearCard key={g.year} year={g.year} entries={g.entries} upcoming />
          ))}
        </section>
      )}
    </>
  );
}

function YearCard({ year, entries, upcoming = false }: { year: string; entries: Entry[]; upcoming?: boolean }) {
  return (
    <section
      aria-label={`${upcoming ? "Upcoming in " : ""}${year}, ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
      className="rounded-pill-tight border border-border-default bg-surface-card px-6 pt-6 pb-2 shadow-card"
    >
      <h3 className="flex items-baseline gap-4">
        <span className="font-display text-[34px] font-light leading-none">{year}</span>
        <span className="text-body-tiny text-text-tertiary">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </h3>
      <ol className="mt-2">
        {entries.map((e) => (
          <TimelineRow key={e.id} entry={e} upcoming={upcoming} />
        ))}
      </ol>
    </section>
  );
}
