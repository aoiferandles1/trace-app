import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * The live record's header (BRIEF.md 6.3, board PortalRecordE), white, on
 * the page: a 56px accent avatar with Sora initials, the patient's name as
 * the page's h1 (Sora 300, 30px) with the details as a caption, and an
 * action on the right (End session). Under it one row of facts, each a 13px
 * ink-2 label over a 17px 600 value, 64px apart, no dividers and no pills;
 * then whatever comes last (the 3px draining bar). Nothing else.
 *
 * Facts are a <dl>, so each value is read with its label. A fact with
 * `tone="critical"` is the allergy: critical colour and a warning icon, and
 * the label says what it is, so it is never colour alone.
 */

export type HeaderFact = { label: string; value: ReactNode; tone?: "default" | "critical" };

export function PatientSummaryCard({
  name,
  initials,
  details,
  facts,
  action,
  children,
  className,
}: {
  name: string;
  initials: string;
  /** "35, female, born 12 Mar 1991, Dublin" */
  details: string;
  facts: HeaderFact[];
  action?: ReactNode;
  /** Under the facts (the countdown bar). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar initials={initials} size={56} tone="solid" display />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-display text-name font-light">{name}</h1>
            {details && <p className="text-caption text-ink-2">{details}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      <div className="flex flex-col gap-4.5">
        {facts.length > 0 && (
          <dl className="flex flex-wrap gap-x-16 gap-y-3">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-0.5">
                <dt className="text-meta leading-4 text-ink-2">{f.label}</dt>
                <dd
                  className={cn(
                    "flex items-center gap-2 text-row-lg font-semibold",
                    f.tone === "critical" ? "text-critical" : "text-ink",
                  )}
                >
                  {f.tone === "critical" && <Icon name="warning" size={18} />}
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </header>
  );
}
