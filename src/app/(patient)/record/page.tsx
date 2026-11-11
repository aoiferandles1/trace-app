"use client";

import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { PageHeader } from "@/components/patient/PageHeader";
import { TimelineItem, TimelineList, TimelineYear } from "@/components/patient/TimelineItem";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { dayKey, formatTimelineDate, yearOfIso } from "@/lib/dates";
import { conditionMeta, criticalItems, type Condition, type Entry } from "@/lib/patient/types";
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
    <TabScreen header={<PageHeader title="Record" />}>
      <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
        <section aria-labelledby="critical-label" className="flex flex-col gap-2">
          <h2 id="critical-label" className="sr-only">Critical</h2>
          <CriticalSafetyStrip items={criticalItems(profile)} />
          {criticalItems(profile).length === 0 && (
            <ButtonLink href="/profile/edit#critical" variant="text" size="sm" className="w-fit" iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}>
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
        <SectionHeading id="conditions-label">Ongoing conditions</SectionHeading>
        {ongoing.length === 0 && <p className="text-caption text-ink-2">No ongoing conditions.</p>}
        {ongoing.length > 0 && (
          <Card as="ul">
            {ongoing.map((c) => (
              <li key={c.id}>
                <ListRow
                  title={c.name}
                  caption={conditionMeta(c) || undefined}
                  value={c.status}
                  href={`/record/conditions/${c.id}`}
                />
              </li>
            ))}
          </Card>
        )}
        <ButtonLink
          href="/record/conditions/new"
          variant="text"
          size="sm"
          className="w-fit"
          iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}
        >
          Add a condition
        </ButtonLink>
      </section>
      {resolved.length > 0 && (
        <section aria-labelledby="resolved-label" className="flex flex-col gap-3">
          <SectionHeading id="resolved-label">Resolved conditions</SectionHeading>
          <Card as="ul">
            {resolved.map((c) => (
              <li key={c.id}>
                <ListRow
                  title={c.name}
                  caption={conditionMeta(c) || undefined}
                  value="resolved"
                  href={`/record/conditions/${c.id}`}
                />
              </li>
            ))}
          </Card>
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
      <SectionHeading id="timeline-label">Timeline</SectionHeading>
      {entries.length === 0 && (
        <div className="flex flex-col items-start">
          <p className="text-body text-ink-2">
            Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here.
          </p>
          <ButtonLink href="/add" variant="text">
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
