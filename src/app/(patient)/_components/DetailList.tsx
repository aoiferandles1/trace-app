import type { ReactNode } from "react";
import { DetailBlock } from "@/components/ui/DetailBlock";
import { StateMessage } from "@/components/ui/StateMessage";

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

/** The "not in your record" state for a detail screen: one plain line and a way on (E21). */
export function NotFound({ what }: { what: string }) {
  return (
    <StateMessage
      tone="error"
      align="center"
      className="px-5 py-10"
      message={`There's no ${what} here. It may have been deleted.`}
      action={{ label: "Go to your record", href: "/record" }}
    />
  );
}
