"use client";

import { useId, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { TickToggle } from "@/components/ui/Toggle";
import { formatShortDate, formatTime } from "@/lib/dates";
import { capitalise, errorCode, URGENT_REFILL_DAYS, type RecordMedication } from "@/lib/patient/record";
import { createClient } from "@/lib/supabase/client";

/**
 * Home's share card on a day without a visit (owner's choice, Nov 2026: Idea 1
 * of the Home mockups). The appointment day keeps the accent TodayCard; every
 * other day this quieter white card keeps sharing one tap away: what it is,
 * who you last shared with, and a secondary button to /share.
 */
export function ShareCard({ lastShare }: { lastShare: { name: string; endedAt: string } | null }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Icon name="share" className="mt-0.5 shrink-0 text-accent" />
          <div className="flex min-w-0 flex-col">
            <h2 id={titleId} className="text-row font-semibold text-ink">
              Share your record
            </h2>
            <p className="text-caption text-ink-2">
              {lastShare
                ? `Last shared with ${lastShare.name}, ${formatShortDate(lastShare.endedAt)}`
                : "Choose what a doctor sees, and for how long"}
            </p>
          </div>
        </div>
        <ButtonLink href="/share" variant="secondary" size="md" fullWidth iconLeft={<Icon name="share" size={18} strokeWidth={2} />}>
          Share record
        </ButtonLink>
      </Card>
    </section>
  );
}

/** A section heading with a short caption at its right ("31 Oct"). */
export function HeadingWithMeta({ id, children, meta }: { id: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <SectionHeading id={id}>{children}</SectionHeading>
      {meta && <p className="shrink-0 text-caption text-ink-2">{meta}</p>}
    </div>
  );
}

/** A time of day a dose can be ticked for (`medication_doses.slot`). */
export type DoseSlot = "morning" | "midday" | "evening" | "bedtime" | "other";

/** Today's ticked doses: `${medication id}:${slot}` to the time it was ticked. */
export type DoseLog = Record<string, string>;

export const doseKey = (medicationId: string, slot: DoseSlot) => `${medicationId}:${slot}`;

/** The groups, in the day's order. "As needed" has no ticks. */
const GROUPS: { label: string; slot: DoseSlot | null; when: string; has: (m: RecordMedication) => boolean }[] = [
  { label: "Morning", slot: "morning", when: "this morning", has: (m) => m.schedule === "Morning" || isTwice(m) },
  { label: "Midday", slot: "midday", when: "at midday", has: (m) => schedule(m) === "midday" },
  { label: "Evening", slot: "evening", when: "this evening", has: (m) => m.schedule === "Evening" || isTwice(m) },
  { label: "Bedtime", slot: "bedtime", when: "at bedtime", has: (m) => schedule(m) === "bedtime" },
  { label: "As needed", slot: null, when: "", has: (m) => m.schedule === "As needed" },
];
const schedule = (m: RecordMedication) => (m.schedule as string | null)?.toLowerCase() ?? null;
const isTwice = (m: RecordMedication) => schedule(m) === "morning and evening";
const KNOWN = new Set(["morning", "midday", "evening", "bedtime", "as needed", "morning and evening"]);

/** "Tablet, once daily"; an urgent refill says so instead ("3 days left"). */
function medicineCaption(m: RecordMedication): { text?: string; urgent: boolean } {
  const left = m.supply_days_left;
  if (left !== null && left <= URGENT_REFILL_DAYS) {
    return {
      text: left < 0 ? "Refill overdue" : left === 0 ? "Refill due today" : `${left} ${left === 1 ? "day" : "days"} left`,
      urgent: true,
    };
  }
  const text = [m.form, m.frequency].filter(Boolean).join(", ");
  return { text: text ? capitalise(text) : undefined, urgent: false };
}

/**
 * Today's medicines (owner's choice, Nov 2026: Ideas 4 of the Home mockups).
 * The current medications grouped by when they are taken (the record's
 * "When": Morning, Midday, Evening, Bedtime, As needed; "Morning and evening"
 * in both; anything else under "Other"). Each dose has a tick ring that saves
 * it as taken today (`medication_doses`, only the patient sees it); "As
 * needed" has none. `doses` is null when the log cannot be read, and then the
 * list shows without ticks.
 */
export function TodaysMedicines({ meds, today, doses }: { meds: RecordMedication[]; today: string; doses: DoseLog | null }) {
  const headingId = useId();
  // Ticks made here, on top of what was loaded (null: unticked).
  const [changed, setChanged] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const groups = [
    ...GROUPS.map((g) => ({ ...g, meds: meds.filter(g.has) })),
    { label: "Other", slot: "other" as DoseSlot, when: "today", meds: meds.filter((m) => !KNOWN.has(schedule(m) ?? "")) },
  ].filter((g) => g.meds.length > 0);
  if (groups.length === 0) return null;

  const takenAt = (key: string): string | null => (key in changed ? changed[key] : (doses?.[key] ?? null));

  async function toggle(m: RecordMedication, slot: DoseSlot, on: boolean) {
    const key = doseKey(m.id, slot);
    // Not disabled while saving (that would drop keyboard focus); a second press waits.
    if (busy[key]) return;
    setBusy((b) => ({ ...b, [key]: true }));
    setProblem(null);
    setChanged((c) => ({ ...c, [key]: on ? new Date().toISOString() : null }));
    const db = createClient();
    let failed = false;
    if (on) {
      const { data, error } = await db
        .from("medication_doses")
        .insert({ medication_id: m.id, taken_on: today, slot })
        .select("taken_at")
        .single();
      // Already ticked (another tab): it is taken either way.
      if (error && !/duplicate|unique/i.test(errorCode(error) ?? "")) failed = true;
      else if (data) setChanged((c) => ({ ...c, [key]: data.taken_at }));
    } else {
      const { error } = await db
        .from("medication_doses")
        .delete()
        .eq("medication_id", m.id)
        .eq("taken_on", today)
        .eq("slot", slot);
      if (error) failed = true;
    }
    if (failed) {
      setChanged((c) => ({ ...c, [key]: on ? null : (doses?.[key] ?? new Date().toISOString()) }));
      setProblem(`${m.name} couldn't be saved. Check your connection and try again.`);
    }
    setBusy((b) => ({ ...b, [key]: false }));
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <SectionHeading id={headingId}>{"Today's medicines"}</SectionHeading>
      {problem && (
        <p role="alert" className="text-caption text-critical">
          {problem}
        </p>
      )}
      <Card padding="none" className="px-4.5 pb-0.5 pt-3">
        {groups.map((g, i) => {
          const labelId = `${headingId}-${i}`;
          return (
            <div key={g.label} className={i > 0 ? "border-t border-border-row pt-3" : undefined}>
              <h3 id={labelId} className="text-caption font-semibold text-ink-2">
                {g.label}
              </h3>
              <ul aria-labelledby={labelId} className="divide-y divide-border-row">
                {g.meds.map((m) => {
                  const key = g.slot ? doseKey(m.id, g.slot) : null;
                  const taken = key ? takenAt(key) : null;
                  const caption = medicineCaption(m);
                  const ticks = key !== null && doses !== null;
                  return (
                    <li key={m.id} className="flex items-center gap-1">
                      {ticks && (
                        <TickToggle
                          checked={taken !== null}
                          label={`Took ${m.name}${m.strength_label ? ` ${m.strength_label}` : ""} ${g.when}`}
                          onCheckedChange={(on) => toggle(m, g.slot!, on)}
                          className="-ml-2.5"
                        />
                      )}
                      {/* As needed lines up with the ticked rows above it. */}
                      {doses !== null && key === null && <span aria-hidden="true" className="w-8.5 shrink-0" />}
                      <ListRow
                        className="min-w-0 flex-1"
                        title={m.name}
                        caption={caption.urgent || !taken ? caption.text : `Taken ${formatTime(taken)}`}
                        captionTone={caption.urgent ? "urgent" : "default"}
                        value={m.strength_label ?? undefined}
                        valueStyle="numeral"
                        gap={12}
                        padY={10}
                        href={`/meds/${m.id}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

export type SinceItem = {
  key: string;
  /** "YYYY-MM-DD", for the order (newest first) and the date column. */
  day: string;
  date: string;
  icon: IconName;
  title: string;
  caption: string;
  href: string;
};

/**
 * What changed since the last visit (owner's choice, Nov 2026: Idea 6 of the
 * Home mockups). It takes Recent's place. On a visit day (or while a doctor
 * has access) it is "Before you go in" and sits right under the card.
 */
export function SinceLastVisit({
  items,
  title,
  meta,
}: {
  items: SinceItem[];
  title: string;
  meta?: string;
}) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <HeadingWithMeta id={headingId} meta={meta}>
        {title}
      </HeadingWithMeta>
      <Card as="ul">
        {items.map((item) => (
          <li key={item.key}>
            <ListRow
              icon={item.icon}
              title={item.title}
              caption={item.caption}
              value={<time dateTime={item.day}>{item.date}</time>}
              href={item.href}
              chevron
              padY={12}
            />
          </li>
        ))}
      </Card>
    </section>
  );
}
