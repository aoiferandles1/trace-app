import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * Icon-only button or link: back arrows, close, collapse. `label` is
 * required; it is the accessible name.
 *
 * `size` is the visible box (32 for the header back arrow, 36 for a sheet's
 * close button, 40 for the portal's notes button, 44 by default). Every size
 * keeps a 44 x 44 tap target.
 *
 * Tones: "default" ink, "muted" ink-2 (close buttons), "session" white on
 * session indigo, "framed" a 1px border-control box on surface with an
 * accent icon (the collapsed notes strip's open button).
 */

const tones = {
  default: "text-ink hovered:bg-border-row",
  muted: "text-ink-2 hovered:bg-border-row",
  session: "text-white hovered:bg-on-session-border",
  framed: "border border-border-control bg-surface text-accent hovered:bg-ground",
} as const;

const boxes = { 32: "size-8", 36: "size-9", 40: "size-10", 44: "size-11" } as const;

type Common = {
  label: string;
  icon: IconName;
  /** Rendered icon size. Default 24 (20 inside a 40 box). */
  iconSize?: number;
  size?: keyof typeof boxes;
  tone?: keyof typeof tones;
};

const classes = (tone: keyof typeof tones, size: keyof typeof boxes, className?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center transition-colors duration-150 ease-out",
    size === 40 ? "rounded-rail" : "rounded-full",
    size < 44 && "hit-area-square",
    boxes[size],
    tones[tone],
    className,
  );

export function IconButton({
  label,
  icon,
  iconSize,
  size = 44,
  tone = "default",
  className,
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type={type} aria-label={label} className={classes(tone, size, className)} {...rest}>
      <Icon name={icon} size={iconSize ?? (size === 40 ? 20 : 24)} />
    </button>
  );
}

export function IconLink({
  label,
  icon,
  iconSize,
  size = 44,
  tone = "default",
  className,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link aria-label={label} className={classes(tone, size, className)} {...rest}>
      <Icon name={icon} size={iconSize ?? (size === 40 ? 20 : 24)} />
    </Link>
  );
}
