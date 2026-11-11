import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * A one-item card with a bare icon: "Upcoming", "Refill due soon",
 * "Sharing in progress". Surface with a border-card edge; `tone="urgent"`
 * is the one tinted form (urgent-tint, urgent icon and eyebrow), for
 * something due soon.
 *
 * Layout: the icon, an eyebrow line, the title (500), a caption, and an
 * optional short badge on the right ("2d", "24:12"). With `href` the whole
 * card is one link; its accessible name is the eyebrow plus title.
 */
export type BannerCardProps = {
  tone?: "default" | "urgent";
  icon: IconName;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Short badge on the right ("2d", "24:12"). Give its spoken form in `badgeLabel` if it is cryptic. */
  badge?: ReactNode;
  badgeLabel?: string;
  href?: string;
  /** Heading level for the title when the card is not a link. */
  titleAs?: "h2" | "h3" | "p";
  className?: string;
};

export function BannerCard({
  tone = "default",
  icon,
  eyebrow,
  title,
  meta,
  badge,
  badgeLabel,
  href,
  titleAs = "p",
  className,
}: BannerCardProps) {
  const urgent = tone === "urgent";
  const TitleTag = href ? "span" : titleAs;
  const body = (
    <>
      <Icon name={icon} className={urgent ? "text-urgent" : "text-accent"} />
      <span className="flex min-w-0 flex-1 flex-col">
        {eyebrow && (
          <span className={cn("text-meta font-semibold", urgent ? "text-urgent" : "text-ink-2")}>{eyebrow}</span>
        )}
        <TitleTag className="text-row font-medium text-ink">{title}</TitleTag>
        {meta && <span className="text-caption text-ink-2">{meta}</span>}
      </span>
      {badge && (
        <span className={cn("shrink-0 text-caption font-semibold", urgent ? "text-urgent" : "text-ink-2")}>
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
    "flex min-h-16 items-center gap-3.5 rounded-card px-4.5 py-3",
    urgent ? "bg-urgent-tint" : "border border-border-card bg-surface",
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
