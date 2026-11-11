import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Inline banner card, from Figma "Banner Card" (44:530), in four tones.
 * Home uses it for "Upcoming" (indigo), "Refill due soon" (peach) and
 * "Sharing in progress" (indigo, links to /session).
 *
 * Layout: 40px icon tile, eyebrow line, bold title, meta line, and an
 * optional trailing badge ("2d", "24:12"). With `href` the whole card is one
 * link; its accessible name is the title plus eyebrow, so keep them meaningful.
 */

const tones = {
  indigo: {
    card: "bg-[rgba(91,122,232,0.12)] border-[rgba(91,122,232,0.5)]",
    tile: "bg-surface-card text-brand-indigo",
    eyebrow: "text-indigo-text",
    badge: "text-indigo-text",
  },
  teal: {
    card: "bg-brand-teal-tint border-[rgba(0,168,150,0.5)]",
    tile: "bg-brand-teal text-white",
    eyebrow: "text-teal-700",
    badge: "text-teal-700",
  },
  peach: {
    card: "bg-brand-peach-tint border-[rgba(232,144,107,0.5)]",
    tile: "bg-brand-peach text-white",
    eyebrow: "text-peach-700",
    badge: "text-peach-700",
  },
  neutral: {
    card: "bg-surface-card border-border-default",
    tile: "bg-surface-sunken text-text-tertiary",
    eyebrow: "text-text-tertiary",
    badge: "text-text-tertiary",
  },
} as const;

export type BannerCardProps = {
  tone?: keyof typeof tones;
  icon: ReactNode;
  eyebrow?: ReactNode;
  /** Uppercase the eyebrow ("REFILL DUE SOON"). */
  eyebrowCaps?: boolean;
  title: ReactNode;
  meta?: ReactNode;
  /** Short badge on the right ("2d", "24:12"). Give it an `aria-label` via `badgeLabel` if it is cryptic. */
  badge?: ReactNode;
  /** Spoken form of the badge, e.g. "in 2 days". */
  badgeLabel?: string;
  href?: string;
  /** Heading level for the title when the card is not a link. */
  titleAs?: "h2" | "h3" | "p";
  className?: string;
};

export function BannerCard({
  tone = "indigo",
  icon,
  eyebrow,
  eyebrowCaps = false,
  title,
  meta,
  badge,
  badgeLabel,
  href,
  titleAs = "p",
  className,
}: BannerCardProps) {
  const t = tones[tone];
  const TitleTag = href ? "span" : titleAs;
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-6", t.tile)}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {eyebrow && (
          <span className={cn("text-label font-medium", eyebrowCaps && "uppercase", t.eyebrow)}>
            {eyebrow}
          </span>
        )}
        <TitleTag className="text-h4 font-bold text-text-primary">{title}</TitleTag>
        {meta && <span className="text-meta text-text-tertiary">{meta}</span>}
      </span>
      {badge && (
        <span
          className={cn("shrink-0 rounded-sm bg-surface-card px-2.5 py-1 text-label font-medium", t.badge)}
        >
          {badgeLabel ? (
            <>
              <span aria-hidden="true">{badge}</span>
              <span className="sr-only">{badgeLabel}</span>
            </>
          ) : (
            badge
          )}
        </span>
      )}
    </>
  );

  const classes = cn(
    "flex items-center gap-3.5 rounded-card border p-4 shadow-sm",
    t.card,
    href && "transition-[filter] duration-150 hovered:brightness-[0.98]",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
