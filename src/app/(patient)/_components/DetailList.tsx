import type { ReactNode } from "react";
import { DetailBlock } from "@/components/ui/DetailBlock";

/**
 * Labelled blocks for detail screens (BRIEF.md 5.9): each label 13px ink-2
 * above its value at 16px ink, as in the boards' "Seen by / Outcome" blocks.
 */
export function DetailList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {rows.map((r) => (
        <DetailBlock key={r.label} label={r.label} term>
          {r.value}
        </DetailBlock>
      ))}
    </dl>
  );
}

/** The "not in your record" state for a detail screen. */
export function NotFound({ what }: { what: string }) {
  return (
    <p role="alert" className="px-5 py-10 text-center text-body text-ink-2">
      This {what} isn&apos;t in your record. It may have been deleted.
    </p>
  );
}
