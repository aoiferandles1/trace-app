import { cn } from "@/lib/cn";

/**
 * A headline number with its label: Sora 300 numeral in ink over an ink-2
 * caption, in a surface card with a border-card edge. Value and label are
 * read together ("3 medications"). Lay several out in a grid.
 *
 * `urgent` colours the number and label urgent, for something due soon
 * ("8 days until refill"); the words carry the meaning too.
 */
export function StatTile({
  value,
  label,
  urgent = false,
  className,
}: {
  value: string | number;
  label: string;
  urgent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-tile border border-border-card bg-surface px-3 py-3",
        urgent ? "text-urgent" : "text-ink",
        className,
      )}
    >
      <p className="font-display text-numeral font-light">
        {value}
        <span className="sr-only"> {label}</span>
      </p>
      <p aria-hidden="true" className={cn("truncate text-meta", !urgent && "text-ink-2")}>
        {label}
      </p>
    </div>
  );
}
