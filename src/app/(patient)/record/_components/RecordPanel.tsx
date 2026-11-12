"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { CriticalSafetyStrip } from "@/components/patient/CriticalSafetyStrip";
import { AddLink } from "@/components/patient/AddLink";
import { PageHeader } from "@/components/patient/PageHeader";
import { usePatientSession } from "@/components/patient/PatientSession";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl, tabPanelProps } from "@/components/ui/SegmentedControl";
import { StateMessage } from "@/components/ui/StateMessage";
import { dayKey, formatShortDate } from "@/lib/dates";
import {
  capitalise,
  conditionCaption,
  ENTRY_KIND_LABEL,
  entryIcon,
  entryTitle,
  loadSections,
  type RecordCondition,
  type RecordEntry,
  type Relative,
} from "@/lib/patient/record";
import { allergyLabels, type Profile } from "@/lib/patient/types";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus } from "../../_components/Screens";

export type RecordTab = "timeline" | "conditions" | "family";
type Tab = RecordTab;

const TABS: { value: Tab; label: string }[] = [
  { value: "timeline", label: "Timeline" },
  { value: "conditions", label: "Conditions" },
  { value: "family", label: "Family" },
];

async function loadRecord() {
  const r = await loadSections("recent_visits", "full_timeline", "conditions", "family_history");
  return {
    // Upcoming latest first, then the past newest first (RecordA2: 29 Dec, 25 Nov, 11 Nov, 2 Nov...).
    timeline: [...[...r.recent_visits.upcoming].reverse(), ...r.full_timeline.visits],
    conditions: r.conditions.conditions,
    relatives: r.family_history.relatives,
  };
}

/** The pinned facts in RecordA2's words: "Penicillin allergy", "Blood type A+", implants as typed. */
function safetyFacts(p: Pick<Profile, "allergies" | "blood_type" | "implants">): string[] {
  return [
    ...allergyLabels(p.allergies),
    ...(p.blood_type ? [`Blood type ${p.blood_type}`] : []),
    ...p.implants,
  ];
}

/**
 * Record (board RecordA2): the pinned safety facts, then three tabs.
 * - Timeline: upcoming and past entries, upcoming dates in accent; each past
 *   row opens the entry (/record/[id]); upcoming rows are not links. "View full timeline" leads to
 *   /record/timeline.
 * - Conditions: each opens its detail; "Add a condition".
 * - Family: the family tree card (/record/family), a short list of
 *   relatives, "Add a relative".
 *
 * `?tab=conditions` or `?tab=family` opens on that tab (detail screens send
 * the patient back to the tab they came from).
 *
 * The panel is the Record screen's whole content, header included. At
 * desktop widths it is also the list beside an entry or a condition
 * (`level={2}`, `current` marks the open row, `syncUrl={false}` leaves the
 * detail's address alone).
 */
export function RecordPanel({
  level = 1,
  initialTab,
  current,
  syncUrl = true,
}: {
  level?: 1 | 2;
  initialTab?: Tab;
  /** The entry or condition open beside the list. */
  current?: string;
  syncUrl?: boolean;
}) {
  const { profile } = usePatientSession();
  const params = useSearchParams();
  const asked = params.get("tab");
  const askedTab: Tab = asked === "conditions" || asked === "family" ? asked : "timeline";
  const [tab, setTab] = useState<Tab>(initialTab ?? askedTab);
  // Next.js keeps this screen alive: a later visit to /record?tab=... (after
  // "Add a condition", say) must open that tab, not the one left showing.
  const [seenAsked, setSeenAsked] = useState(asked);
  if (syncUrl && !initialTab && asked !== seenAsked) {
    setSeenAsked(asked);
    setTab(askedTab);
  }
  const data = useLoad(loadRecord);
  // Unique per screen: Next.js keeps earlier screens in the page, hidden.
  const tabIds = useId();
  const facts = safetyFacts(profile);

  function choose(next: Tab) {
    setTab(next);
    if (!syncUrl) return;
    // Keep the tab on Back without adding a history entry.
    const url = next === "timeline" ? "/record" : `/record?tab=${next}`;
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <>
      <PageHeader
        title="Record"
        height={48}
        level={level}
        // Not on RecordA2: search over the whole record (F3).
        action={level === 1 ? <IconLink href="/record/search" icon="search" label="Search your record" size={36} /> : undefined}
      />
      <div className="flex flex-col gap-3.5 px-5 pb-6 pt-3.5">
        <div className="flex flex-col gap-1">
          <CriticalSafetyStrip items={facts} allergyIcon={false} />
          {facts.length === 0 && (
            <ButtonLink
              href="/profile/edit#critical"
              variant="text"
              size="sm"
              className="w-fit"
              iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}
            >
              Add allergies or blood type
            </ButtonLink>
          )}
        </div>

        <SegmentedControl<Tab>
          label="Record sections"
          mode="tabs"
          idBase={tabIds}
          options={TABS}
          value={tab}
          onChange={choose}
        />

        <div {...tabPanelProps(tabIds, tab)} className="flex flex-col">
          {data.status !== "ready" ? (
            <LoadStatus status={data.status} onRetry={data.reload} />
          ) : tab === "timeline" ? (
            <TimelineTab entries={data.data.timeline} current={current} />
          ) : tab === "conditions" ? (
            <ConditionsTab conditions={data.data.conditions} current={current} />
          ) : (
            <FamilyTab relatives={data.data.relatives} />
          )}
        </div>
      </div>
    </>
  );
}

function TimelineTab({ entries, current }: { entries: RecordEntry[]; current?: string }) {
  if (entries.length === 0) {
    return (
      <StateMessage
        message="Nothing on your timeline yet. Visits, results, prescriptions and notes you add show up here."
        action={{ label: "Add to your record", href: "/add" }}
      />
    );
  }
  return (
    // RecordA2: the card and "View full timeline" are 14px apart (the board's column gap).
    <div className="flex flex-col gap-3.5">
      <Card as="ul">
        {entries.map((e) => (
          <li key={e.id}>
            <ListRow
              icon={entryIcon(e)}
              title={entryTitle(e)}
              caption={ENTRY_KIND_LABEL[e.kind]}
              value={<time dateTime={dayKey(e.occurs_at)}>{formatShortDate(e.occurs_at)}</time>}
              valueStyle={e.upcoming ? "accent" : "caption"}
              srSuffix={e.upcoming ? ", upcoming" : undefined}
              // Upcoming items are not clickable; past ones open their detail (BRIEF.md 4.3, 5.6).
              href={e.upcoming ? undefined : `/record/${e.id}`}
              current={e.id === current}
              padY={11}
            />
          </li>
        ))}
      </Card>
      <div className="flex flex-wrap gap-x-6">
        <ButtonLink
          href="/record/timeline"
          variant="text"
          size="md"
          className="w-fit"
          iconRight={<Icon name="chevron-right" size={18} strokeWidth={2.25} />}
        >
          View full timeline
        </ButtonLink>
        {/* Not on RecordA2: the way to the vitals (F1). */}
        <ButtonLink
          href="/record/vitals"
          variant="text"
          size="md"
          className="w-fit"
          iconRight={<Icon name="chevron-right" size={18} strokeWidth={2.25} />}
        >
          Vitals
        </ButtonLink>
      </div>
    </div>
  );
}

function ConditionsTab({ conditions, current }: { conditions: RecordCondition[]; current?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {conditions.length === 0 ? (
        <p className="py-2 text-body text-ink-2">No conditions yet.</p>
      ) : (
        <Card as="ul">
          {conditions.map((c) => (
            <li key={c.id}>
              <ListRow
                title={c.name}
                caption={conditionCaption(c) || undefined}
                value={capitalise(c.status)}
                href={`/record/conditions/${c.id}`}
                current={c.id === current}
                padY={12}
              />
            </li>
          ))}
        </Card>
      )}
      <AddLink href="/record/conditions/new">Add a condition</AddLink>
    </div>
  );
}

/** Parents first, then everyone else with a known condition; three at most (RecordA2's short list). */
function shortList(relatives: Relative[]): Relative[] {
  const withConditions = relatives.filter((r) => r.conditions.length > 0);
  const parents = withConditions.filter((r) => r.relation === "mother" || r.relation === "father");
  const others = withConditions.filter((r) => !parents.includes(r));
  return [...parents, ...others].slice(0, 3);
}

function FamilyTab({ relatives }: { relatives: Relative[] }) {
  const short = shortList(relatives);
  return (
    <div className="flex flex-col gap-3.5">
      <Link
        href="/record/family"
        className="block overflow-hidden rounded-card border border-border-card bg-surface text-ink transition-colors duration-150 ease-out hovered:text-accent-alt"
      >
        <MiniTree relatives={relatives} />
        <span className="flex items-center justify-between border-t border-border-row px-4.5 pb-3.5 pt-3">
          <span className="flex flex-col">
            <span className="text-row font-medium">Family tree</span>
            <span className="text-caption text-ink-2">
              {relatives.length === 1 ? "1 relative" : `${relatives.length} relatives`}
            </span>
          </span>
          <Icon name="chevron-right" size={20} className="text-ink-2" />
        </span>
      </Link>

      <section aria-labelledby="relatives-label" className="flex flex-col gap-1.5">
        <SectionHeading id="relatives-label">Relatives</SectionHeading>
        <Card as="ul">
          {short.map((r) => (
            <li key={r.id}>
              <ListRow
                title={r.label}
                caption={r.conditions.map((c) => c.label).join(", ")}
                href={`/record/family?relative=${r.id}`}
                padY={10}
              />
            </li>
          ))}
          <li>
            {/* RecordA2 draws this row 40px tall (10px padding); 44 keeps the phone's touch target. */}
            <AddLink href="/record/family?add=relative" height={44} className="w-full">
              Add a relative
            </AddLink>
          </li>
        </Card>
        {relatives.length > 0 && short.length === 0 && (
          <p className="text-caption text-ink-2">No conditions known in your family yet.</p>
        )}
      </section>
    </div>
  );
}

/**
 * The small tree on the family card (RecordA2): grandparents, parents, you
 * (filled) and a sibling, drawn only where the relative exists. Decorative:
 * the card's words say what it is, and the tree itself is on /record/family.
 */
function MiniTree({ relatives }: { relatives: Relative[] }) {
  const has = (relation: string) => relatives.some((r) => r.relation === relation);
  const mgm = has("maternal_grandmother");
  const mgf = has("maternal_grandfather");
  const pgm = has("paternal_grandmother");
  const pgf = has("paternal_grandfather");
  const mum = has("mother");
  const dad = has("father");
  const sibling = has("brother") || has("sister");
  return (
    <svg aria-hidden="true" width="100%" height="104" viewBox="0 0 318 104" fill="none" className="mt-3 block">
      <g className="stroke-tree-faint" strokeWidth="2" strokeLinecap="round">
        {mgm && mgf && <path d="M62 16H112" />}
        {pgm && pgf && <path d="M206 16H256" />}
        {mum && (mgm || mgf) && <path d="M87 16V54" />}
        {dad && (pgm || pgf) && <path d="M231 16V54" />}
        {mum && dad && <path d="M96 54H222" />}
        {(mum || dad) && <path d={sibling ? "M159 54V72" : "M159 54V72H135V86"} />}
        {sibling && <path d="M135 72H183M135 72V86M183 72V86" />}
      </g>
      <g className="fill-surface stroke-tree-node" strokeWidth="2">
        {mgm && <circle cx="54" cy="16" r="8" />}
        {mgf && <circle cx="120" cy="16" r="8" />}
        {pgm && <circle cx="198" cy="16" r="8" />}
        {pgf && <circle cx="264" cy="16" r="8" />}
        {mum && <circle cx="87" cy="54" r="8" />}
        {dad && <circle cx="231" cy="54" r="8" />}
        {sibling && <circle cx="183" cy="94" r="8" />}
      </g>
      <circle cx="135" cy="94" r="8" className="fill-accent" />
    </svg>
  );
}
