import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Critical safety strip, from Figma "Critical Safety Strip" (50:997).
 * Allergies, blood type and implants. Always shown, always first, never
 * toggled off (PLAN.md section 2).
 *
 * - `variant="patient"` (p-record): red tint, filled red pills with white text.
 * - `variant="portal"` (c-overview): lighter tint, white pills with red text.
 *
 * It is a labelled region with a real list, and the word "Critical" is text,
 * so the meaning never depends on colour. Lives in components/patient but the
 * portal uses it too.
 */
export function CriticalSafetyStrip({
  items,
  variant = "patient",
  emptyText = "No allergies or blood type recorded",
  className,
}: {
  /** e.g. ["Penicillin allergy", "A+ Blood Type"]. */
  items: string[];
  variant?: "patient" | "portal";
  emptyText?: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Critical safety information"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-2.5",
        variant === "patient"
          ? "border-status-danger bg-status-danger-tint shadow-strip"
          : "border-[rgba(216,90,74,0.2)] bg-[rgba(251,234,231,0.45)] px-6 shadow-strip",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-body-tiny font-bold uppercase tracking-[0.04em] text-red-700">
        <TriangleAlert aria-hidden="true" className="size-4" />
        Critical
      </p>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                "rounded-md px-3 py-1 text-label font-medium",
                variant === "patient"
                  ? "border border-status-danger bg-critical-pill text-white"
                  : "border border-status-danger bg-white text-red-700",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-label font-medium text-red-700">{emptyText}</p>
      )}
    </section>
  );
}
