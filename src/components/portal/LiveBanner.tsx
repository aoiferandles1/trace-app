import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

/**
 * Portal LIVE banner, from Figma "Reading Context Banner" (55:1244): a LIVE
 * pill, "Reading directly from Jane Doe's patient record · shared today ·
 * GP visit profile · read-only", a time chip and "End session".
 *
 * The LIVE pill is text, not just a colour. The countdown is plain text: do
 * not wrap this in a live region; announce milestones separately.
 * When the banner itself is narrower than 768px the pieces wrap onto two
 * lines (a container query, since the record column is narrow from 1024px).
 */
export function LiveBanner({
  patientName,
  profile = "GP visit profile",
  timeLeft,
  onEndSession,
  ending = false,
  className,
}: {
  patientName: string;
  profile?: string;
  /** "24:31". Omit for a manual session. */
  timeLeft?: string;
  onEndSession?: () => void;
  ending?: boolean;
  className?: string;
}) {
  // Wraps by its own width, not the viewport's: from 1024px the record column
  // between the sidebar and notes panel can be under 400px wide.
  return (
    <div className={cn("@container", className)}>
      <section
        aria-label="Live session"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[26px] border border-[rgba(91,122,232,0.12)] bg-[rgba(91,122,232,0.08)] py-2 pl-4 pr-2 @3xl:flex-nowrap"
      >
        <span className="flex h-[30px] shrink-0 items-center gap-2 rounded-[26px] bg-indigo-text px-2.5 text-body-tiny text-white">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
          LIVE
        </span>
        <p className="min-w-0 flex-1 basis-60 text-label text-text-tertiary">
          Reading directly from <strong className="font-bold text-indigo-text">{patientName}&rsquo;s</strong>{" "}
          patient record · shared today · {profile} ·{" "}
          <strong className="font-bold text-indigo-text">read-only</strong>
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {timeLeft && (
            <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-surface-card py-[7px] pl-3 pr-3.5 text-label font-medium text-indigo-text">
              <Clock aria-hidden="true" className="size-4" />
              Access expires in {timeLeft}
            </span>
          )}
          {onEndSession && (
            <Button variant="secondary" size="sm" onClick={onEndSession} loading={ending}>
              End session
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Rich text helper for the "Shared for this visit / Not included" strip. */
export function ScopeSummary({ shared, notShared }: { shared: string[]; notShared: string[] }): ReactNode {
  return (
    <>
      <p>
        <strong className="font-bold">Shared for this visit:</strong> {shared.join(", ")}
      </p>
      {notShared.length > 0 && (
        <p>
          <strong className="font-bold">Not included in this share:</strong> {notShared.join(", ")}
        </p>
      )}
    </>
  );
}
