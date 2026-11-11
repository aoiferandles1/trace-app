import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

/**
 * The session line at the top of the portal record: what the doctor is
 * reading, the time left in words (600), and "End session". Plain text on
 * the page: no banner fill, no LIVE stamp (BRIEF.md section 1). Phase 7
 * replaces it with PortalRecordE's header facts row and draining bar.
 *
 * The countdown is plain text: do not wrap this in a live region; announce
 * milestones separately.
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
  return (
    <section
      aria-label="Live session"
      className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}
    >
      <p className="min-w-0 flex-1 basis-60 text-caption text-ink-2">
        Reading {patientName}&rsquo;s record, shared today, {profile}. Read only.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {timeLeft && <p className="text-caption font-semibold tabular-nums">Access expires in {timeLeft}</p>}
        {onEndSession && (
          <Button variant="secondary" size="sm" onClick={onEndSession} loading={ending}>
            End session
          </Button>
        )}
      </div>
    </section>
  );
}

/** What this share includes and leaves out, as two plain lines. */
export function ScopeSummary({ shared, notShared }: { shared: string[]; notShared: string[] }): ReactNode {
  return (
    <>
      <p>
        <span className="font-semibold text-ink">Shared for this visit:</span> {shared.join(", ")}
      </p>
      {notShared.length > 0 && (
        <p>
          <span className="font-semibold text-ink">Not included in this share:</span> {notShared.join(", ")}
        </p>
      )}
    </>
  );
}
