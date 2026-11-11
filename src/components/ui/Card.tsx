import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Containers, headings and avatars shared by both apps (BRIEF.md section 3.3).
 */

/**
 * Card: surface fill, 1px border-card, radius 24 on the phone and 12 in the
 * portal. No shadow.
 *
 * - `padding="rows"` (default): 2px 18px, for a card of rows (ListRow,
 *   ToggleRow...). Rows carry their own vertical padding, and `divided`
 *   (on by default for rows) draws a 1px border-row between them, none after
 *   the last.
 * - "md" 16px, "lg" 20px, "none".
 */
export function Card({
  className,
  padding = "rows",
  divided,
  as: Tag = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & {
  padding?: "rows" | "none" | "md" | "lg";
  divided?: boolean;
  as?: "div" | "ul" | "ol" | "section" | "article";
}) {
  const divide = divided ?? padding === "rows";
  return (
    <Tag
      className={cn(
        "rounded-card border border-border-card bg-surface",
        padding === "rows" && "px-4.5 py-0.5",
        padding === "md" && "p-4",
        padding === "lg" && "p-5",
        divide && "divide-y divide-border-row",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Small group label ("For how long", "They will see", "Not shared"): Inter
 * 14/20 600 in ink-2. Renders an <h2> by default; pass `as` to change the level.
 */
export function SectionLabel({
  children,
  as: Tag = "h2",
  tone = "default",
  className,
  id,
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "h4" | "p" | "span" | "legend";
  /** "session": on session indigo (white at 78%). */
  tone?: "default" | "session";
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "text-caption font-semibold",
        tone === "session" ? "text-on-session-2" : "text-ink-2",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Section heading ("Coming up", "Recent", "History"): Sora 300, 20/26 on the
 * phone and 22/28 in the portal. An <h2> by default.
 */
export function SectionHeading({
  children,
  as: Tag = "h2",
  className,
  id,
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn("font-display text-heading font-light", className)}>
      {children}
    </Tag>
  );
}

/**
 * Initials in a circle. Avatars are one of the two filled circles the design
 * allows. Decorative unless `label` is given.
 *
 * Tones (from the boards):
 * - "outline": surface with a border-control ring, session-indigo letters (Home's JD).
 * - "solid": accent fill, white letters (the doctor on Share confirm, the portal's JD).
 * - "tint": locked-tint fill, session-indigo letters (the access request, care team).
 * - "session": white fill, session-indigo letters, on session indigo.
 * - "onAccent": white fill, accent letters, inside an accent card.
 *
 * Sizes 40 to 88. `display` sets the letters in Sora 300 (the portal header
 * and session screens); otherwise Inter 600.
 */
const avatarSizes = {
  40: { box: "size-10", inter: "text-caption", sora: "text-row" },
  44: { box: "size-11", inter: "text-label", sora: "text-row" },
  48: { box: "size-12", inter: "text-label", sora: "text-year" },
  52: { box: "size-13", inter: "text-row", sora: "text-year" },
  56: { box: "size-14", inter: "text-row", sora: "text-year" },
  88: { box: "size-22", inter: "text-numeral-lg", sora: "text-numeral-lg" },
} as const;

export type AvatarSize = keyof typeof avatarSizes;

export function Avatar({
  initials,
  size = 44,
  tone = "tint",
  display = false,
  label,
  className,
}: {
  initials: string;
  size?: AvatarSize;
  tone?: "outline" | "solid" | "tint" | "session" | "onAccent";
  display?: boolean;
  label?: string;
  className?: string;
}) {
  const s = avatarSizes[size];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none",
        s.box,
        display ? cn("font-display font-light", s.sora) : cn("font-semibold", s.inter),
        tone === "outline" && "border border-border-control bg-surface text-session",
        tone === "solid" && "bg-accent text-white",
        tone === "tint" && "bg-locked-tint text-session",
        tone === "session" && "bg-white text-session",
        tone === "onAccent" && "bg-white text-accent",
        className,
      )}
    >
      {initials}
    </span>
  );
}
