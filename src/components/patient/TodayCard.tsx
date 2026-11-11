import Link from "next/link";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Home's today card (board MainA2): accent fill, radius 28, 182px tall,
 * white text. A short line ("GP visit today"), a big Sora 300 figure (the
 * time, "9:30" with a small "am"), who and where at the bottom left, and a
 * 46px white pill on the right (the board's "Share record"). The doctor's
 * initials sit in a white 48px disc at the top right.
 *
 * Home uses the same card while a share is open, with the time left as the
 * figure and "View session" as the pill (no board; the same pattern).
 *
 * `figure` is "9:30am" (split into numerals and a small "am") or any short
 * text ("24:12"). `figureLabel` is what a screen reader hears instead, for a
 * ticking figure ("24 minutes 12 seconds left"). The figure is never a live
 * region.
 */
export function TodayCard({
  eyebrow,
  figure,
  figureLabel,
  name,
  place,
  initials,
  action,
  className,
}: {
  /** "GP visit today" */
  eyebrow: ReactNode;
  /** "9:30am", "24:12" */
  figure: string;
  figureLabel?: string;
  /** "Dr Hennessy" */
  name?: ReactNode;
  /** "Rathmines Medical Centre" */
  place?: ReactNode;
  /** "DH" */
  initials?: string;
  action: { href: string; label: string; icon?: IconName };
  className?: string;
}) {
  const titleId = useId();
  const m = /^(\d{1,2}:\d{2})\s*(am|pm)$/i.exec(figure.trim());
  return (
    <section
      aria-labelledby={titleId}
      className={cn("relative flex min-h-45.5 flex-col rounded-feature bg-accent px-5 py-4.5 text-white", className)}
    >
      {initials && <Avatar initials={initials} size={48} tone="onAccent" className="absolute right-5 top-4.5" />}
      <h2 id={titleId} className={cn("text-caption font-medium", initials && "pr-16")}>
        {eyebrow}
      </h2>
      <p className="mt-1 font-display text-hero font-light">
        {figureLabel ? (
          <>
            <span aria-hidden="true">{figure}</span>
            <span className="sr-only">{figureLabel}</span>
          </>
        ) : m ? (
          <>
            {m[1]}
            <span className="ml-1 font-sans text-unit font-medium tracking-normal">{m[2].toLowerCase()}</span>
          </>
        ) : (
          figure
        )}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3">
        {(name || place) && (
          <p className="flex min-w-0 flex-col">
            {name && <span className="text-label font-semibold">{name}</span>}
            {place && <span className="text-meta">{place}</span>}
          </p>
        )}
        {/* The board's pill: 46px, 18px sides, 14px 600 (a one-off size, so not a Button size). */}
        <Link
          href={action.href}
          className="ml-auto inline-flex h-11.5 shrink-0 items-center gap-2 rounded-full bg-white px-4.5 text-caption font-semibold text-accent transition-colors duration-150 ease-out hovered:bg-ground pressed:text-accent-alt"
        >
          <Icon name={action.icon ?? "share"} size={18} strokeWidth={2} />
          {action.label}
        </Link>
      </div>
    </section>
  );
}
