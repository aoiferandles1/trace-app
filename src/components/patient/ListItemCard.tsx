import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Pill, type Tone } from "@/components/ui/Pill";

/**
 * Record list row, from Figma "List Item Card" (p-record, p-home): a status
 * dot, a bold title with a tag, a meta line and a chevron. With `href` the
 * whole card is one link.
 *
 * The dot is decorative; the tag carries the meaning in words.
 * ConditionCard wraps this for conditions; Home's "Recently added" uses it
 * directly with the entry kind as the tag.
 */

export const dotTone: Record<Tone, string> = {
  indigo: "bg-brand-indigo",
  teal: "bg-brand-teal",
  peach: "bg-brand-peach",
  red: "bg-status-danger",
  neutral: "bg-text-primary",
};

const chevronTint: Record<Tone | "none", string> = {
  indigo: "bg-brand-indigo-tint",
  teal: "bg-brand-teal-tint",
  peach: "bg-brand-peach-tint",
  red: "bg-status-danger-tint",
  neutral: "bg-surface-sunken",
  none: "bg-transparent",
};

export type ListItemCardProps = {
  title: ReactNode;
  meta?: ReactNode;
  tone?: Tone;
  tag?: { label: string; tone?: Tone };
  href?: string;
  /** Tint the chevron's square (Home's Recently added). Defaults to none. */
  chevronTone?: Tone | "none";
  /** Heading level for the title when the card is not a link. */
  titleAs?: "h3" | "p";
  className?: string;
};

export function ListItemCard({
  title,
  meta,
  tone = "indigo",
  tag,
  href,
  chevronTone = "none",
  titleAs = "p",
  className,
}: ListItemCardProps) {
  const TitleTag = href ? "span" : titleAs;
  const body = (
    <>
      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", dotTone[tone])} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <TitleTag className="text-[15px] font-bold leading-snug tracking-[-0.005em] text-text-primary">
            {title}
          </TitleTag>
          {tag && (
            <Pill tone={tag.tone ?? tone} size="sm">
              {tag.label}
            </Pill>
          )}
        </span>
        {meta && <span className="text-meta text-text-tertiary">{meta}</span>}
      </span>
      {href && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-sm",
            chevronTone === "none" ? "text-text-tertiary" : "text-text-primary",
            chevronTint[chevronTone],
          )}
        >
          <ChevronRight className="size-4" />
        </span>
      )}
    </>
  );
  const classes = cn(
    "flex min-h-[71px] items-center gap-4 rounded-card border border-border-default bg-surface-card p-4 shadow-sm",
    href && "transition-colors duration-150 hovered:bg-neutral-50",
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
