import { cn } from "@/lib/cn";

/**
 * Determinate progress bar: the sign-up steps' 3px accent bar (BRIEF.md
 * section 7) and the countdown's draining bar (section 3.12).
 *
 * Track border-row with an accent fill on light surfaces; on session indigo
 * (`tone="session"`) the track is on-session-border with a white fill.
 * `thickness`: 3px (default) or 6px (SessionA2's time-left bar).
 *
 * `label` names it for screen readers; `valueText` is what they hear ("Step
 * 3 of 7", "24 minutes 31 seconds"). It does not announce changes; announce
 * milestones with a separate polite live region.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  tone = "default",
  thickness = 3,
  linear = false,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
  tone?: "default" | "session";
  thickness?: 3 | 6;
  /** Drain linearly over each second (countdowns). */
  linear?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
      className={cn(
        "w-full overflow-hidden rounded-full",
        thickness === 3 ? "h-0.75" : "h-1.5",
        tone === "session" ? "bg-on-session-border" : "bg-border-row",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          linear ? "duration-1000 ease-linear" : "duration-200 ease-out",
          tone === "session" ? "bg-white" : "bg-accent",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
