import type { ReactNode } from "react";

/** Label and value rows for detail screens, as in the medication card's expanded panel. */
export function DetailList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border-default">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-4 py-4 text-body-sm">
          <dt className="w-[110px] shrink-0 text-text-tertiary">{r.label}</dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-text-primary">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The "not in your record" state for a detail screen. */
export function NotFound({ what }: { what: string }) {
  return (
    <p role="alert" className="px-5 py-10 text-center text-body-sm text-text-primary">
      This {what} isn&apos;t in your record. It may have been deleted.
    </p>
  );
}
