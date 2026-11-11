import { cn } from "@/lib/cn";

/**
 * Determinate progress bar, from Figma "Progress bar" (361:8988) and the
 * time-remaining bar on the live session screen.
 *
 * `label` names it for screen readers ("Time remaining", "Sign-up progress");
 * `valueText` is what they hear ("24 minutes 31 seconds", "Step 3 of 7").
 * It does not announce changes on its own; announce milestones with a
 * separate polite live region (PLAN.md section 10).
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  tone = "indigo",
  thickness = "thin",
  className,
}: {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
  /** indigo: on light surfaces. onDark: white fill on indigo screens. */
  tone?: "indigo" | "onDark";
  /** thin: 2px (sign-up). thick: 8px (session timer). */
  thickness?: "thin" | "thick";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
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
        thickness === "thin" ? "h-0.5" : "h-2",
        tone === "indigo" ? "bg-border-default" : "bg-indigo-surface-dark",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "indigo" ? "bg-brand-indigo" : "bg-white",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
