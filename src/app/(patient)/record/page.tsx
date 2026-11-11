"use client";

import { Plus } from "lucide-react";
import { ConditionCard, conditionTone } from "@/components/patient/ConditionCard";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { dayKey, formatTimelineDate, yearOfIso } from "@/lib/dates";
import { conditionMeta, criticalItems, type Condition, type ConditionStatus, type Entry } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { entryMeta } from "../_components/entryMeta";
import { LoadStatus, TabScreen } from "../_components/Screens";

async function loadRecord() {
  const supabase = createClient();
  const [conditions, entries] = await Promise.all([
    supabase.from("conditions").select("*").order("created_at", { ascending: true }),
    supabase.from("entries").select("*").order("occurs_at", { ascending: false }),
  ]);
  return { conditions: must(conditions), entries: must(entries) as Entry[] };
}

/**
 * Record (p-record, the Timeline tab): the critical strip, conditions, and
 * every entry grouped by year, newest first. Conditions and entries open
 * their detail screens.
 */
function RecordScreen() {
  const { profile } = usePatientSession();
  const data = useLoad(loadRecord);

  return (
    <TabScreen header={<ScreenHeader title="Record" />}>
      <div className="flex flex-col gap-8 px-4 pb-8 pt-2">
        <section aria-labelledby="critical-label" className="flex flex-col gap-3">
          <SectionLabel id="critical-label">Critical</SectionLabel>
          <CriticalSafetyStrip items={criticalItems(profile)} />
          {criticalItems(profile).length === 0 && (
            <ButtonLink href="/profile/edit#critical" variant="ghost" size="sm" className="w-fit" iconLeft={<Plus aria-hidden="true" className="size-4" />}>
              Add allergies or blood type
            </ButtonLink>
          )}
        </section>
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : (
          <>
            <Conditions conditions={data.data.conditions} />
            <Timeline entries={data.data.entries} />
          </>
        )}
      </div>
    </TabScreen>
  );
}

function Conditions({ conditions }: { conditions: Condition[] }) {
  const ongoing = conditions.filter((c) => c.status !== "resolved");
  const resolved = conditions.filter((c) => c.status === "resolved");
  return (
    <>
      <section aria-labelledby="conditions-label" className="flex flex-col gap-3">
        <SectionLabel id="conditions-label">Ongoing conditions</SectionLabel>
        {ongoing.length === 0 && <p className="text-body-sm text-text-tertiary">No ongoing conditions.</p>}
        {ongoing.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {ongoing.map((c, i) => (
              <li key={c.id}>
                <ConditionCard
                  name={c.name}
                  status={c.status as ConditionStatus}
                  meta={conditionMeta(c) || undefined}
                  colour={conditionTone(i)}
                  href={`/record/conditions/${c.id}`}
                />
              </li>
            ))}
          </ul>
        )}
        <ButtonLink
          href="/record/conditions/new"
          variant="ghost"
          size="sm"
          className="w-fit"
          iconLeft={<Plus aria-hidden="true" className="size-4" />}
        >
          Add a condition
        </ButtonLink>
      </section>
      {resolved.length > 0 && (
        <section aria-labelledby="resolved-label" className="flex flex-col gap-3">
          <SectionLabel id="resolved-label">Resolved conditions</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {resolved.map((c) => (
              <li key={c.id}>
                <ConditionCard
                  name={c.name}
                  status="resolved"
                  meta={conditionMeta(c) || undefined}
                  colour="neutral"
                  href={`/record/conditions/${c.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Timeline({ entries }: { entries: Entry[] }) {
  const nowIso = new Date().toISOString();
  const years = new Map<number, Entry[]>();
  for (const e of entries) {
    const y = yearOfIso(e.occurs_at);
    years.set(y, [...(years.get(y) ?? []), e]);
  }
  return (
    <section aria-labelledby="timeline-label" className="flex flex-col gap-3">
      <SectionLabel id="timeline-label">Timeline</SectionLabel>
      {entries.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-sm text-text-tertiary">
            Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here.
          </p>
          <ButtonLink href="/add" variant="secondary">
            Add to my record
          </ButtonLink>
        </div>
      )}
      {[...years.entries()].map(([year, list]) => (
        <div key={year} className="flex flex-col gap-3">
          <TimelineYear>{year}</TimelineYear>
          <TimelineList>
            {list.map((e) => (
              <TimelineItem
                key={e.id}
                kind={e.kind}
                date={formatTimelineDate(e.occurs_at)}
                dateTime={dayKey(e.occurs_at)}
                title={e.title}
                meta={entryMeta(e)}
                href={`/record/${e.id}`}
                upcoming={e.occurs_at > nowIso}
              />
            ))}
          </TimelineList>
        </div>
      ))}
    </section>
  );
}

export default function RecordPage() {
  return (
    <SessionReady>
      <RecordScreen />
    </SessionReady>
  );
}
