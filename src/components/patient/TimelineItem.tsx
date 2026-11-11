import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Pill, type Tone } from "@/components/ui/Pill";

/**
 * Timeline, from Figma "Timeline Event Card" (163:7141) as on p-record and
 * the portal's timeline column.
 *
 *   <TimelineYear>2026</TimelineYear>
 *   <TimelineList>
 *     <TimelineItem kind="result" date="5 JAN 2026" title="Blood test..." meta="Mater Hospital" href="/record/..." />
 *   </TimelineList>
 *
 * A dot on a grey spine marks each entry; its colour follows the entry kind
 * (ENTRY_KINDS) and the kind is also written in a tag, so colour is never the
 * only signal. Upcoming entries get a hollow dot and grey text.
 */

export type EntryKind =
  | "visit"
  | "result"
  | "prescription"
  | "note"
  | "letter"
  | "imaging"
  | "vaccination"
  | "session_notes";

/** Label and colour for each `entries.kind`. Reuse this wherever a kind is shown. */
export const ENTRY_KINDS: Record<EntryKind, { label: string; tone: Tone }> = {
  visit: { label: "Visit", tone: "indigo" },
  result: { label: "Result", tone: "teal" },
  prescription: { label: "Prescription", tone: "peach" },
  note: { label: "Note", tone: "neutral" },
  letter: { label: "Letter", tone: "indigo" },
  imaging: { label: "Imaging", tone: "teal" },
  vaccination: { label: "Vaccination", tone: "teal" },
  session_notes: { label: "Session notes", tone: "indigo" },
};

const dot: Record<Tone, string> = {
  indigo: "bg-timeline-visit",
  teal: "bg-timeline-test",
  peach: "bg-timeline-meds",
  red: "bg-status-danger",
  neutral: "bg-text-primary",
};

export function TimelineYear({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-body-tiny font-medium text-text-tertiary", className)}>{children}</h3>
  );
}

export function TimelineList({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("flex flex-col", className)}>{children}</ol>;
}

export type TimelineItemProps = {
  kind: EntryKind;
  /** Display date, already formatted: "5 JAN 2026". */
  date: string;
  /** Machine date for <time dateTime>, e.g. "2026-01-05". */
  dateTime?: string;
  title: ReactNode;
  meta?: ReactNode;
  href?: string;
  upcoming?: boolean;
  className?: string;
};

export function TimelineItem({
  kind,
  date,
  dateTime,
  title,
  meta,
  href,
  upcoming = false,
  className,
}: TimelineItemProps) {
  const k = ENTRY_KINDS[kind];
  const card = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <time
          dateTime={dateTime}
          className={cn("text-body-tiny leading-[1.3]", upcoming ? "text-text-tertiary" : "text-indigo-text")}
        >
          {upcoming && <span className="sr-only">Upcoming, </span>}
          {date}
        </time>
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-label font-medium",
              upcoming ? "text-text-tertiary" : "text-text-primary",
            )}
          >
            {title}
          </span>
          <span aria-hidden="true" className="size-1 rounded-full bg-border-default" />
          <Pill tone={k.tone} size="sm">
            {k.label}
          </Pill>
        </span>
        {meta && <span className="text-body-sm text-text-tertiary">{meta}</span>}
      </span>
      {href && (
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center text-text-primary">
          <ChevronRight className="size-4" />
        </span>
      )}
    </>
  );

  const cardClasses = cn(
    "flex min-w-0 flex-1 items-center gap-3 rounded-md bg-surface-card px-6 py-[18px]",
    href && "transition-colors duration-150 hovered:bg-neutral-50",
  );

  return (
    <li className={cn("group relative flex gap-4 pb-3", className)}>
      <span aria-hidden="true" className="relative flex w-5 shrink-0 justify-center pt-7">
        <span
          className={cn(
            "relative z-10 size-3.5 rounded-full",
            upcoming ? "border-2 border-border-strong bg-surface-card" : dot[k.tone],
          )}
        />
        <span className="absolute bottom-0 top-7 w-0.5 bg-timeline-spine group-last:hidden" />
      </span>
      {href ? (
        <Link href={href} className={cardClasses}>
          {card}
        </Link>
      ) : (
        <div className={cardClasses}>{card}</div>
      )}
    </li>
  );
}
