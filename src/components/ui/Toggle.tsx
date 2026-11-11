"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * The tick-in-circle toggle (BRIEF.md section 3.5, boards ShareA2,
 * InsuranceA2). No words: off is an empty ring in ring-off, on is an accent
 * disc with a white tick. Every form is a real button with role="switch",
 * an accessible name and a tap target of at least 44px.
 *
 * - TickIndicator: the drawing only (aria-hidden), for building rows.
 * - TickToggle: a standalone switch around the indicator. Needs `label`.
 * - ToggleRow: a whole row that is the switch ("Include in shares").
 * - ScopeTile: the share screen's tiles, including the locked form.
 * - LockIndicator: the filled lock disc that marks "Always shared".
 */

type IndicatorTone = "default" | "session" | "onAccent";

const indicatorSizes = {
  20: { box: "size-5", tick: 12 },
  24: { box: "size-6", tick: 12 },
  28: { box: "size-7", tick: 16 },
} as const;

export function TickIndicator({
  checked,
  size = 24,
  tone = "default",
  className,
}: {
  checked: boolean;
  size?: keyof typeof indicatorSizes;
  /**
   * "default": on a light surface. "session": on session indigo (on = white
   * disc, session tick). "onAccent": inside an accent-filled tile (on = white
   * disc, accent tick; off = white ring).
   */
  tone?: IndicatorTone;
  className?: string;
}) {
  const s = indicatorSizes[size];
  const on = {
    default: "border-accent bg-accent text-white",
    session: "border-white bg-white text-session",
    onAccent: "border-white bg-white text-accent",
  }[tone];
  const off = {
    default: "border-ring-off bg-transparent text-transparent",
    session: "border-on-session-ring bg-transparent text-transparent",
    onAccent: "border-white bg-transparent text-transparent",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ease-out",
        s.box,
        checked ? on : off,
        className,
      )}
    >
      <Icon name="tick" size={s.tick} strokeWidth={size === 28 ? 3 : 3.5} />
    </span>
  );
}

/** The filled disc with a lock (ShareA2's locked tiles): "Always shared". */
export function LockIndicator({ label = "Always shared", tone = "default" }: { label?: string; tone?: "default" | "session" }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        tone === "session" ? "bg-white text-session" : "bg-session text-white",
      )}
    >
      <Icon name="lock" size={12} strokeWidth={2.75} />
    </span>
  );
}

/** A shared item marker on session indigo (CodeA2, SessionA2): a white disc with a session tick. */
export function SharedMark({ label = "Shared" }: { label?: string }) {
  return (
    <span role="img" aria-label={label} className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-session">
      <Icon name="tick" size={14} strokeWidth={3.5} />
    </span>
  );
}

export function TickToggle({
  checked,
  onCheckedChange,
  label,
  size = 24,
  tone = "default",
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Accessible name; there is no visible text. */
  label: string;
  size?: 24 | 28;
  tone?: "default" | "session";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <TickIndicator checked={checked} size={size} tone={tone} />
    </button>
  );
}

/**
 * A row that is one switch (InsuranceA2 "Include in shares"): the title, an
 * optional caption, and the tick on the right. Tapping anywhere toggles it.
 *
 * `surface="card"` draws it as its own card (radius 24, border-card);
 * `surface="plain"` is a row inside a <Card> of rows.
 */
export function ToggleRow({
  title,
  caption,
  checked,
  onCheckedChange,
  disabled,
  surface = "plain",
  indicatorSize = 28,
  className,
}: {
  title: ReactNode;
  caption?: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  surface?: "card" | "plain";
  indicatorSize?: 24 | 28;
  className?: string;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-t`}
      aria-describedby={caption ? `${id}-c` : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "flex min-h-16 w-full items-center gap-3.5 text-left text-ink disabled:cursor-not-allowed disabled:opacity-50",
        surface === "card" ? "rounded-card border border-border-card bg-surface px-4.5" : "py-2",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={`${id}-t`} className="text-row font-medium">
          {title}
        </span>
        {caption && (
          <span id={`${id}-c`} className="text-caption text-ink-2">
            {caption}
          </span>
        )}
      </span>
      <TickIndicator checked={checked} size={indicatorSize} />
    </button>
  );
}

/**
 * A share scope tile (ShareA2): a bare icon, the label, and the tick. In a
 * 2-column grid with gap-3.
 *
 * - Toggle (default): on = accent fill, white text and icon, white disc with
 *   an accent tick; off = surface with a 1.5px border-control edge and a
 *   ring-off ring. `privateByDefault` dashes the edge while off (Mental health).
 * - `locked`: always shared and not a control. locked-tint fill, the icon in
 *   session indigo and a filled lock disc read as "Always shared".
 * - `wide`: spans both columns as a 64px row, with `caption` under the label
 *   ("Private by default").
 */
export function ScopeTile({
  icon,
  label,
  caption,
  checked = false,
  onCheckedChange,
  locked = false,
  lockedLabel = "Always shared",
  privateByDefault = false,
  wide = false,
  disabled,
  className,
}: {
  icon: IconName;
  label: string;
  caption?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  locked?: boolean;
  /** Spoken reason on the lock ("Always shared"). */
  lockedLabel?: string;
  privateByDefault?: boolean;
  wide?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const shape = wide
    ? "col-span-full flex h-16 items-center gap-3 pl-3 pr-3.5"
    : "flex h-22 flex-col justify-between p-3";

  if (locked) {
    return (
      <div className={cn("rounded-tile bg-locked-tint text-ink", shape, className)}>
        {wide ? (
          <>
            <Icon name={icon} className="text-session" />
            <span className="flex flex-1 flex-col">
              <span className="text-label font-semibold">{label}</span>
              {caption && <span className="text-meta leading-4">{caption}</span>}
            </span>
            <LockIndicator label={lockedLabel} />
          </>
        ) : (
          <>
            <span className="flex items-center justify-between">
              <Icon name={icon} className="text-session" />
              <LockIndicator label={lockedLabel} />
            </span>
            <span className="text-label font-semibold">{label}</span>
          </>
        )}
      </div>
    );
  }

  const on = checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={caption ? `${label}, ${caption.toLowerCase()}` : label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!on)}
      className={cn(
        "rounded-tile border-[1.5px] text-left transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        shape,
        on
          ? "border-accent bg-accent text-white"
          : cn("bg-surface text-ink border-border-control", privateByDefault && "border-dashed"),
        className,
      )}
    >
      {wide ? (
        <>
          <Icon name={icon} className={on ? "text-white" : "text-session"} />
          <span className="flex flex-1 flex-col">
            <span className="text-label font-semibold">{label}</span>
            {caption && <span className="text-meta leading-4">{caption}</span>}
          </span>
          <TickIndicator checked={on} tone={on ? "onAccent" : "default"} />
        </>
      ) : (
        <>
          <span className="flex w-full items-center justify-between">
            <Icon name={icon} className={on ? "text-white" : "text-session"} />
            <TickIndicator checked={on} tone={on ? "onAccent" : "default"} />
          </span>
          <span className="text-label font-semibold">{label}</span>
        </>
      )}
    </button>
  );
}
