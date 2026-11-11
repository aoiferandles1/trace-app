import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Trace's one line-icon set (BRIEF.md section 2): 24px grid, 1.75px stroke,
 * round caps and joins, `currentColor`.
 *
 * The glyphs are the boards' own SVG paths (docs/redesign/canvas), copied
 * exactly. lucide-react was the old set; its glyphs differ from the boards
 * (a different pill, house, document and clock), so it is gone. Glyphs the
 * boards do not draw (copy, trash, search...) are drawn here on the same
 * grid in the same style; they are marked "not on a board".
 *
 * Icons beside text are decorative (the default: aria-hidden). An icon that
 * stands alone and means something gets a `label` (role="img"). An icon
 * inside a button is decorative: name the button instead.
 *
 * Chevrons, arrows, close and the warning triangle use a 2px stroke, as on
 * the boards; pass `strokeWidth` to override any glyph.
 */

const GLYPHS = {
  // From the boards
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>,
  record: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
  document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pill: <><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z" /><path d="M8.5 8.5l7 7" /></>,
  person: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.8-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  people: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.6-3 3-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16.5 14.6c2.2 0 3.7 1.3 4.2 3.6" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  "shield-alert": <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M12 8.5v4M12 15.5v.01" /></>,
  shield: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />,
  "heart-pulse": <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /><path d="M7.5 12h2.5l1.5-2.5L13 14l1-2h2.5" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5v.01M15 9.5v.01" /></>,
  warning: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sun: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  wind: <path d="M3 9h11a3 3 0 1 0-3-3 M3 15h15a3 3 0 1 1-3 3 M3 12h8" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  tree: <><circle cx="12" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M12 7.5V12M6 16.5V12h12v4.5" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  drop: <path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z" />,
  pencil: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6" /></>,
  // Not on a board: drawn on the same grid
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>,
  "chevron-down": <path d="M5 9l7 7 7-7" />,
  "chevron-up": <path d="M5 15l7-7 7 7" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  trash: <><path d="M4 7h16M10 4h4M6.5 7l1 12.5h9L17.5 7" /><path d="M10 11v5M14 11v5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4.5h4.5" /><path d="M12 8v4l3 2" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
  "eye-off": <><path d="M4 4l16 16" /><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.8-1.2 2.3-2.7 3.6M6.6 7.6C4.6 9 3.3 11 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  building: <><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V20M3 20h18" /><path d="M8.5 8h3M8.5 12h3M8.5 16h3" /></>,
  "document-plus": <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M12 11v6M9 14h6" /></>,
  "sign-out": <><path d="M10 20H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4H10" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

const HEAVY: ReadonlySet<IconName> = new Set<IconName>([
  "chevron-right",
  "chevron-left",
  "chevron-down",
  "chevron-up",
  "arrow-left",
  "arrow-right",
  "close",
  "warning",
]);

export type IconProps = {
  name: IconName;
  /** Rendered size in px (the grid is always 24). Default 24. */
  size?: number;
  /** Default 1.75 (2 for chevrons, arrows, close and warning). */
  strokeWidth?: number;
  /** Accessible name. Only for an icon that stands alone and carries meaning. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 24, strokeWidth, label, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (HEAVY.has(name) ? 2 : 1.75)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
    >
      {GLYPHS[name]}
    </svg>
  );
}
