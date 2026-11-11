import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * Rows (BRIEF.md section 3.4, boards MainA2, RecordA2, MedsA2, TimelineA2,
 * PortalRecordE). Put phone rows inside a <Card> (padding "rows"), which draws
 * the dividers.
 *
 * - ListRow: title 500 and an ink-2 caption on the left, an optional bare
 *   icon before them, an optional value and chevron on the right. With
 *   `href` or `onClick` the whole row is the tap target.
 * - YearRow: the full timeline's row, a year column (shown on the first row
 *   of each year), title, caption and chevron.
 * - SelectableRow: a row in a portal two-pane list, with the 3px accent bar
 *   on the selected one and `aria-pressed`.
 */

export type ListRowProps = {
  title: ReactNode;
  caption?: ReactNode;
  /** "urgent" for an urgent caption ("Evening, 8 days left"), "critical" for safety. */
  captionTone?: "default" | "urgent" | "critical";
  /** A bare line icon before the text, in accent. Never in a tinted circle. */
  icon?: IconName;
  /** Any leading element instead of an icon (a date, an avatar). */
  leading?: ReactNode;
  value?: ReactNode;
  /**
   * "numeral": Sora 300 (strengths). "caption": ink-2 caption (dates, status).
   * "accent": accent 600 caption (upcoming dates).
   */
  valueStyle?: "numeral" | "caption" | "accent";
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  /** Spoken extra for a link or button, read after the visible text. */
  srSuffix?: string;
  /** Element for the title when the row is static (no href or onClick). */
  titleAs?: "span" | "h3" | "p";
  /**
   * Vertical padding when the board gives one: 10, 11 or 12px (MainA2's rows
   * are 12, RecordA2's timeline 11, its relatives 10). Default: 64px tall.
   */
  padY?: 10 | 11 | 12;
  /** Space between the text and the value: 14 (default) or 12 (MedsA2's rows). */
  gap?: 12 | 14;
  /** Row height without `padY`: 64 (default) or 60 (InsuranceA2's providers). */
  height?: 60 | 64;
  /**
   * The row whose detail is open beside the list (desktop two panes): the
   * portal's 3px accent bar at the card's left edge, and aria-current="page".
   */
  current?: boolean;
  className?: string;
};

/** The selected row's 3px accent bar, on the card's inner left edge (cards of rows are 18px in). */
const CURRENT_BAR =
  "relative before:absolute before:inset-y-2 before:-left-4.5 before:w-0.75 before:rounded-full before:bg-accent";

const padYClasses = { 10: "py-2.5", 11: "py-2.75", 12: "py-3" } as const;

const valueClasses = {
  numeral: "font-display text-numeral font-light text-ink",
  caption: "text-caption text-ink-2",
  accent: "text-caption font-semibold text-accent",
} as const;

const captionTones = {
  default: "text-ink-2",
  urgent: "text-urgent",
  critical: "text-critical",
} as const;

export function ListRow({
  title,
  caption,
  captionTone = "default",
  icon,
  leading,
  value,
  valueStyle = "caption",
  chevron = false,
  href,
  onClick,
  srSuffix,
  titleAs = "span",
  padY,
  gap = 14,
  height = 64,
  current = false,
  className,
}: ListRowProps) {
  const Title = href || onClick ? "span" : titleAs;
  const body = (
    <>
      {icon && <Icon name={icon} className="text-accent" />}
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <Title className="text-row font-medium text-ink">{title}</Title>
        {caption && <span className={cn("text-caption", captionTones[captionTone])}>{caption}</span>}
      </span>
      {(value !== undefined || chevron) && (
        <span className="flex shrink-0 items-center gap-1.5">
          {value !== undefined && <span className={valueClasses[valueStyle]}>{value}</span>}
          {chevron && <Icon name="chevron-right" size={18} className="text-ink-2" />}
        </span>
      )}
      {srSuffix && <span className="sr-only">{srSuffix}</span>}
    </>
  );
  const classes = cn(
    "flex w-full items-center text-left text-ink",
    gap === 12 ? "gap-3" : "gap-3.5",
    // InsuranceA2's 60 includes the row's divider, which a divided card draws on the <li>.
    padY ? padYClasses[padY] : height === 60 ? "min-h-14.75" : "min-h-16 py-2",
    (href || onClick) && "transition-colors duration-150 ease-out hovered:text-accent-alt",
    current && CURRENT_BAR,
    className,
  );
  if (href)
    return (
      <Link href={href} aria-current={current ? "page" : undefined} className={classes}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  return <div className={classes}>{body}</div>;
}

/**
 * Full timeline row (TimelineA2): grid of a 52px year column, the title and
 * caption, and a chevron. The board sets the title straight after the year
 * column, which leaves "2026" (about 49px of Sora) touching the title; the
 * columns are 8px apart here, as the portal's year rows (SelectableRow). The year shows on the first row of each year
 * (`showYear`), in accent for the current year; screen readers always hear it.
 */
export function YearRow({
  year,
  showYear,
  current = false,
  title,
  caption,
  href,
  onClick,
  selected,
  className,
}: {
  year: string;
  showYear: boolean;
  current?: boolean;
  title: ReactNode;
  caption?: ReactNode;
  href?: string;
  onClick?: () => void;
  /**
   * Desktop two panes: the row open in the pane beside the list. Set it (true
   * or false) on every row of such a list: the row then says aria-pressed and
   * the selected one has the 3px accent bar.
   */
  selected?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden={showYear ? undefined : true}
        className={cn("font-display text-year font-light", current ? "text-accent" : "text-ink")}
      >
        {showYear ? year : ""}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-row font-medium">{title}</span>
        {caption && (
          <span className="text-caption text-ink-2">
            {caption}
            {!showYear && <span className="sr-only"> {year}</span>}
          </span>
        )}
      </span>
      <Icon name="chevron-right" size={18} className="text-ink-2" />
    </>
  );
  const classes = cn(
    // 60px with the divider on the board; in a divided card the divider sits on the <li>, so 59 here.
    "grid min-h-14.75 w-full grid-cols-[52px_1fr_20px] items-center gap-x-2 py-2 text-left text-ink",
    selected && CURRENT_BAR,
    className,
  );
  if (href)
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={classes}>
      {body}
    </button>
  );
}

/**
 * A row in a portal two-pane list (PortalRecordE: Recent visits, Medications,
 * Full timeline). The selected row has a 3px accent bar on its left and
 * `aria-pressed="true"`. Lay several out in a flex column with gap-0.5.
 *
 * `leading` is the first column (a year, or a day numeral with its month);
 * `leadingWidth` sets it (56 or 64px on the board).
 */
export function SelectableRow({
  selected,
  onClick,
  leading,
  leadingWidth = 64,
  titleSize = "md",
  title,
  caption,
  value,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  leading?: ReactNode;
  leadingWidth?: 56 | 64;
  /** "lg": a 16/22 title in 9px rows (the portal's medication list); "md": 15/20 (visits, timeline). */
  titleSize?: "md" | "lg";
  title: ReactNode;
  caption?: ReactNode;
  value?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        // The ring is inset: these rows sit in panes that scroll, which clip.
        "grid w-full items-center gap-x-2 border-l-3 pl-3 text-left text-ink focus-visible:-outline-offset-2",
        titleSize === "lg" ? "py-2.25" : "py-2",
        selected ? "border-accent" : "border-transparent",
        leading !== undefined
          ? leadingWidth === 56
            ? "grid-cols-[56px_1fr_auto]"
            : "grid-cols-[64px_1fr_auto]"
          : "grid-cols-[1fr_auto]",
        className,
      )}
    >
      {leading !== undefined && <span>{leading}</span>}
      <span className="flex min-w-0 flex-col">
        <span className={titleSize === "lg" ? "text-row font-medium" : "text-label font-medium"}>{title}</span>
        {caption && <span className="text-meta text-ink-2">{caption}</span>}
      </span>
      {value !== undefined ? (
        <span className="font-display text-numeral font-light">{value}</span>
      ) : (
        <span />
      )}
    </button>
  );
}

/** Sora day numeral with its month, for ledgers and visit lists ("29 Dec"). */
export function DayMonth({
  day,
  month,
  accent = false,
  dateTime,
}: {
  day: string | number;
  month: string;
  accent?: boolean;
  dateTime?: string;
}) {
  return (
    <time dateTime={dateTime} className={cn("flex items-baseline gap-1", accent ? "text-accent" : "text-ink")}>
      <span className="font-display text-title-sm leading-7 font-light">{day}</span>
      <span className={cn("text-micro", !accent && "text-ink-2")}>{month}</span>
    </time>
  );
}
