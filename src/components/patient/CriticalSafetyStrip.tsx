import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Pinned safety facts (board RecordA2): a 48px critical-tint strip, radius
 * 16. Allergies are critical 600 text with a warning icon; the other facts
 * (blood type, implants) follow in ink-2. Always shown, always
 * first, never toggled off (PLAN.md section 2).
 *
 * It is a labelled region with a real list, and each fact says what it is in
 * words ("Penicillin allergy"), so the meaning never depends on colour.
 * `variant="portal"` drops the tint (the portal shows facts in its header).
 */
export function CriticalSafetyStrip({
  items,
  variant = "patient",
  emptyText = "No allergies or blood type recorded",
  className,
}: {
  /** e.g. ["Penicillin allergy", "A+ Blood Type"]. Items that say "allergy" are shown as critical. */
  items: string[];
  variant?: "patient" | "portal";
  emptyText?: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Critical safety information"
      className={cn(
        "flex min-h-12 items-center rounded-strip px-4 py-2",
        variant === "patient" ? "bg-critical-tint" : "border border-border-card bg-surface",
        className,
      )}
    >
      {items.length > 0 ? (
        <ul className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {items.map((item) => {
            const allergy = /allerg/i.test(item);
            return (
              <li
                key={item}
                className={cn(
                  "flex items-center gap-1.5",
                  allergy ? "text-label font-semibold text-critical" : "text-caption text-ink-2",
                )}
              >
                {allergy && <Icon name="warning" size={18} />}
                {item}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-caption text-ink-2">{emptyText}</p>
      )}
    </section>
  );
}
