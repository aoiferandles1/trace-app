"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Segmented control (BRIEF.md section 3.6, boards MedsA2, RecordA2,
 * TimelineA2, ShareA2, PortalRecordE): a surface container with a 1px
 * border-control edge and 4px padding; the selected segment is accent with
 * white text, the others transparent with segment-text. Segments share the
 * width equally. 40px tall on the phone (`size="lg"` 44px, the share
 * screen's durations), 34px in the portal.
 *
 * Two roles:
 * - mode="radio" (default): a radiogroup that filters or picks a value
 *   (Current / Past, All / Infections / Conditions, For how long).
 * - mode="tabs": a tablist whose segments switch panels (Record's Timeline /
 *   Conditions / Family). Give each panel `tabPanelProps(idBase, value)`.
 *
 * `fill={false}` sizes segments to their words and lets the control scroll
 * sideways inside itself, for long or many options (the portal's timeline
 * filter); the page never scrolls.
 *
 * Keyboard: Left / Right (and Up / Down) move and select, Home / End jump;
 * only the selected segment is in the Tab order.
 */

export type SegmentOption<V extends string> = { value: V; label: string };

export function segmentIds(idBase: string, value: string) {
  return { tab: `${idBase}-tab-${value}`, panel: `${idBase}-panel-${value}` };
}

/** Props for the panel a tabs-mode segment controls. */
export function tabPanelProps(idBase: string, value: string) {
  const ids = segmentIds(idBase, value);
  return { role: "tabpanel", id: ids.panel, "aria-labelledby": ids.tab, tabIndex: 0 } as const;
}

export type SegmentedControlProps<V extends string> = {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Names the group for screen readers ("Medication list", "For how long"). */
  label: string;
  mode?: "radio" | "tabs";
  /** Needed for mode="tabs" (panel ids). */
  idBase?: string;
  size?: "md" | "lg";
  /** Pin a visual state on the unselected segments, for /kit. */
  forceState?: "hover" | "focus";
  /** false: segments as wide as their words, scrolling inside the control when they don't fit. */
  fill?: boolean;
  className?: string;
};

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  mode = "radio",
  idBase,
  size = "md",
  forceState,
  fill = true,
  className,
}: SegmentedControlProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = mode === "tabs";

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      className={cn(
        "flex gap-1 rounded-control border border-border-control bg-surface p-1",
        !fill && "max-w-full overflow-x-auto [scrollbar-width:none]",
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        const ids = idBase ? segmentIds(idBase, o.value) : null;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={tabs ? "tab" : "radio"}
            id={tabs ? ids?.tab : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-checked={tabs ? undefined : selected}
            aria-controls={tabs && selected ? ids?.panel : undefined}
            tabIndex={selected ? 0 : -1}
            data-force={selected ? undefined : forceState}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "rounded-segment text-caption font-semibold whitespace-nowrap transition-colors duration-150 ease-out focus-visible:-outline-offset-2",
              fill ? "min-w-0 flex-1 px-2" : "flex-none px-4",
              size === "lg" ? "h-(--h-segment-lg)" : "h-(--h-segment)",
              selected ? "bg-accent text-white" : "text-segment-text hovered:bg-ground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
