import { SectionLabel } from "@/components/ui/Card";
import { SharedMark } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";

/**
 * Pieces of the session-indigo share screens (boards CodeA2 and SessionA2).
 */

/**
 * What is shared, on session indigo: a heading, then one row per shared
 * section (name, an optional caption in white at 78%, and a white tick disc
 * read as "Shared") divided by on-session hairlines. `notIncluded` adds the
 * "Not shared" group with an empty ring per item (CodeA2).
 */
export function SharedSummaryCard({
  heading,
  rows,
  notIncluded,
  headingStyle = "label",
  className,
}: {
  heading: string;
  rows: { label: string; detail?: string }[] | null;
  /** Section names that are not shared. A string is shown as one line. */
  notIncluded?: string[] | string;
  /** "heading": Sora 20 ("Sharing", CodeA2). "label": 14px 600 ("Dr Hennessy can see", SessionA2). */
  headingStyle?: "heading" | "label";
  className?: string;
}) {
  const notList = typeof notIncluded === "string" ? null : notIncluded;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <section aria-label={heading} className="flex flex-col gap-1">
        {headingStyle === "heading" ? (
          <h2 className="font-display text-heading font-light">{heading}</h2>
        ) : (
          <SectionLabel tone="session">{heading}</SectionLabel>
        )}
        {rows === null ? (
          <p className="py-3 text-caption text-on-session-2">Loading&hellip;</p>
        ) : (
          <ul className="divide-y divide-on-session-border">
            {rows.map((r) => (
              <li key={r.label} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-row font-medium">{r.label}</span>
                  {r.detail && <span className="text-caption text-on-session-2">{r.detail}</span>}
                </span>
                <SharedMark />
              </li>
            ))}
          </ul>
        )}
      </section>
      {notList && notList.length > 0 && (
        <section aria-label="Not shared" className="flex flex-col gap-2">
          <SectionLabel tone="session">Not shared</SectionLabel>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {notList.map((n) => (
              <li key={n} className="flex items-center gap-2.5 text-caption text-on-session-2">
                <span aria-hidden="true" className="size-4.5 shrink-0 rounded-full border-2 border-on-session-ring" />
                <span className="first-letter:uppercase">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {typeof notIncluded === "string" && notIncluded && (
        <p className="text-caption text-on-session-2">Not shared: {notIncluded}</p>
      )}
    </div>
  );
}
