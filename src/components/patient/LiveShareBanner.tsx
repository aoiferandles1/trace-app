import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Banner across the top of patient screens while a share is live, from
 * p-home-live ("Live share banner"): Indigo/Text bar, teal live dot,
 * "Dr Hennessy can see your record", "24:12 left", chevron. Links to /session.
 *
 * Pass the countdown already formatted. Do not put this inside an
 * aria-live region: the time changes every second. Announce milestones
 * (5 minutes left, 1 minute left, ended) separately.
 * Render it through PatientShell's `banner` slot.
 */
export function LiveShareBanner({
  clinicianName,
  timeLeft,
  href = "/session",
  className,
}: {
  clinicianName: string;
  /** "24:12". Omit for a manual (no timer) session. */
  timeLeft?: string;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "on-dark flex min-h-11 items-center gap-2 bg-indigo-text pl-4 pr-3 text-white hovered:bg-indigo-700",
        className,
      )}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-teal-400" />
      <span className="min-w-0 flex-1 text-button-sm font-medium">
        {clinicianName} can see your record
      </span>
      {timeLeft && <span className="shrink-0 text-label font-medium">{timeLeft} left</span>}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">. View session</span>
    </Link>
  );
}
