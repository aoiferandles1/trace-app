import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Strip across the top of patient screens while a share is open: session
 * indigo (sharing's colour), "Dr Hennessy can see your record", the time
 * left, a chevron. Links to /session. No dot and no "Live" stamp (BRIEF.md
 * section 1).
 *
 * Pass the countdown already formatted. Do not put this inside an
 * aria-live region: the time changes every second. Milestones are announced
 * separately. Render it through PatientShell's `banner` slot.
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
        "on-session flex min-h-11 items-center gap-2 bg-session pl-5 pr-3 text-white hovered:bg-accent-alt",
        className,
      )}
    >
      <span className="min-w-0 flex-1 text-caption font-medium">
        {paused ? `${clinicianName}'s access is paused` : `${clinicianName} can see your record`}
      </span>
      {paused ? (
        <span className="shrink-0 text-caption font-semibold">Time&apos;s up</span>
      ) : (
        timeLeft && <span className="shrink-0 text-caption font-semibold tabular-nums">{timeLeft} left</span>
      )}
      <Icon name="chevron-right" size={18} />
      <span className="sr-only">. View session</span>
    </Link>
  );
}
