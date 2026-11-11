import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { IconName } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The record's timeline as rows in one card (board RecordA2):
 *
 *   <TimelineYear>2026</TimelineYear>
 *   <TimelineList>
 *     <TimelineItem kind="result" date="2 Nov" title="Blood count and INR" href="/record/..." />
 *   </TimelineList>
 *
 * Each row: a bare icon for the kind, the title, the kind in words (plus any
 * meta) as the caption, and the date on the right, in accent 600 when it is
 * upcoming. With `href` the row links to its detail. (BRIEF.md 5.6 makes
 * upcoming rows plain text; that is Phase 5's change, so pass no href then.)
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

/** Label and icon for each `entries.kind`. Reuse this wherever a kind is shown. */
export const ENTRY_KINDS: Record<EntryKind, { label: string; icon: IconName }> = {
  visit: { label: "Visit", icon: "calendar" },
  result: { label: "Result", icon: "drop" },
  prescription: { label: "Prescription", icon: "pill" },
  note: { label: "Note", icon: "pencil" },
  letter: { label: "Letter", icon: "document" },
  imaging: { label: "Imaging", icon: "document" },
  vaccination: { label: "Vaccination", icon: "shield" },
  session_notes: { label: "Session notes", icon: "pencil" },
};

export function TimelineYear({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-display text-year font-light", className)}>{children}</h3>;
}

export function TimelineList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card as="ol" className={className}>
      {children}
    </Card>
  );
}

export type TimelineItemProps = {
  kind: EntryKind;
  /** Display date, already formatted: "2 Nov". */
  date: string;
  /** Machine date for <time dateTime>, e.g. "2026-11-02". */
  dateTime?: string;
  title: ReactNode;
  meta?: ReactNode;
  href?: string;
  upcoming?: boolean;
  className?: string;
};

export function TimelineItem({ kind, date, dateTime, title, meta, href, upcoming = false, className }: TimelineItemProps) {
  const k = ENTRY_KINDS[kind];
  return (
    <li className={className}>
      <ListRow
        icon={k.icon}
        title={
          <>
            {upcoming && <span className="sr-only">Upcoming, </span>}
            {title}
          </>
        }
        caption={
          <>
            {k.label}
            {meta && <>, {meta}</>}
          </>
        }
        value={
          <time dateTime={dateTime}>{date}</time>
        }
        valueStyle={upcoming ? "accent" : "caption"}
        href={href}
      />
    </li>
  );
}
