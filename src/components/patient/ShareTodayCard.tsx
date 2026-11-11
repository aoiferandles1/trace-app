import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";

/**
 * The appointment-day card on Home (p-apptday): an indigo card with
 * "Today · 9:30am", the visit, the place, and "Share your record now".
 * Shown only on the day of a visit (PLAN.md section 7). On other days Home
 * shows the Upcoming BannerCard instead, and sharing lives in Profile.
 */
export function ShareTodayCard({
  time,
  title,
  place,
  href = "/share",
  className,
}: {
  /** "9:30am" */
  time: string;
  /** "GP visit · Dr Hennessy" */
  title: ReactNode;
  /** "Rathmines Medical Centre · Dublin" */
  place?: ReactNode;
  href?: string;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "on-dark flex flex-col gap-3 rounded-[24px] bg-indigo-accessible px-6 py-6 text-white shadow-lg",
        className,
      )}
    >
      <p className="flex w-fit items-center gap-2 rounded-full bg-indigo-text px-3 py-1 text-body-sm">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
        Today · {time}
      </p>
      <h2 id={titleId} className="text-heading-lg font-medium">
        {title}
      </h2>
      {place && <p className="text-body-sm font-medium">{place}</p>}
      <ButtonLink href={href} variant="tertiary" size="lg" className="mt-3 w-fit">
        Share your record now
      </ButtonLink>
    </section>
  );
}
