"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ENTRY_KINDS } from "@/components/patient/TimelineItem";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import type { Entry } from "../../_lib/api";
import { entryDateParts, formatEntryDate, isoDay } from "../../_lib/format";

/** Page title block: "Overview" in Sora Light 40, a meta line under it. */
export function PageTitle({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[34px] font-light leading-tight tracking-[-0.01em] lg:text-[40px]">{title}</h1>
      {meta && <p className="mt-1 text-body-tiny text-text-tertiary">{meta}</p>}
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
      <h2 id={id} className="font-display text-[28px] font-light leading-tight lg:text-[34px]">
        {title} {count && <span className="ml-1 font-sans text-body-sm text-text-tertiary">{count}</span>}
      </h2>
      {link && (
        <Link href={link.href} className="hit-area shrink-0 rounded-xs text-label font-medium text-indigo-text">
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** A white card that holds a list of rows (c-overview's conditions and medications). */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-pill-tight bg-surface-card px-6 py-4 shadow-card sm:px-8", className)}>{children}</div>;
}

/** Placeholder while a section loads. Polite, so it is not read on every page. */
export function LoadingRecord() {
  return (
    <p role="status" className="py-12 text-center text-body-sm text-text-tertiary">
      Loading the record…
    </p>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body-sm text-text-tertiary">{children}</p>;
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
 * A timeline row as on c-timeline: the day and month, a dot, the title, the
 * meta line and the kind tag. Entries with a body (results, letters, session
 * notes) expand to show it; the whole header is the button.
 */
export function TimelineRow({ entry, upcoming = false }: { entry: Entry; upcoming?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const d = entryDateParts(entry.occurs_at);
  const k = ENTRY_KINDS[entry.kind];
  const hasBody = Boolean(entry.body?.trim());
  const dot = {
    indigo: "bg-timeline-visit",
    teal: "bg-timeline-test",
    peach: "bg-timeline-meds",
    red: "bg-status-danger",
    neutral: "bg-text-primary",
  }[k.tone];

  const head = (
    <>
      <time dateTime={isoDay(entry.occurs_at)} className="flex w-10 shrink-0 flex-col items-center">
        <span className="sr-only">{upcoming ? "Upcoming, " : ""}{formatEntryDate(entry.occurs_at)}</span>
        <span aria-hidden="true" className="font-display text-[22px] font-light leading-none">
          {d.day}
        </span>
        <span aria-hidden="true" className="mt-1 text-body-tiny text-text-tertiary">
          {d.month}
        </span>
      </time>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", upcoming ? "border border-border-strong bg-surface-card" : dot)} />
          <span className="text-body-sm font-bold">{entry.title}</span>
        </span>
        {entryMeta(entry) && <span className="text-body-sm text-text-tertiary">{entryMeta(entry)}</span>}
        <span>
          <Pill tone={k.tone} size="sm">
            {k.label}
          </Pill>
        </span>
      </span>
      {hasBody && (
        <ChevronDown
          aria-hidden="true"
          className={cn("mt-1 size-4 shrink-0 transition-transform duration-150", open && "rotate-180")}
        />
      )}
    </>
  );

  return (
    <li className="border-b border-border-default py-5 last:border-b-0">
      {hasBody ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex w-full items-start gap-4 rounded-sm text-left"
        >
          {head}
        </button>
      ) : (
        <div className="flex items-start gap-4">{head}</div>
      )}
      {hasBody && (
        <div id={panelId} hidden={!open} className="mt-3 ml-14 whitespace-pre-line rounded-md bg-surface-page px-4 py-3 text-body-sm">
          {entry.body}
        </div>
      )}
    </li>
  );
}
