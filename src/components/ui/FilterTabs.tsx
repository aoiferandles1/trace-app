"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Filter chips and segmented tabs, from Figma "Filter Tab" (55:1271) and
 * "Filter Tab Bar" (55:1327). Active: filled Indigo/Text with white text.
 * Inactive: outlined.
 *
 * Built as an ARIA tablist: Left/Right/Home/End move between tabs, and only
 * the active tab is in the Tab order. Give each panel the ids from
 * `filterTabIds(idBase, value)`:
 *
 *   <FilterTabs idBase="meds" ... />
 *   <div role="tabpanel" {...tabPanelProps("meds", value)}>...</div>
 *
 * `fill` stretches the tabs to equal widths (Current / Expired on p-meds).
 * Each tab is 32px tall to look like Figma, with a 44px tap target.
 */

export type FilterTabItem<V extends string> = { value: V; label: string; count?: number };

export function filterTabIds(idBase: string, value: string) {
  return { tab: `${idBase}-tab-${value}`, panel: `${idBase}-panel-${value}` };
}

export function tabPanelProps(idBase: string, value: string) {
  const ids = filterTabIds(idBase, value);
  return { id: ids.panel, "aria-labelledby": ids.tab, tabIndex: 0 } as const;
}

export type FilterTabsProps<V extends string> = {
  idBase: string;
  items: FilterTabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Names the tab list for screen readers, e.g. "Medication status". */
  label: string;
  fill?: boolean;
  /** Pin a visual state for the /kit page. */
  forceState?: "hover" | "focus";
  className?: string;
};

export function FilterTabs<V extends string>({
  idBase,
  items,
  value,
  onChange,
  label,
  fill = false,
  forceState,
  className,
}: FilterTabsProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-2", fill ? "w-full" : "overflow-x-auto py-1.5", className)}
    >
      {items.map((item, i) => {
        const active = item.value === value;
        const ids = filterTabIds(idBase, item.value);
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={active}
            aria-controls={active ? ids.panel : undefined}
            tabIndex={active ? 0 : -1}
            data-force={!active ? forceState : forceState === "focus" ? "focus" : undefined}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "hit-area h-8 shrink-0 rounded-[18px] px-4 text-button-sm font-medium transition-colors duration-150",
              fill && "flex-1",
              active
                ? "bg-indigo-text text-white"
                : "border border-border-default bg-surface-card text-text-primary hovered:bg-brand-indigo-tint",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1 opacity-80">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
