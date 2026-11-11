import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A labelled block in a detail view (boards TimelineA2's sheet and
 * PortalRecordE's detail panes; BRIEF.md 5.9): the label at 13px in ink-2,
 * the value under it at 16/24 in ink. "Seen by", "Outcome", "Reason",
 * "Assessment", "Plan".
 *
 * `items` lists sub-entries with a 500 name and an ink-2 caption, as the
 * boards' "Prescribed" block does ("Doxycycline 100mg" / "7 days, from 2 Aug").
 *
 * Inside a <dl>, pass `term` so the label is a <dt> and the value a <dd>.
 */
export function DetailBlock({
  label,
  children,
  items,
  term = false,
  className,
}: {
  label: string;
  children?: ReactNode;
  items?: Array<{ name: string; detail?: string }>;
  term?: boolean;
  className?: string;
}) {
  const Label = term ? "dt" : "span";
  const Value = term ? "dd" : "div";
  return (
    <div className={cn("flex flex-col", items ? "gap-2" : "gap-0.5", className)}>
      <Label className="text-meta leading-4 text-ink-2">{label}</Label>
      {children !== undefined && <Value className="whitespace-pre-wrap break-words text-body-lg text-ink">{children}</Value>}
      {items?.map((i) => (
        <span key={i.name} className="flex flex-col">
          <span className="text-row font-medium">{i.name}</span>
          {i.detail && <span className="text-caption text-ink-2">{i.detail}</span>}
        </span>
      ))}
    </div>
  );
}
