"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/Pill";

/**
 * Expandable medication card, from Figma "Medication Card" (p-meds).
 * Collapsed: name and dose, drug class tag, "Tablet · once daily · evening".
 * Expanded: a list of labelled details (Prescriber, Indication, Since,
 * Instructions).
 *
 * The header is a real button with aria-expanded, and the whole header row is
 * the tap target. Pass `expanded` + `onExpandedChange` to control it, or
 * `defaultExpanded` to let it manage itself.
 *
 * Drug class tags must use the corrected classes (PLAN.md section 11):
 * Warfarin Anticoagulant, Levothyroxine Thyroid, Salbutamol Bronchodilator.
 */

const classTone: Record<Tone, string> = {
  indigo: "bg-brand-indigo-tint text-indigo-text",
  teal: "bg-brand-teal-tint text-teal-700",
  peach: "bg-brand-peach-tint text-peach-700",
  red: "bg-status-danger-tint text-red-700",
  neutral: "bg-surface-sunken text-neutral-700",
};

export type MedicationDetail = { label: string; value: ReactNode };

export type MedicationCardProps = {
  /** "Warfarin 5mg" */
  name: string;
  drugClass?: string;
  drugClassTone?: Tone;
  /** "Tablet · once daily · evening" */
  summary?: string;
  details?: MedicationDetail[];
  /** Greys the card and adds an "Expired" note for the Expired tab. */
  expired?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Heading level of the name. */
  headingLevel?: 2 | 3;
  className?: string;
};

export function MedicationCard({
  name,
  drugClass,
  drugClassTone = "indigo",
  summary,
  details = [],
  expired = false,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  headingLevel = 3,
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

  return (
    <article className={cn("rounded-card bg-surface-card shadow-sm", className)}>
      <Heading className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-card px-6 py-6 text-left sm:px-8"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span
                className={cn(
                  "text-h3 font-medium",
                  expired ? "text-text-tertiary" : "text-text-primary",
                )}
              >
                {name}
              </span>
              {drugClass && (
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-label font-medium",
                    classTone[expired ? "neutral" : drugClassTone],
                  )}
                >
                  {drugClass}
                </span>
              )}
            </span>
            {(summary || expired) && (
              <span className="text-body-sm font-normal text-text-tertiary">
                {expired && <span className="font-medium">Expired · </span>}
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-text-primary transition-transform duration-150",
              expanded && "rotate-180",
            )}
          />
        </button>
      </Heading>
      <div id={panelId} hidden={!expanded} className="px-6 pb-6 sm:px-8">
        <dl className="divide-y divide-border-default border-t border-border-default">
          {details.map((d) => (
            <div key={d.label} className="flex gap-4 py-[18px] text-body-sm">
              <dt className="w-[110px] shrink-0 text-text-tertiary sm:w-[140px]">{d.label}</dt>
              <dd className="min-w-0 flex-1 text-text-primary">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
