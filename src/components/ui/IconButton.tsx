import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Icon-only button with a 44 x 44 tap target (back arrows, chevrons, close).
 * `label` is required: it is the button's accessible name.
 */

const tones = {
  default: "text-text-primary hovered:bg-surface-sunken",
  muted: "text-text-tertiary hovered:bg-surface-sunken",
  onDark: "text-white hovered:bg-white/10",
} as const;

type Common = {
  label: string;
  icon: ReactNode;
  tone?: keyof typeof tones;
};

const classes = (tone: keyof typeof tones, className?: string) =>
  cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 [&_svg]:size-6",
    tones[tone],
    className,
  );

export function IconButton({
  label,
  icon,
  tone = "default",
  className,
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type={type} aria-label={label} className={classes(tone, className)} {...rest}>
      {icon}
    </button>
  );
}

export function IconLink({
  label,
  icon,
  tone = "default",
  className,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link aria-label={label} className={classes(tone, className)} {...rest}>
      {icon}
    </Link>
  );
}
