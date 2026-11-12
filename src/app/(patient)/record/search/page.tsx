"use client";

import { useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import type { IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { formatShortDate } from "@/lib/dates";
import { withBack } from "@/lib/back";
import {
  capitalise,
  ENTRY_KIND_LABEL,
  entryIcon,
  entryTitle,
  EVENT_KIND_LABEL,
  formatAtPrecision,
  loadSections,
} from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, SubScreen } from "../../_components/Screens";

type Group = "all" | "entries" | "medications" | "conditions" | "timeline" | "documents";

const GROUPS: { value: Group; label: string }[] = [
  { value: "all", label: "All" },
  { value: "entries", label: "Visits and notes" },
  { value: "medications", label: "Medications" },
  { value: "conditions", label: "Conditions" },
  { value: "timeline", label: "Timeline" },
  { value: "documents", label: "Documents" },
];

type Hit = { key: string; group: Exclude<Group, "all">; title: string; caption: string; icon: IconName; href: string; text: string };

async function loadAll(): Promise<Hit[]> {
  const r = await loadSections("recent_visits", "full_timeline", "conditions", "medications", "documents");
  const back = "/record/search";
  return [
    ...[...r.recent_visits.upcoming, ...r.full_timeline.visits].map((e) => ({
      key: `e-${e.id}`,
      group: "entries" as const,
      title: entryTitle(e),
      caption: `${ENTRY_KIND_LABEL[e.kind]}, ${formatShortDate(e.occurs_at)}`,
      icon: entryIcon(e),
      href: withBack(`/record/${e.id}`, back),
      text: [entryTitle(e), ENTRY_KIND_LABEL[e.kind], e.clinician, e.place, e.body].join(" "),
    })),
    ...[...r.medications.current, ...r.medications.past].map((m) => ({
      key: `m-${m.id}`,
      group: "medications" as const,
      title: m.name,
      caption: [m.strength_label, m.status === "past" ? "Past" : null].filter(Boolean).join(", "),
      icon: "pill" as const,
      href: m.status === "past" ? `/meds/${m.id}?from=past` : `/meds/${m.id}`,
      text: [m.name, m.indication, m.prescriber, m.drug_class].join(" "),
    })),
    ...r.conditions.conditions.map((c) => ({
      key: `c-${c.id}`,
      group: "conditions" as const,
      title: c.name,
      caption: capitalise(c.status),
      icon: "heart-pulse" as const,
      href: `/record/conditions/${c.id}`,
      text: [c.name, c.clinician, c.specialty].join(" "),
    })),
    ...r.full_timeline.events.map((e) => ({
      key: `t-${e.id}`,
      group: "timeline" as const,
      title: e.title,
      caption: `${EVENT_KIND_LABEL[e.kind]}, ${formatAtPrecision(e.occurred_on, e.date_precision)}`,
      icon: "clock" as const,
      href: `/record/timeline?event=${e.id}`,
      text: [e.title, e.seen_by, e.notes, ...e.prescriptions.map((p) => p.name)].join(" "),
    })),
    ...r.documents.documents.map((d) => ({
      key: `d-${d.id}`,
      group: "documents" as const,
      title: d.title,
      caption: d.document_date ? formatAtPrecision(d.document_date, "day") : "Document",
      icon: "document" as const,
      href: `/profile/documents/${d.id}`,
      text: d.title,
    })),
  ];
}

/**
 * Search your record (F3; no board): one field over visits, notes,
 * results, medications, conditions, timeline events and documents, and a
 * filter by kind. Reached from Record's header. Matches every word typed,
 * in any order, ignoring case.
 */
function SearchScreen() {
  const data = useLoad(loadAll);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits =
    data.status === "ready"
      ? data.data.filter(
          (h) => (group === "all" || h.group === group) && words.every((w) => h.text.toLowerCase().includes(w)),
        )
      : [];
  const asked = words.length > 0 || group !== "all";

  return (
    <SubScreen title="Search your record" titleSize="md" backHref="/record" backLabel="Back to Record" tabBar>
      <div className="flex flex-col gap-3.5 px-5 pb-6 pt-3.5">
        <TextField label="Search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        <SegmentedControl label="Show" options={GROUPS} value={group} onChange={setGroup} fill={false} />
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : !asked ? (
          <p className="text-body text-ink-2">Type a word, or choose what to show.</p>
        ) : (
          <>
            <p role="status" className="text-caption text-ink-2">
              {hits.length === 0 ? "Nothing matches." : hits.length === 1 ? "1 match" : `${hits.length} matches`}
            </p>
            {hits.length > 0 && (
              <Card as="ul" aria-label="Matches">
                {hits.slice(0, 100).map((h) => (
                  <li key={h.key}>
                    <ListRow icon={h.icon} title={h.title} caption={h.caption || undefined} href={h.href} chevron padY={11} />
                  </li>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </SubScreen>
  );
}

export default function SearchPage() {
  return (
    <SessionReady>
      <SearchScreen />
    </SessionReady>
  );
}
