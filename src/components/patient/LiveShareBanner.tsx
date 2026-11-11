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
  paused = false,
  href = "/session",
  className,
}: {
  clinicianName: string;
  /** "24:12". Omit for a manual (no timer) session. */
  timeLeft?: string;
  /** Time's up: the record is hidden until the patient decides. */
  paused?: boolean;
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
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", paused ? "bg-brand-peach" : "bg-teal-400")}
      />
      <span className="min-w-0 flex-1 text-button-sm font-medium">
        {paused ? `${clinicianName}'s access is paused` : `${clinicianName} can see your record`}
      </span>
      {paused ? (
        <span className="shrink-0 text-label font-medium">Time&rsquo;s up</span>
      ) : (
        timeLeft && <span className="shrink-0 text-label font-medium">{timeLeft} left</span>
      )}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">. View session</span>
    </Link>
  );
}
