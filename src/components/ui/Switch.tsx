"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LockIndicator, TickIndicator } from "./Toggle";

/**
 * Settings rows that switch something on or off.
 *
 * - SwitchRow: a row with a title (a real <label>, so tapping the words
 *   toggles it), an optional description (it may hold a link) and the switch
 *   on the right. By default the control is the tick-in-circle (BRIEF.md
 *   section 3.5). `control="track"` draws the
 *   52 x 32 track switch that ShareA2 uses for "Doctor can add notes".
 *   `surface="tile"` is that board's standalone 60px row (radius 20,
 *   border-control); `surface="plain"` is a row inside a <SwitchGroup>.
 * - LockedRow: a row that cannot be switched off (Safety info, Medications),
 *   with the lock disc and a line saying why.
 * - SwitchGroup: a card of rows with dividers, as a labelled group.
 * - Switch: the bare track switch, for a place with its own label. Needs
 *   `aria-label` or `aria-labelledby`.
 *
 * No "On" or "Off" words anywhere: the control's look and role="switch"
 * carry the state.
 */

export type SwitchProps = Omit<ComponentProps<"button">, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** The track drawing only (aria-hidden). On: accent track, white knob. Off: switch-off outline and knob. */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors duration-150 ease-out",
        checked ? "border-accent bg-accent" : "border-switch-off bg-surface",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full transition-[left,background-color] duration-150 ease-out",
          checked ? "left-6 bg-white" : "left-1 bg-switch-off",
        )}
      />
    </span>
  );
}

export function Switch({ checked, onCheckedChange, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "hit-area inline-flex shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <SwitchTrack checked={checked} />
    </button>
  );
}

export type SwitchRowProps = {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** "plain": a row inside a <SwitchGroup>. "tile": a standalone 60px row (ShareA2). */
  surface?: "plain" | "tile";
  control?: "tick" | "track";
  className?: string;
};

export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  surface = "plain",
  control = "tick",
  className,
}: SwitchRowProps) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4 text-ink",
        surface === "tile"
          ? "min-h-15 rounded-tile border border-border-control bg-surface py-2 pl-4.5 pr-3.5"
          : "min-h-16 py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* A <label> for a button: tapping the words toggles the switch too. */}
        <label
          htmlFor={`${id}-switch`}
          className={cn("cursor-pointer", surface === "tile" ? "text-label font-medium" : "text-row font-medium")}
        >
          {title}
        </label>
        {description && (
          <span id={`${id}-d`} className="text-caption text-ink-2">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={`${id}-switch`}
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "-mr-2.5 flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50",
          control === "track" ? "h-11 px-2.5" : "size-11",
        )}
      >
        {control === "track" ? <SwitchTrack checked={checked} /> : <TickIndicator checked={checked} />}
      </button>
    </div>
  );
}

export function LockedRow({
  title,
  description = "Always shared for your safety",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Kept for old call sites; the row is the same either way. */
  tone?: "default" | "critical";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-16 items-center justify-between gap-4 py-2", className)}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-row font-medium text-ink">{title}</span>
        <span className="text-caption text-ink-2">{description}</span>
      </span>
      <LockIndicator />
    </div>
  );
}

/** A card of SwitchRow and LockedRow with dividers. */
export function SwitchGroup({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("divide-y divide-border-row rounded-card border border-border-card bg-surface px-4.5 py-0.5", className)}
    >
      {children}
    </div>
  );
}
