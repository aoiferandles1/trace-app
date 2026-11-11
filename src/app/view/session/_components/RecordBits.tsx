"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ENTRY_KINDS } from "@/components/patient/TimelineItem";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Entry } from "../../_lib/api";
import { entryDateParts, formatEntryDate, isoDay } from "../../_lib/format";

/** Page title block: the page title in Sora 300 (26/32 in the portal), a meta line under it. */
export function PageTitle({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-title font-light">{title}</h1>
      {meta && <p className="mt-1 text-caption text-ink-2">{meta}</p>}
    </div>
  );
}

/** "Conditions  3 active        View all" */
export function SectionHeading({
  id,
  title,
  count,
  link,
}: {
  id: string;
  title: string;
  count?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-display text-heading font-light">
        {title} {count && <span className="ml-1 font-sans text-caption text-ink-2">{count}</span>}
      </h2>
      {link && (
        <Link href={link.href} className="hit-area shrink-0 text-caption font-semibold text-accent hovered:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** A card that holds a list of rows (the overview's conditions and medications). */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-card border border-border-card bg-surface px-4.5 py-1", className)}>{children}</div>;
}

/** Placeholder while a section loads. Polite, so it is not read on every page. */
export function LoadingRecord() {
  return (
    <p role="status" className="py-12 text-center text-caption text-ink-2">
      Loading the record…
    </p>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-ink-2">{children}</p>;
}

/** Groups entries by year, newest first, keeping their order. */
export function byYear(entries: Entry[]): Array<{ year: string; entries: Entry[] }> {
  const groups: Array<{ year: string; entries: Entry[] }> = [];
  for (const e of entries) {
    const year = entryDateParts(e.occurs_at).year;
    const g = groups.find((x) => x.year === year);
    if (g) g.entries.push(e);
    else groups.push({ year, entries: [e] });
  }
  return groups;
}

export function entryMeta(e: Entry): string {
  if (e.kind === "result" && e.clinician && e.place) return `${e.place} · Ordered by ${e.clinician}`;
  return [e.clinician, e.place].filter(Boolean).join(" · ");
}

/**
 * A timeline row: the day in Sora with its month, a bare icon for the kind,
 * the title, and the kind and meta line as a caption. Entries with a body (results, letters, session
 * notes) expand to show it; the whole header is the button.
 */
export function TimelineRow({ entry, upcoming = false }: { entry: Entry; upcoming?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const d = entryDateParts(entry.occurs_at);
  const k = ENTRY_KINDS[entry.kind];
  const hasBody = Boolean(entry.body?.trim());

  const head = (
    <>
      <time dateTime={isoDay(entry.occurs_at)} className="flex w-10 shrink-0 flex-col items-center">
        <span className="sr-only">{upcoming ? "Upcoming, " : ""}{formatEntryDate(entry.occurs_at)}</span>
        <span aria-hidden="true" className={cn("font-display text-title-sm font-light", upcoming && "text-accent")}>
          {d.day}
        </span>
        <span aria-hidden="true" className={cn("text-micro", upcoming ? "text-accent" : "text-ink-2")}>
          {d.month}
        </span>
      </time>
      <Icon name={k.icon} className="mt-0.5 text-accent" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-row font-medium">{entry.title}</span>
        <span className="text-caption text-ink-2">{[k.label, entryMeta(entry)].filter(Boolean).join(", ")}</span>
      </span>
      {hasBody && (
        <Icon
          name="chevron-down"
          size={20}
          className={cn("mt-0.5 text-ink-2 transition-transform duration-150 ease-out", open && "rotate-180")}
        />
      )}
    </>
  );

  return (
    <li className="border-b border-border-row py-4 last:border-b-0">
      {hasBody ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex w-full items-start gap-4 text-left"
        >
          {head}
        </button>
      ) : (
        <div className="flex items-start gap-4">{head}</div>
      )}
      {hasBody && (
        <div id={panelId} hidden={!open} className="ml-24 mt-2 whitespace-pre-line text-body">
          {entry.body}
        </div>
      )}
    </li>
  );
}
