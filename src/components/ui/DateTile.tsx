import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * Home's "Coming up" tile (MainA2): 148 x 132, radius 22, a bare icon at the
 * top, then the day in Sora 300 with the month, and the title.
 *
 * `urgent` is the one tinted form (urgent-tint, icon and badge in the urgent
 * colour, no border), for something due soon ("8 days" to a refill). The
 * badge is words, so the urgency is never colour alone. Lay tiles out in a
 * horizontal row that scrolls (see the kit).
 */
export function DateTile({
  day,
  month,
  title,
  icon,
  href,
  dateTime,
  urgent = false,
  badge,
  className,
}: {
  day: string | number;
  month: string;
  title: string;
  icon: IconName;
  href?: string;
  dateTime?: string;
  urgent?: boolean;
  /** Short words on the right of the icon ("8 days"). */
  badge?: string;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between">
        <Icon name={icon} className={urgent ? "text-urgent" : "text-accent"} />
        {badge && <span className="text-meta leading-4 font-semibold text-urgent">{badge}</span>}
      </span>
      <span className="flex flex-col">
        <time dateTime={dateTime}>
          <span className="font-display text-numeral-lg font-light">{day}</span>
          <span className="ml-1 text-caption font-medium">{month}</span>
        </time>
        <span className="text-caption font-medium">{title}</span>
      </span>
    </>
  );
  const classes = cn(
    "flex h-33 w-37 shrink-0 flex-col justify-between rounded-tile-lg p-3.5 text-ink",
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

/**
 * A horizontal row of DateTiles that runs to the screen edges and scrolls
 * sideways (the tiles, not the page). The padding keeps focus rings visible.
 */
export function DateTileRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-5 -my-1 flex scroll-px-5 gap-3 overflow-x-auto px-5 py-1 [scrollbar-width:none]"
    >
      {children}
    </ul>
  );
}
