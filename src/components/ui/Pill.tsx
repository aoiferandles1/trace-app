import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Status and category tag, from Figma "Pill" (35:349): five tones, solid
 * (tinted) or outlined, three sizes. Text is always the tone's 700 shade,
 * which passes AA on its tint.
 *
 * A pill is never the only signal: it carries words ("managed", "Result").
 * It is not interactive; for selectable chips use FilterTabs.
 */

export type Tone = "indigo" | "teal" | "peach" | "red" | "neutral";

const solid: Record<Tone, string> = {
  indigo: "bg-brand-indigo-tint text-indigo-700",
  teal: "bg-brand-teal-tint text-teal-700",
  peach: "bg-brand-peach-tint text-peach-700",
  red: "bg-status-danger-tint text-red-700",
  neutral: "bg-surface-sunken text-neutral-700",
};

const outlined: Record<Tone, string> = {
  indigo: "border border-indigo-300 text-indigo-700",
  teal: "border border-teal-300 text-teal-700",
  peach: "border border-peach-400 text-peach-700",
  red: "border border-red-400 text-red-700",
  neutral: "border border-border-default text-neutral-700",
};

const dotColor: Record<Tone, string> = {
  indigo: "bg-indigo-700",
  teal: "bg-teal-700",
  peach: "bg-peach-700",
  red: "bg-red-700",
  neutral: "bg-neutral-700",
};

const sizes = {
  sm: "gap-1 px-2 py-0.5 text-body-tiny rounded-sm",
  md: "gap-1.5 pl-2.5 pr-3 py-[5px] text-label font-medium rounded-md",
  lg: "gap-2 pl-3 pr-3.5 py-[7px] text-button-md font-medium rounded-card",
} as const;

export type PillProps = {
  children: ReactNode;
  tone?: Tone;
  variant?: "solid" | "outlined";
  size?: keyof typeof sizes;
  /** Small dot before the label. */
  dot?: boolean;
  /** Decorative icon before the label (16px lucide icon). */
  icon?: ReactNode;
  className?: string;
};

export function Pill({
  children,
  tone = "indigo",
  variant = "solid",
  size = "sm",
  dot = false,
  icon,
  className,
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center whitespace-nowrap",
        sizes[size],
        variant === "solid" ? solid[tone] : outlined[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn("size-1 rounded-full", dotColor[tone])} />}
      {icon}
      {children}
    </span>
  );
}
