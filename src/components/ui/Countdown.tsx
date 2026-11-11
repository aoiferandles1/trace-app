"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCountdown, formatCountdownSpoken } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";

/**
 * Countdown (BRIEF.md section 3.12, boards SessionA2 and PortalRecordE):
 * the time left in Sora 300 numerals (mm:ss) and a bar that drains linearly,
 * accent on light surfaces, white on session indigo.
 *
 * The bar is role="progressbar" with min, max and now in seconds. The
 * numerals tick and are never in a live region. `announce` adds a polite
 * live region that speaks only at 5 minutes, 1 minute and 10 seconds left.
 * Leave it off where the page already announces milestones (the patient
 * share screens do, through ShareSession).
 *
 * Pass times in milliseconds, measured on the database's clock (useNow()).
 *
 * Layouts:
 * - "stacked" (SessionA2): label on the left, 40px numerals on the right,
 *   the 6px bar under them.
 * - "inline" (the portal header): only the 3px bar; show the time in text
 *   beside it yourself ("29:54 left").
 */

const MILESTONES = [5 * 60_000, 60_000, 10_000];

export function Countdown({
  msLeft,
  msTotal,
  label = "Time left",
  tone = "default",
  layout = "stacked",
  announce = false,
  className,
}: {
  msLeft: number;
  msTotal: number;
  label?: string;
  tone?: "default" | "session";
  layout?: "stacked" | "inline";
  announce?: boolean;
  className?: string;
}) {
  const left = Math.max(0, msLeft);
  const bar = (
    <ProgressBar
      value={Math.ceil(left / 1000)}
      max={Math.max(1, Math.round(msTotal / 1000))}
      label={label}
      valueText={`${formatCountdownSpoken(left)} left`}
      tone={tone}
      thickness={layout === "stacked" ? 6 : 3}
      linear
    />
  );
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {layout === "stacked" && (
        <div className="flex items-baseline justify-between">
          <span className={cn("text-caption", tone === "session" ? "text-on-session-2" : "text-ink-2")}>
            {label}
          </span>
          <span aria-hidden="true" className="font-display text-countdown font-light tabular-nums">
            {formatCountdown(left)}
          </span>
        </div>
      )}
      {bar}
      {announce && <MilestoneAnnouncer msLeft={left} />}
    </div>
  );
}

/** Speaks "5 minutes left", "1 minute left" and "10 seconds left" once each, as the time passes them. */
function MilestoneAnnouncer({ msLeft }: { msLeft: number }) {
  // Adjusts state during render when the time changes (React's pattern for
  // state derived from the previous prop), so there is no effect.
  const [seen, setSeen] = useState({ prev: msLeft, message: "" });
  if (seen.prev !== msLeft) {
    const crossed = MILESTONES.find((m) => seen.prev > m && msLeft <= m);
    setSeen({ prev: msLeft, message: crossed !== undefined ? `${formatCountdownSpoken(crossed)} left` : seen.message });
  }
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {seen.message}
    </p>
  );
}
