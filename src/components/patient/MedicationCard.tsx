"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Expandable medication card. Collapsed: the name and dose, then the drug
 * class and "Tablet, once daily, evening" as the caption. Expanded: labelled
 * details (Prescriber, Indication, Since, Instructions).
 *
 * The header is a real button with aria-expanded and the whole row is the
 * tap target. Pass `expanded` + `onExpandedChange` to control it, or
 * `defaultExpanded` to let it manage itself.
 *
 * Phase 4 replaces this with the board's list (MedsA2) and detail
 * (MedDetailA2); until then it wears the new look.
 */

export type MedicationDetail = { label: string; value: ReactNode };

export type MedicationCardProps = {
  /** "Warfarin 5mg" */
  name: string;
  drugClass?: string;
  /** "Tablet · once daily · evening" */
  summary?: string;
  details?: MedicationDetail[];
  /** Adds "Expired" to the caption, for the past list. */
  expired?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  headingLevel?: 2 | 3;
  /** Shown at the end of the expanded panel, e.g. an Edit link. */
  footer?: ReactNode;
  className?: string;
};

export function MedicationCard({
  name,
  drugClass,
  summary,
  details = [],
  expired = false,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  headingLevel = 3,
  footer,
  className,
}: MedicationCardProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = expandedProp ?? internal;
  const panelId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  function toggle() {
    const next = !expanded;
    if (expandedProp === undefined) setInternal(next);
    onExpandedChange?.(next);
  }

  const caption = [expired ? "Expired" : null, drugClass, summary].filter(Boolean).join(", ");

  return (
    <article className={cn("rounded-card border border-border-card bg-surface px-4.5", className)}>
      <Heading className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-16 w-full items-center gap-3 py-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-row font-medium text-ink">{name}</span>
            {caption && <span className="text-caption font-normal text-ink-2">{caption}</span>}
          </span>
          <Icon
            name="chevron-down"
            size={20}
            className={cn("text-ink-2 transition-transform duration-150 ease-out", expanded && "rotate-180")}
          />
        </button>
      </Heading>
      <div id={panelId} hidden={!expanded} className="pb-4">
        <dl className="divide-y divide-border-row border-t border-border-row">
          {details.map((d) => (
            <div key={d.label} className="flex flex-col gap-0.5 py-3">
              <dt className="text-meta leading-4 text-ink-2">{d.label}</dt>
              <dd className="text-body-lg text-ink">{d.value}</dd>
            </div>
          ))}
        </dl>
        {footer}
      </div>
    </article>
  );
}
