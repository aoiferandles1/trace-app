import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Home's today card (MainA2): accent fill, radius 28, white text. A short
 * line ("GP visit today"), the time in Sora 300 at 56px, who and where, and
 * a white pill that starts sharing. Shown only on the day of a visit.
 *
 * `avatar` sits at the top right (the doctor's initials, an <Avatar
 * tone="onAccent" size={48} />).
 */
export function ShareTodayCard({
  time,
  title,
  place,
  avatar,
  href = "/share",
  actionLabel = "Share your record now",
  className,
}: {
  /** "9:30am" */
  time: string;
  /** "GP visit · Dr Hennessy" */
  title: ReactNode;
  /** "Rathmines Medical Centre" */
  place?: ReactNode;
  avatar?: ReactNode;
  href?: string;
  actionLabel?: string;
  className?: string;
}) {
  const titleId = useId();
  const m = /^(\d{1,2}:\d{2})\s*(am|pm)?$/i.exec(time.trim());
  return (
    <section
      aria-labelledby={titleId}
      className={cn("relative flex min-h-45.5 flex-col rounded-feature bg-accent px-5 py-4.5 text-white", className)}
    >
      {avatar && <span className="absolute right-5 top-4.5">{avatar}</span>}
      <h2 id={titleId} className="pr-16 text-caption font-medium">
        {title}
      </h2>
      <p className="mt-1 font-display text-hero font-light">
        {m ? m[1] : time}
        {m?.[2] && <span className="ml-1 font-sans text-unit font-medium tracking-normal">{m[2].toLowerCase()}</span>}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
        {place && <p className="min-w-0 text-meta">{place}</p>}
        <ButtonLink href={href} variant="primary" tone="onAccent" size="md" className="px-4.5" iconLeft={<Icon name="share" size={18} />}>
          {actionLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
