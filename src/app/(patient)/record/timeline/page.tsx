"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddLink } from "@/components/patient/AddLink";
import { SessionReady } from "@/components/patient/PatientSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailBlock } from "@/components/ui/DetailBlock";
import { YearRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { dayKey } from "@/lib/dates";
import { capitalise, eventCaption, eventMeta, loadSection, type HealthEvent } from "@/lib/patient/record";
import { useDesktop } from "@/lib/useDesktop";
import { useLoad } from "@/lib/useLoad";
import { PaneHint } from "../../_components/PaneHint";
import { LoadStatus, SubScreen } from "../../_components/Screens";
import { MENTAL_HEALTH_LINE } from "../../_components/forms/FormBits";

type Filter = "all" | "infection" | "condition";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "infection", label: "Infections" },
  { value: "condition", label: "Conditions" },
];

async function loadEvents() {
  return (await loadSection("full_timeline")).data.events;
}

/**
 * Full timeline (board TimelineA2, BRIEF.md 5.8): All | Infections |
 * Conditions, then one card of rows grouped by year (the year in Sora on the
 * first row of each, accent for this year), newest first. A row opens the
 * bottom sheet with Seen by, Outcome, Prescribed and Doctor's notes; blocks
 * with nothing in them are left out.
 *
 * Not on the board: the sheet's "Edit" (a full-screen form, where Delete
 * is) and "Add to your timeline" under the card.
 *
 * At desktop widths the chosen event opens in the pane beside the list
 * instead of a sheet (the portal's Full timeline), and its row is marked.
 */
function TimelineScreen() {
  const desktop = useDesktop();
  const data = useLoad(loadEvents);
  const [filter, setFilter] = useState<Filter>("all");
  const asked = useSearchParams().get("event");
  const [openId, setOpenId] = useState<string | null>(asked);
  // Back from an edit (`?event=<id>`): open that event again. Next.js may keep this screen in memory.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (asked) setOpenId(asked);
  }, [asked]);

  function close() {
    setOpenId(null);
    if (asked) window.history.replaceState(window.history.state, "", "/record/timeline");
  }
  const thisYear = dayKey().slice(0, 4);

  const events = data.status === "ready" ? data.data : [];
  const list = events.filter((e) => filter === "all" || e.kind === filter);
  const open = events.find((e) => e.id === openId) ?? null;

  return (
    <SubScreen
      title="Timeline"
      backHref="/record"
      backLabel="Back to Record"
      tabBar
      detail={open ? <EventPane event={open} /> : <PaneHint>Choose an entry to see it here.</PaneHint>}
    >
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
        <SegmentedControl<Filter> label="Show" options={FILTERS} value={filter} onChange={setFilter} />
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : list.length === 0 ? (
          <p className="py-2 text-body text-ink-2">
            {events.length === 0
              ? "Nothing on your timeline yet. Add illnesses and diagnoses to keep them in one place."
              : filter === "infection"
                ? "No infections on your timeline."
                : "No conditions on your timeline."}
          </p>
        ) : (
          <Card as="ul" padding="none" divided aria-label="Timeline" className="px-4.5 py-1">
            {list.map((e, i) => {
              const year = e.occurred_on.slice(0, 4);
              const first = i === 0 || list[i - 1].occurred_on.slice(0, 4) !== year;
              return (
                <li key={e.id}>
                  <YearRow
                    year={year}
                    showYear={first}
                    current={year === thisYear}
                    title={e.title}
                    caption={eventCaption(e)}
                    onClick={() => setOpenId(e.id)}
                    selected={desktop ? e.id === openId : undefined}
                  />
                </li>
              );
            })}
          </Card>
        )}
        <AddLink href="/record/timeline/new" height={44}>
          Add to your timeline
        </AddLink>
      </div>
      <EventSheet event={desktop ? null : open} onClose={close} />
    </SubScreen>
  );
}

function EventSheet({ event: e, onClose }: { event: HealthEvent | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(e)}
      onClose={onClose}
      title={e?.title ?? ""}
      meta={e ? eventMeta(e) : undefined}
      actions={e && <EditEvent event={e} />}
    >
      {e && <EventBlocks event={e} />}
    </BottomSheet>
  );
}

/** The same event in the pane beside the list, at desktop widths. */
function EventPane({ event: e }: { event: HealthEvent }) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      <div className="flex min-h-14 flex-col justify-center pt-1">
        <h2 className="font-display text-title-md font-light">{e.title}</h2>
        <p className="text-body text-ink-2">{eventMeta(e)}</p>
      </div>
      <EventBlocks event={e} />
      <EditEvent event={e} className="w-fit" />
    </div>
  );
}

function EditEvent({ event: e, className }: { event: HealthEvent; className?: string }) {
  return (
    <ButtonLink href={`/record/timeline/${e.id}/edit`} variant="text" aria-label={`Edit ${e.title}`} className={className}>
      Edit
    </ButtonLink>
  );
}

/** Seen by, Outcome, Prescribed and Doctor's notes; blocks with nothing in them are left out. */
function EventBlocks({ event: e }: { event: HealthEvent }) {
  return (
    <>
      {e.seen_by && <DetailBlock label="Seen by">{e.seen_by}</DetailBlock>}
      {e.outcome && <DetailBlock label="Outcome">{capitalise(e.outcome)}</DetailBlock>}
      {e.prescriptions.length > 0 && (
        <DetailBlock
          label="Prescribed"
          items={e.prescriptions.map((p) => ({ name: p.name, detail: p.detail ?? undefined }))}
        />
      )}
      {e.notes && <DetailBlock label="Doctor's notes">{e.notes}</DetailBlock>}
      {e.is_mental_health && (
        <Notice tone="neutral">{MENTAL_HEALTH_LINE}</Notice>
      )}
    </>
  );
}

export default function TimelinePage() {
  return (
    <SessionReady>
      <TimelineScreen />
    </SessionReady>
  );
}
