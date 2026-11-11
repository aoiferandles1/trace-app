"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Selectable option cards, from Figma "Choice Card" (107:4211), as on
 * Confirm preferences' "Share for" (30 min / 1 hour / All day / Manual).
 *
 * A real radio group: a <fieldset> with a <legend>, and a native radio inside
 * each card, so arrow keys and screen readers behave as expected.
 * Selected: Indigo tint with a 2px indigo border, label in Indigo/Text.
 */

export type ChoiceOption<V extends string> = {
  value: V;
  label: string;
  description?: string;
  icon?: ReactNode;
};

export type ChoiceCardGroupProps<V extends string> = {
  legend: ReactNode;
  /** Hide the legend visually when a section heading above already says it. */
  legendHidden?: boolean;
  options: ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  columns?: 1 | 2;
  name?: string;
  className?: string;
};

export function ChoiceCardGroup<V extends string>({
  legend,
  legendHidden = false,
  options,
  value,
  onChange,
  columns = 2,
  name,
  className,
}: ChoiceCardGroupProps<V>) {
  const autoName = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend
        className={cn(
          legendHidden ? "sr-only" : "mb-3 text-label font-medium uppercase text-text-tertiary",
        )}
      >
        {legend}
      </legend>
      <div className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex min-h-[78px] cursor-pointer flex-col justify-center gap-1 rounded-md p-3.5 transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
                selected
                  ? "border-2 border-brand-indigo bg-brand-indigo-tint"
                  : "border border-border-default bg-surface-card hovered:bg-neutral-50",
              )}
            >
              <input
                type="radio"
                name={name ?? autoName}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex items-center gap-2 text-body-tiny font-bold",
                  selected ? "text-indigo-text" : "text-text-primary",
                )}
              >
                {o.icon}
                {o.label}
              </span>
              {o.description && (
                <span className={cn("text-body-tiny", selected ? "text-indigo-text" : "text-text-tertiary")}>
                  {o.description}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
