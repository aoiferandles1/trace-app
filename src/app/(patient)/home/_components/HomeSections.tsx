"use client";

import { useId, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { formatShortDate } from "@/lib/dates";
import { capitalise, URGENT_REFILL_DAYS, type RecordMedication } from "@/lib/patient/record";

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

const GROUPS = ["Morning", "Evening", "As needed"] as const;

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
 * Today's medicines (owner's choice, Nov 2026: Idea 4 of the Home mockups, as
 * a plain list). The current medications grouped by when they are taken
 * (the record's schedule: Morning, Evening, As needed; anything without one
 * under "Other"). No ticks: the record keeps no log of doses taken.
 */
export function TodaysMedicines({ meds }: { meds: RecordMedication[] }) {
  const headingId = useId();
  const groups = [
    ...GROUPS.map((label) => ({ label, meds: meds.filter((m) => m.schedule === label) })),
    { label: "Other", meds: meds.filter((m) => !m.schedule) },
  ].filter((g) => g.meds.length > 0);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <SectionHeading id={headingId}>{"Today's medicines"}</SectionHeading>
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
                  const caption = medicineCaption(m);
                  return (
                    <li key={m.id}>
                      <ListRow
                        title={m.name}
                        caption={caption.text}
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
