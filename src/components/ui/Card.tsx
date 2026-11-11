import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Containers and section labels shared by both apps.
 */

/** White card: 16px radius, 1px Border/Default, Shadow/SM. */
export function Card({
  className,
  padding = "md",
  ...rest
}: ComponentProps<"div"> & { padding?: "none" | "sm" | "md" | "lg" }) {
  return (
    <div
      className={cn(
        "rounded-card border border-border-default bg-surface-card shadow-sm",
        padding === "sm" && "p-3",
        padding === "md" && "p-4",
        padding === "lg" && "px-6 py-6 sm:px-8",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Uppercase section label ("QUICK ACTIONS", "ONGOING CONDITIONS").
 * Renders an <h2> by default because it introduces a section; pass `as` to change the level.
 */
export function SectionLabel({
  children,
  as: Tag = "h2",
  className,
  id,
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn("text-label font-medium uppercase text-text-tertiary", className)}>
      {children}
    </Tag>
  );
}

/**
 * Small eyebrow above a heading, from Figma "Eyebrow" (70:2158): a dot and the
 * label in the tone's text colour ("About You", "NEW SESSION").
 */
const eyebrowTone = {
  indigo: { text: "text-indigo-text", dot: "bg-brand-indigo" },
  teal: { text: "text-teal-700", dot: "bg-brand-teal" },
  peach: { text: "text-peach-700", dot: "bg-brand-peach" },
  neutral: { text: "text-text-tertiary", dot: "bg-neutral-500" },
  red: { text: "text-red-700", dot: "bg-status-danger" },
  onDark: { text: "text-white", dot: "bg-white" },
} as const;

export function Eyebrow({
  children,
  tone = "indigo",
  uppercase = false,
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof eyebrowTone;
  uppercase?: boolean;
  /** md: 14px. sm: 12px Label, as on the sign-up steps ("About You"). */
  size?: "sm" | "md";
  className?: string;
}) {
  const t = eyebrowTone[tone];
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-medium",
        uppercase ? "text-label uppercase" : size === "sm" ? "text-label" : "text-body-sm",
        t.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </p>
  );
}

/** Initials in a circle. Decorative unless `label` is given. */
export function Avatar({
  initials,
  size = "md",
  tone = "tint",
  label,
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** tint: indigo tint with Indigo/Text letters. solid: Indigo/Accessible with white. onDark: Brand/Indigo on indigo screens. */
  tone?: "tint" | "solid" | "onDark";
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" && "size-9 text-body-sm",
        size === "md" && "size-12 text-h4",
        size === "lg" && "size-16 text-[18px]",
        size === "xl" && "size-24 text-[36px]",
        tone === "tint" && "bg-brand-indigo-tint text-indigo-text",
        tone === "solid" && "bg-indigo-accessible text-white",
        tone === "onDark" && "bg-brand-indigo text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}
