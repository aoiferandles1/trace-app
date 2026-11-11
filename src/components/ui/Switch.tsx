"use client";

import { Lock } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * On/off switch, from Figma "Toggle" (33:209): 52 x 32 track, white thumb.
 * `tone="critical"` turns the "on" track red, for sensitive settings.
 *
 * The bare <Switch> needs a name: pass `aria-label` or `aria-labelledby`.
 * Most screens want <SwitchRow>, which pairs it with a visible title (a real
 * <label>, so tapping the words toggles it too) and a description.
 *
 * Accessibility substitution: the "off" track is --border-control (#7A8495,
 * 3:1 or more on every surface) instead of Figma's #C8CED8 (1.6:1).
 */

export type SwitchProps = Omit<ComponentProps<"button">, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  tone?: "default" | "critical";
};

export function Switch({
  checked,
  onCheckedChange,
  tone = "default",
  className,
  disabled,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "hit-area inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? tone === "critical"
            ? "bg-status-danger"
            : "bg-brand-indigo"
          : "bg-border-control",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-7 rounded-full bg-white shadow-[0_1px_3px_rgba(12,25,39,0.2)] transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export type SwitchRowProps = {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  tone?: "default" | "critical";
  disabled?: boolean;
  /**
   * "plain": a row inside a grouped white card (use <SwitchGroup>).
   * "sunken": a standalone grey panel (Mental health history, Doctor can add session notes).
   */
  surface?: "plain" | "sunken";
  className?: string;
};

/** A labelled switch row, as on Confirm preferences (p-prefs). */
export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  tone,
  disabled,
  surface = "plain",
  className,
}: SwitchRowProps) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex min-h-[60px] items-center gap-4 px-4 py-3",
        surface === "sunken" && "rounded-card bg-surface-sunken",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={`${id}-switch`} className="cursor-pointer text-body-lg text-text-primary">
          {title}
        </label>
        {description && (
          <span id={`${id}-desc`} className="text-body-tiny text-text-tertiary">
            {description}
          </span>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        tone={tone}
        disabled={disabled}
        id={`${id}-switch`}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}

/**
 * A row that cannot be switched off (Critical safety, Medications).
 * Shows a lock and says why, so it is not mistaken for a disabled control.
 */
export function LockedRow({
  title,
  description = "Always shared for your safety",
  tone = "default",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  tone?: "default" | "critical";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[60px] items-center gap-4 px-4 py-3", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-body-lg", tone === "critical" ? "text-red-700" : "text-text-primary")}>
          {title}
        </span>
        <span className="text-body-tiny text-text-tertiary">{description}</span>
      </div>
      <Lock aria-hidden="true" className="size-5 shrink-0 text-text-tertiary" />
      <span className="sr-only">Locked on</span>
    </div>
  );
}

/** White card that groups SwitchRow and LockedRow with dividers. */
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
      className={cn(
        "divide-y divide-border-default overflow-hidden rounded-card border border-border-default bg-surface-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
