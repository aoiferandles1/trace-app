"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Card";
import { DetailBlock } from "@/components/ui/DetailBlock";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DayMonth, SelectableRow } from "@/components/ui/ListRow";
import { ResultRow } from "@/components/ui/RangeBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StepChart } from "@/components/ui/StepChart";
import { cn } from "@/lib/cn";
import {
  documentUrl,
  type Condition,
  type DocumentItem,
  type Entry,
  type HealthEvent,
  type Medication,
  type Relative,
} from "../../_lib/api";
import {
  capitalise,
  chartPeriods,
  conditionSub,
  currentYear,
  dayMonth,
  documentSub,
  entryFields,
  entryMeta,
  entryType,
  eventMeta,
  eventSub,
  eventYear,
  formatDateOnly,
  initials,
  isoDay,
  medicationLine,
  medicationSub,
  periodRange,
} from "../../_lib/format";
import { useNow } from "../../_lib/hooks";
import { useSection, useSession } from "./SessionContext";

/**
 * The live record's views (BRIEF.md 6.4 to 6.8, board PortalRecordE; the
 * Documents, Insurance and Mental health views have no board and follow
 * the same patterns). Each loads only its own section, and is mounted only
 * when the patient granted it (SessionFrame checks the scope first).
 *
 * Two-pane views (Recent visits, Medications, Full timeline) put the list
 * and the detail side by side when the record area has room for both
 * (600px), and stack them otherwise. Side by side, each pane scrolls inside
 * itself, as on the board.
 */

/* ------------------------------------------------------------ shared bits */

function PaneTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-title-md font-light">{children}</h2>;
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-display text-heading font-light">
      {children}
    </h2>
  );
}

function Quiet({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-caption text-ink-2", className)}>{children}</p>;
}

/** The dashed ring and words for something this share leaves out. */
function NotSharedLine({ children = "Not shared" }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-meta text-ink-2">
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-dashed border-ring-off" />
      {children}
    </p>
  );
}

function Loading() {
  return (
    <p role="status" className="pt-8.5 text-body-lg text-ink-2">
      Loading&hellip;
    </p>
  );
}

function LoadFailed() {
  return (
    <p role="alert" className="pt-8.5 text-body-lg text-ink-2">
      This part of the record could not be loaded. Reload the page to try again.
    </p>
  );
}

function TwoPane({
  list,
  listWidth = 272,
  gap = 18,
  detail,
}: {
  list: ReactNode;
  listWidth?: 272 | 292;
  /** Between the pieces of each pane: 18px for Recent visits, 16px for Medications and Full timeline (the board). */
  gap?: 16 | 18;
  detail: ReactNode;
}) {
  const gapClass = gap === 16 ? "gap-4" : "gap-4.5";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-7 pt-8.5 @min-[600px]:flex-row">
      <div
        className={cn(
          "flex flex-col @min-[600px]:min-h-0 @min-[600px]:shrink-0 @min-[600px]:overflow-y-auto",
          gapClass,
          listWidth === 292 ? "@min-[600px]:w-73" : "@min-[600px]:w-68",
        )}
      >
        {list}
      </div>
      {/* Focusable: side by side it scrolls on its own, and keyboard users must be able to scroll it. */}
      <section
        aria-live="polite"
        aria-label="Details"
        tabIndex={0}
        className={cn(
          "flex min-w-0 flex-1 flex-col border-t border-border-row pt-6 focus-visible:-outline-offset-2 @min-[600px]:min-h-0 @min-[600px]:overflow-y-auto @min-[600px]:border-l @min-[600px]:border-t-0 @min-[600px]:pl-7 @min-[600px]:pt-0",
          // Full timeline's detail keeps 18px; Medications' is 16px.
          listWidth === 292 ? "gap-4.5" : gapClass,
        )}
      >
        {detail}
      </section>
    </div>
  );
}

function DetailTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-display text-title-md font-light">{title}</h3>
      <p className="text-caption text-ink-2">{meta}</p>
    </div>
  );
}

const SCHEDULE_ICONS: Record<string, IconName> = { Morning: "sun", Evening: "moon", "As needed": "wind" };

/* ---------------------------------------------------------- not shared */

export function NotSharedView({ label, firstName }: { label: string; firstName: string }) {
  const who = firstName === "the patient" ? "The patient" : firstName;
  return (
    <div className="flex flex-col gap-4 pt-8.5">
      <PaneTitle>{label}</PaneTitle>
      <NotSharedLine>{who} did not share this part of the record.</NotSharedLine>
    </div>
  );
}

/* ------------------------------------------------------------ overview */

export function OverviewView() {
  const { overview, status } = useSession();
  if (!overview) return <Loading />;
  const d = overview.data;
  const scope = status.scope;
  const ledger = d.recent_visits ? [...d.recent_visits.upcoming.slice().reverse(), ...d.recent_visits.past] : null;

  return (
    <div className="flex flex-col gap-11 pt-8.5 @min-[640px]:flex-row @min-[640px]:gap-14">
      <div className="flex min-w-0 flex-col gap-11 @min-[640px]:flex-[2]">
        <section aria-labelledby="ov-conditions">
          <div className="mb-3">
            <SectionTitle id="ov-conditions">Conditions</SectionTitle>
          </div>
          {d.conditions === null ? (
            <NotSharedLine />
          ) : d.conditions.length === 0 ? (
            <Quiet>None recorded.</Quiet>
          ) : (
            <ul className="flex flex-col gap-4.5">
              {d.conditions.map((c) => (
                <li key={c.id} className="flex flex-col">
                  <span className="text-row-lg font-medium">{c.name}</span>
                  <span className="text-caption text-ink-2">{conditionSub(c)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ov-visits">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle id="ov-visits">Recent visits</SectionTitle>
            {ledger && (
              <Link href="/view/session/visits" className="hit-area text-caption font-semibold text-accent hovered:underline">
                View all
              </Link>
            )}
          </div>
          {ledger === null ? (
            <NotSharedLine />
          ) : ledger.length === 0 ? (
            <Quiet>No visits recorded.</Quiet>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {ledger.map((e) => {
                const dm = dayMonth(e.occurs_at);
                return (
                  <li key={e.id} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-x-3">
                    <DayMonth day={dm.day} month={dm.month} accent={e.upcoming} dateTime={isoDay(e.occurs_at)} />
                    <span className="text-row font-medium">{e.title}</span>
                    <span className={e.upcoming ? "text-caption text-accent" : "text-caption text-ink-2"}>
                      {e.upcoming ? "Upcoming" : entryType(e)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-11 @min-[640px]:flex-1">
        <section aria-labelledby="ov-meds">
          <div className="mb-3">
            <SectionTitle id="ov-meds">Medications</SectionTitle>
          </div>
          {d.medications.length === 0 ? (
            <Quiet>No current medications.</Quiet>
          ) : (
            <ul className="flex flex-col gap-4.5">
              {d.medications.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/view/session/medications?id=${encodeURIComponent(m.id)}`}
                    className="flex w-full items-center justify-between gap-2 text-left text-ink hovered:text-accent-alt"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-row-lg font-medium">
                        {m.name}{" "}
                        {m.strength_label && <span className="text-caption font-normal text-ink-2">{m.strength_label}</span>}
                      </span>
                      {m.schedule && (
                        <span className="flex items-center gap-1.5 text-caption text-ink-2">
                          <Icon name={SCHEDULE_ICONS[m.schedule] ?? "clock"} size={18} className="text-accent" />
                          {m.schedule}
                        </span>
                      )}
                    </span>
                    <Icon name="chevron-right" size={18} className="shrink-0 text-ink-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ov-vitals">
          <div className="mb-3.5 flex items-baseline justify-between gap-4">
            <SectionTitle id="ov-vitals">Vitals</SectionTitle>
            {d.vitals && (
              <p className="text-meta text-ink-2">
                <span className="sr-only">Recorded </span>
                <time dateTime={d.vitals.recorded_on}>{formatDateOnly(d.vitals.recorded_on)}</time>
              </p>
            )}
          </div>
          {d.vitals ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5.5">
              {(
                [
                  [d.vitals.systolic != null && d.vitals.diastolic != null ? `${d.vitals.systolic}/${d.vitals.diastolic}` : null, "Blood pressure"],
                  [d.vitals.heart_rate != null ? String(d.vitals.heart_rate) : null, "Heart rate, bpm"],
                  [d.vitals.weight_kg != null ? String(d.vitals.weight_kg) : null, "Weight, kg"],
                  [d.vitals.spo2 != null ? `${d.vitals.spo2}%` : null, "O2 saturation"],
                ] as Array<[string | null, string]>
              )
                .filter((v): v is [string, string] => v[0] !== null)
                .map(([value, label]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="text-meta leading-4 text-ink-2">{label}</dt>
                    <dd className="font-display text-numeral-lg font-light text-accent">{value}</dd>
                  </div>
                ))}
            </dl>
          ) : scope && !scope.recent_visits && !scope.full_timeline ? (
            <NotSharedLine />
          ) : (
            <Quiet>None recorded.</Quiet>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- recent visits */

function EntryDetail({ entry }: { entry: Entry }) {
  const fields = entryFields(entry);
  const results = entry.detail?.kind === "result" ? entry.detail.results : null;
  return (
    <>
      <DetailTitle title={entry.title} meta={entryMeta(entry)} />
      {results ? (
        <div className="flex flex-col gap-4">
          {results.length === 0 && <Quiet>No results recorded.</Quiet>}
          {results.map((r) =>
            r.ref_low != null && r.ref_high != null ? (
              <ResultRow key={r.id} name={r.name} value={r.value} unit={r.unit ?? ""} low={r.ref_low} high={r.ref_high} />
            ) : (
              <div key={r.id} className="flex flex-col">
                <span className="text-row font-medium">{r.name}</span>
                <span className="text-caption text-ink-2">{`${r.value} ${r.unit ?? ""}`.trim()}</span>
              </div>
            ),
          )}
          {results.some((r) => r.ref_low != null && r.ref_high != null) && (
            <p className="text-meta text-ink-2">The shaded part of each bar is the normal range.</p>
          )}
        </div>
      ) : fields.length > 0 ? (
        <dl className="flex flex-col gap-4">
          {fields.map((f) => (
            <DetailBlock key={f.label} label={f.label} term>
              {f.text}
            </DetailBlock>
          ))}
        </dl>
      ) : entry.body ? (
        <p className="whitespace-pre-wrap text-body-lg">{entry.body}</p>
      ) : (
        <Quiet>No details recorded.</Quiet>
      )}
    </>
  );
}

function VisitRow({ e, selected, onPick }: { e: Entry; selected: boolean; onPick: () => void }) {
  const dm = dayMonth(e.occurs_at);
  return (
    <SelectableRow
      selected={selected}
      onClick={onPick}
      leading={<DayMonth day={dm.day} month={dm.month} dateTime={isoDay(e.occurs_at)} />}
      title={e.title}
      caption={entryType(e)}
    />
  );
}

export function VisitsView() {
  const { status } = useSession();
  const fullTimeline = Boolean(status.scope?.full_timeline);
  const recent = useSection("recent_visits");
  // Older visits only when the patient also shared the full timeline.
  const full = useSection("full_timeline", fullTimeline);
  const [selected, setSelected] = useState<string | null>(null);

  if (recent.state === "loading") return <Loading />;
  if (recent.state === "error") return <LoadFailed />;
  const { past, upcoming } = recent.record.data;
  const pastIds = new Set(past.map((e) => e.id));
  const older = full.state === "ready" ? full.record.data.visits.filter((e) => !pastIds.has(e.id)) : [];
  const all = [...past, ...older];
  const current = all.find((e) => e.id === selected) ?? all[0] ?? null;

  return (
    <TwoPane
      list={
        <>
          <PaneTitle>Recent visits</PaneTitle>
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-meta leading-4 text-ink-2">Upcoming</h3>
              <ul className="flex flex-col">
                {upcoming
                  .slice()
                  .reverse()
                  .map((e) => {
                  const dm = dayMonth(e.occurs_at);
                  return (
                    <li key={e.id} className="grid grid-cols-[64px_1fr] items-center py-1.5 pl-3.75">
                      <DayMonth day={dm.day} month={dm.month} accent dateTime={isoDay(e.occurs_at)} />
                      <span className="text-label font-medium">{e.title}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <h3 className="mb-1 text-meta leading-4 text-ink-2">{past.length === 3 ? "Last 3" : "Past"}</h3>
            {past.length === 0 && <Quiet>No past visits.</Quiet>}
            {past.map((e) => (
              <VisitRow key={e.id} e={e} selected={current?.id === e.id} onPick={() => setSelected(e.id)} />
            ))}
          </div>
          {older.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <h3 className="mb-1 text-meta leading-4 text-ink-2">Earlier</h3>
              {older.map((e) => (
                <VisitRow key={e.id} e={e} selected={current?.id === e.id} onPick={() => setSelected(e.id)} />
              ))}
            </div>
          )}
          {!fullTimeline && <NotSharedLine>Older visits are in the full timeline.</NotSharedLine>}
        </>
      }
      detail={current ? <EntryDetail entry={current} /> : <Quiet>Nothing to show.</Quiet>}
    />
  );
}

/* --------------------------------------------------------- medications */

function MedicationDetail({ m, firstName }: { m: Medication; firstName: string }) {
  const periods = chartPeriods(m);
  return (
    <>
      <div className="flex flex-col gap-0.5">
        {/* Sora 300 at 28/34, the board's size here (the wordmark role has those metrics). */}
        <h3 className="font-display text-wordmark font-light">{m.name}</h3>
        <p className="text-caption text-ink-2">{medicationLine(m)}</p>
      </div>
      {periods.length > 0 && (
        <div className="w-full max-w-67.5 shrink-0">
          <StepChart periods={periods} unit={m.unit ?? ""} caption={`${m.name} strength over time`} />
        </div>
      )}
      <h4 className="mt-1 text-meta leading-4 font-medium text-ink-2">History</h4>
      {m.periods.length === 0 ? (
        <Quiet>No strength history recorded.</Quiet>
      ) : (
        <ul className="flex flex-col gap-4.5">
          {m.periods.map((p) => (
            <li key={p.id} className="grid grid-cols-[76px_1fr] gap-x-3">
              <span className="font-display text-title-sm font-light">{p.strength_label}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-caption font-medium">{periodRange(p)}</span>
                {p.prescribed_by && <span className="text-meta text-ink-2">Prescribed by {p.prescribed_by}</span>}
                {p.note !== null && p.note !== undefined && (
                  <span className="mt-1 text-caption">
                    {firstName === "the patient" ? "Patient" : firstName}: &quot;{p.note}&quot;
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function MedicationsView() {
  const { firstName } = useSession();
  const wanted = useSearchParams().get("id");
  const meds = useSection("medications");
  const [tab, setTab] = useState<"current" | "past" | null>(null);
  const [selected, setSelected] = useState<string | null>(wanted);
  // Next keeps this view alive (hidden) between visits, so a new ?id= from
  // Overview must replace the earlier choice: adjust state when it changes.
  const [lastWanted, setLastWanted] = useState(wanted);
  if (wanted !== lastWanted) {
    setLastWanted(wanted);
    setSelected(wanted);
    setTab(null);
  }

  if (meds.state === "loading") return <Loading />;
  if (meds.state === "error") return <LoadFailed />;
  const { current, past } = meds.record.data;
  const chosen = [...current, ...past].find((m) => m.id === selected);
  const activeTab = tab ?? (chosen?.status === "past" ? "past" : "current");
  const shown = activeTab === "current" ? current : past;
  const sel = shown.find((m) => m.id === selected) ?? shown[0] ?? null;

  return (
    <TwoPane
      gap={16}
      list={
        <>
          <PaneTitle>Medications</PaneTitle>
          <SegmentedControl
            label="Medication list"
            options={[
              { value: "current", label: "Current" },
              { value: "past", label: "Past" },
            ]}
            value={activeTab}
            onChange={(v) => {
              setTab(v);
              setSelected(null);
            }}
            className="shrink-0"
          />
          <div className="flex flex-col gap-0.5">
            {shown.length === 0 && <Quiet>{activeTab === "current" ? "No current medications." : "No past medications."}</Quiet>}
            {shown.map((m) => (
              <SelectableRow
                key={m.id}
                selected={sel?.id === m.id}
                onClick={() => setSelected(m.id)}
                titleSize="lg"
                title={m.name}
                caption={medicationSub(m) || undefined}
                value={m.strength_label ?? undefined}
              />
            ))}
          </div>
        </>
      }
      detail={sel ? <MedicationDetail m={sel} firstName={firstName} /> : <Quiet>Nothing to show.</Quiet>}
    />
  );
}

/* ------------------------------------------------------- full timeline */

function EventDetail({ e }: { e: HealthEvent }) {
  return (
    <>
      <DetailTitle title={e.title} meta={eventMeta(e)} />
      <dl className="flex flex-col gap-4.5">
        {e.seen_by && (
          <DetailBlock label="Seen by" term>
            {e.seen_by}
          </DetailBlock>
        )}
        {e.outcome && (
          <DetailBlock label="Outcome" term>
            {capitalise(e.outcome)}
          </DetailBlock>
        )}
        {e.prescriptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <dt className="text-meta leading-4 text-ink-2">Prescribed</dt>
            {e.prescriptions.map((p) => (
              <dd key={p.id} className="flex flex-col">
                <span className="text-row font-medium">{p.name}</span>
                {p.detail && <span className="text-caption text-ink-2">{p.detail}</span>}
              </dd>
            ))}
          </div>
        )}
        {e.notes && (
          <DetailBlock label="Doctor's notes" term>
            {e.notes}
          </DetailBlock>
        )}
      </dl>
    </>
  );
}

type EventFilter = "all" | "infection" | "condition";

export function TimelineView() {
  const { offset } = useSession();
  const now = useNow(offset, 60_000);
  const full = useSection("full_timeline");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  if (full.state === "loading") return <Loading />;
  if (full.state === "error") return <LoadFailed />;
  const events = full.record.data.events;
  const list = events.filter((e) => filter === "all" || e.kind === filter);
  const sel = list.find((e) => e.id === selected) ?? list[0] ?? null;
  const thisYear = currentYear(now);

  return (
    <TwoPane
      listWidth={292}
      gap={16}
      list={
        <>
          <PaneTitle>Full timeline</PaneTitle>
          <SegmentedControl
            label="Show"
            options={[
              { value: "all", label: "All" },
              { value: "infection", label: "Infections" },
              { value: "condition", label: "Conditions" },
            ]}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setSelected(null);
            }}
            className="shrink-0"
          />
          <div className="flex flex-col gap-0.5">
            {list.length === 0 && <Quiet>Nothing recorded.</Quiet>}
            {list.map((e, i) => {
              const year = eventYear(e);
              const first = i === 0 || eventYear(list[i - 1]) !== year;
              return (
                <SelectableRow
                  key={e.id}
                  selected={sel?.id === e.id}
                  onClick={() => setSelected(e.id)}
                  leadingWidth={56}
                  leading={
                    <span
                      aria-hidden="true"
                      className={cn("font-display text-year font-light", year === thisYear ? "text-accent" : "text-ink")}
                    >
                      {first ? year : ""}
                    </span>
                  }
                  title={e.title}
                  caption={
                    <>
                      {eventSub(e)}
                      <span className="sr-only"> {year}</span>
                    </>
                  }
                />
              );
            })}
          </div>
        </>
      }
      detail={sel ? <EventDetail e={sel} /> : <Quiet>Nothing to show.</Quiet>}
    />
  );
}

/* ----------------------------------------------------------- care team */

export function CareTeamView() {
  const { status } = useSession();
  const team = useSection("care_team");
  if (team.state === "loading") return <Loading />;
  if (team.state === "error") return <LoadFailed />;
  const me = status.clinician?.name?.trim().toLowerCase();
  const people = team.record.data.care_team;
  return (
    <div className="flex flex-col gap-7 pt-8.5">
      <PaneTitle>Care team</PaneTitle>
      {people.length === 0 ? (
        <Quiet>No one recorded.</Quiet>
      ) : (
        <ul className="grid gap-x-12 gap-y-8 @min-[560px]:grid-cols-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-4">
              <Avatar initials={initials(p.name)} size={52} tone="tint" />
              <span className="flex min-w-0 flex-col">
                <span className="text-row-lg font-medium">
                  {p.name}
                  {me && p.name.trim().toLowerCase() === me && (
                    <span className="text-caption font-normal text-ink-2"> You</span>
                  )}
                </span>
                {(p.role || p.organisation) && (
                  <span className="text-caption text-ink-2">{[p.role, p.organisation].filter(Boolean).join(", ")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------ family history */

const CATEGORY_WORDS: Record<string, string> = {
  heart: "Heart",
  diabetes: "Diabetes",
  asthma: "Asthma",
  cancer: "Cancer",
  stroke: "Stroke",
};

const SLOTS: Record<string, [number, number]> = {
  maternal_grandmother: [44, 26],
  maternal_grandfather: [132, 26],
  paternal_grandmother: [218, 26],
  paternal_grandfather: [306, 26],
  mother: [88, 176],
  father: [262, 176],
};
const CHILD_Y = 316;
const R = 26;

function relativeCondition(r: Relative): string {
  return r.conditions.length ? r.conditions.map((c) => c.label).join(", ") : "None known";
}

type TreeNode = { key: string; x: number; y: number; label: string; cond: string; me?: boolean; match: boolean; dim: boolean };

/** Lines from one or two parents (at y) down to a point (x2, y2), on the board's grid. */
function lineage(parents: number[], y: number, x2: number, y2: number): string[] {
  if (parents.length === 0) return [];
  if (parents.length === 2) {
    const [a, b] = parents.slice().sort((p, q) => p - q);
    const mid = (a + b) / 2;
    return [`M${a + R} ${y}H${b - R}`, `M${mid} ${y}V${y2}`, ...(mid === x2 ? [] : [`M${mid} ${y2}H${x2}`])];
  }
  const a = parents[0];
  const turn = (y + R + y2) / 2;
  return [`M${a} ${y + R}V${turn}H${x2}V${y2}`];
}

function FamilyTree({ nodes, width }: { nodes: TreeNode[]; width: number }) {
  const at = (k: string) => nodes.find((n) => n.key === k);
  const paths: string[] = [];
  const mother = at("mother");
  const father = at("father");
  const maternal = ["maternal_grandmother", "maternal_grandfather"].map(at).filter(Boolean) as TreeNode[];
  const paternal = ["paternal_grandmother", "paternal_grandfather"].map(at).filter(Boolean) as TreeNode[];
  if (mother) paths.push(...lineage(maternal.map((n) => n.x), 26, mother.x, mother.y - R));
  if (father) paths.push(...lineage(paternal.map((n) => n.x), 26, father.x, father.y - R));
  const children = nodes.filter((n) => n.y === CHILD_Y);
  const parents = [mother, father].filter(Boolean) as TreeNode[];
  if (parents.length > 0 && children.length > 0) {
    const bar = 270;
    const xs = children.map((c) => c.x);
    if (parents.length === 2) {
      paths.push(`M${mother!.x + R} 176H${father!.x - R}`);
      const mid = (mother!.x + father!.x) / 2;
      paths.push(`M${mid} 176V${bar}`);
      xs.push(mid);
    } else {
      paths.push(`M${parents[0].x} ${176 + R}V${bar}`);
      xs.push(parents[0].x);
    }
    paths.push(`M${Math.min(...xs)} ${bar}H${Math.max(...xs)}`);
    for (const c of children) paths.push(`M${c.x} ${bar}V${CHILD_Y - R}`);
  }
  return (
    <div aria-hidden="true" className="relative shrink-0" style={{ width, height: 392 }}>
      <svg width={width} height={392} viewBox={`0 0 ${width} 392`} fill="none" className="absolute inset-0 text-tree-line">
        <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      {nodes.map((n) => (
        <div key={n.key} className="absolute flex w-21 flex-col items-center text-center" style={{ left: n.x - 42, top: n.y - R }}>
          <span
            className={cn(
              "flex size-13 items-center justify-center rounded-full border-2",
              n.me
                ? "border-accent bg-accent text-white"
                : n.match
                  ? "border-accent bg-locked-tint text-accent"
                  : "border-tree-node bg-surface text-ink-2",
              n.dim && "opacity-35",
            )}
          >
            <Icon name="person" />
          </span>
          <span className="mt-1 text-meta leading-4 font-semibold">{n.label}</span>
          {n.cond && (
            <span className={cn("text-micro", n.match ? "font-semibold text-accent" : "text-ink-2")}>{n.cond}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FamilyView() {
  const { status, firstName } = useSession();
  const family = useSection("family_history");
  const conditions = useSection("conditions", Boolean(status.scope?.conditions));
  const [filter, setFilter] = useState("all");

  if (family.state === "loading") return <Loading />;
  if (family.state === "error") return <LoadFailed />;
  const relatives = family.record.data.relatives;
  const categories = Object.keys(CATEGORY_WORDS).filter((c) =>
    relatives.some((r) => r.conditions.some((x) => x.category === c)),
  );
  const filtering = filter !== "all";
  const matches = (r: Relative) => filtering && r.conditions.some((c) => c.category === filter);

  // Siblings sit beside the patient, the group centred under the parents.
  const siblings = relatives.filter((r) => r.relation === "sister" || r.relation === "brother");
  const childCount = 1 + siblings.length;
  let xs = Array.from({ length: childCount }, (_, i) => 175 - (90 * (childCount - 1)) / 2 + 90 * i);
  const shift = Math.max(0, 42 - Math.min(...xs));
  xs = xs.map((x) => x + shift);
  const width = Math.max(350, Math.max(...xs) + 42);
  const myConditions = conditions.state === "ready" ? conditions.record.data.conditions.length : null;

  const nodes: TreeNode[] = [];
  for (const r of relatives) {
    const slot = SLOTS[r.relation];
    if (!slot) continue;
    nodes.push({ key: r.relation, x: slot[0] + shift, y: slot[1], label: r.label, cond: relativeCondition(r), match: matches(r), dim: filtering && !matches(r) });
  }
  nodes.push({
    key: "me",
    x: xs[0],
    y: CHILD_Y,
    label: firstName === "the patient" ? "Patient" : firstName,
    cond: myConditions === null ? "" : `${myConditions} ${myConditions === 1 ? "condition" : "conditions"}`,
    me: true,
    match: false,
    dim: false,
  });
  siblings.forEach((r, i) =>
    nodes.push({ key: r.id, x: xs[i + 1], y: CHILD_Y, label: r.label, cond: relativeCondition(r), match: matches(r), dim: filtering && !matches(r) }),
  );
  // Only the first of each grandparent or parent slot fits the tree; the list has everyone.
  const seen = new Set<string>();
  const treeNodes = nodes.filter((n) => (seen.has(n.key) ? false : (seen.add(n.key), true)));

  const hits = relatives.filter(matches).map((r) => r.label);
  const summary = filtering
    ? `${CATEGORY_WORDS[filter]}: ${hits.length ? hits.join(", ") : "no one"}`
    : "Tap a condition to see who has it.";

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <PaneTitle>Family history</PaneTitle>
        <p className="text-caption text-ink-2">Contains other people&apos;s health information.</p>
      </div>
      {relatives.length === 0 ? (
        <Quiet>No relatives recorded.</Quiet>
      ) : (
        <>
          {categories.length > 0 && (
            <SegmentedControl
              label="Show relatives with"
              options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c, label: CATEGORY_WORDS[c] }))]}
              value={filter}
              onChange={setFilter}
              className="w-full max-w-87.5 self-start"
            />
          )}
          <div className="flex flex-col items-start gap-9 @min-[620px]:flex-row">
            <div className="max-w-full overflow-x-auto">
              <FamilyTree nodes={treeNodes} width={width} />
            </div>
            <div className="flex w-full min-w-0 flex-1 flex-col gap-1">
              <p aria-live="polite" className="min-h-5 text-caption text-ink-2">
                {summary}
              </p>
              <ul>
                {relatives.map((r, i) => {
                  const match = matches(r);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 py-2",
                        i < relatives.length - 1 && "border-b border-border-row",
                      )}
                    >
                      <span className="text-label font-medium">{r.label}</span>
                      <span className={cn("text-right text-caption", match ? "font-semibold text-accent" : "text-ink-2")}>
                        {relativeCondition(r)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- documents */

function DocumentRows({ docs }: { docs: DocumentItem[] }) {
  return (
    <ul className="flex flex-col">
      {docs.map((d, i) => (
        <li key={d.id} className={cn(i < docs.length - 1 && "border-b border-border-row")}>
          <a
            href={documentUrl(d.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-16 items-center gap-3.5 py-2 text-ink hovered:text-accent-alt"
          >
            <Icon name="document" className="shrink-0 text-accent" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-row font-medium">{d.title}</span>
              <span className="text-caption text-ink-2">{documentSub(d)}</span>
            </span>
            <Icon name="external" size={18} className="shrink-0 text-ink-2" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DocumentsView() {
  const docs = useSection("documents");
  if (docs.state === "loading") return <Loading />;
  if (docs.state === "error") return <LoadFailed />;
  const list = docs.record.data.documents;
  return (
    <div className="flex max-w-170 flex-col gap-4 pt-8.5">
      <PaneTitle>Documents</PaneTitle>
      {list.length === 0 ? <Quiet>No documents shared.</Quiet> : <DocumentRows docs={list} />}
    </div>
  );
}

/* ----------------------------------------------------------- insurance */

export function InsuranceView() {
  const ins = useSection("insurance");
  if (ins.state === "loading") return <Loading />;
  if (ins.state === "error") return <LoadFailed />;
  const list = ins.record.data.connections;
  return (
    <div className="flex max-w-170 flex-col gap-4 pt-8.5">
      <PaneTitle>Insurance</PaneTitle>
      {list.length === 0 ? (
        <Quiet>No insurance details included.</Quiet>
      ) : (
        list.map((c) => (
          <section key={c.id} aria-labelledby={`ins-${c.id}`} className="flex flex-col gap-4">
            <h3 id={`ins-${c.id}`} className="text-row-lg font-medium">
              {c.provider}
            </h3>
            <dl className="grid gap-x-12 gap-y-4 @min-[560px]:grid-cols-3">
              <DetailBlock label="Member number" term>
                {c.member_number_masked}
              </DetailBlock>
              {c.plan_name && (
                <DetailBlock label="Plan" term>
                  {c.plan_name}
                </DetailBlock>
              )}
              {c.renews_on && (
                <DetailBlock label="Renews" term>
                  {formatDateOnly(c.renews_on)}
                </DetailBlock>
              )}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}

/* -------------------------------------------------------- mental health */

export function MentalHealthView() {
  const mh = useSection("mental_health");
  if (mh.state === "loading") return <Loading />;
  if (mh.state === "error") return <LoadFailed />;
  const { conditions, visits, events, documents } = mh.record.data;
  const empty = conditions.length + visits.length + events.length + documents.length === 0;
  return (
    <div className="flex max-w-170 flex-col gap-9 pt-8.5">
      <PaneTitle>Mental health</PaneTitle>
      {empty && <Quiet>Nothing flagged as mental health.</Quiet>}
      {conditions.length > 0 && (
        <section aria-labelledby="mh-conditions" className="flex flex-col gap-3">
          <SectionTitle id="mh-conditions">Conditions</SectionTitle>
          <ConditionList items={conditions} />
        </section>
      )}
      {visits.length > 0 && (
        <section aria-labelledby="mh-visits" className="flex flex-col gap-3">
          <SectionTitle id="mh-visits">Visits</SectionTitle>
          <ul className="flex flex-col gap-3.5">
            {visits.map((e) => {
              const dm = dayMonth(e.occurs_at);
              return (
                <li key={e.id} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-x-3">
                  <DayMonth day={dm.day} month={dm.month} accent={e.upcoming} dateTime={isoDay(e.occurs_at)} />
                  <span className="flex flex-col">
                    <span className="text-row font-medium">{e.title}</span>
                    <span className="text-caption text-ink-2">{entryMeta(e)}</span>
                  </span>
                  <span className="text-caption text-ink-2">{e.upcoming ? "Upcoming" : entryType(e)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {events.length > 0 && (
        <section aria-labelledby="mh-events" className="flex flex-col gap-3">
          <SectionTitle id="mh-events">Timeline</SectionTitle>
          <ul className="flex flex-col gap-4.5">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col">
                <span className="text-row-lg font-medium">{e.title}</span>
                <span className="text-caption text-ink-2">{[eventMeta(e), e.seen_by].filter(Boolean).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {documents.length > 0 && (
        <section aria-labelledby="mh-docs" className="flex flex-col gap-1">
          <SectionTitle id="mh-docs">Documents</SectionTitle>
          <DocumentRows docs={documents} />
        </section>
      )}
    </div>
  );
}

function ConditionList({ items }: { items: Condition[] }) {
  return (
    <ul className="flex flex-col gap-4.5">
      {items.map((c) => (
        <li key={c.id} className="flex flex-col">
          <span className="text-row-lg font-medium">{c.name}</span>
          <span className="text-caption text-ink-2">{conditionSub(c)}</span>
        </li>
      ))}
    </ul>
  );
}
