import { ChevronDown, Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pieces of the indigo share screens (p-code, p-active, p-paused, p-ended).
 */

/**
 * "Sharing preferences" (p-code) / "Dr Hennessy can see" (p-active): an
 * Indigo/Accessible card listing each shared section with a white "Shared"
 * pill, and an optional "Not included" line at the end.
 */
export function SharedSummaryCard({
  heading,
  rows,
  notIncluded,
  className,
}: {
  heading: string;
  rows: { label: string; detail: string }[] | null;
  notIncluded?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={heading}
      className={cn("flex flex-col rounded-card-tight bg-indigo-accessible pt-1.5 text-white", className)}
    >
      <h2 className="px-4 pb-2 pt-3 text-label font-medium uppercase">{heading}</h2>
      {rows === null ? (
        <p className="px-4 pb-4 text-body-tiny">Loading&hellip;</p>
      ) : (
        <ul className="divide-y divide-indigo-divider-dark">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-[11px]">
              <span className="flex min-w-0 flex-col gap-px">
                <span className="text-body-lg">{r.label}</span>
                <span className="text-body-tiny">{r.detail}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-[3px] text-label font-medium text-indigo-text">
                Shared
              </span>
            </li>
          ))}
        </ul>
      )}
      {notIncluded && <p className="px-4 pb-3 pt-2.5 text-body-tiny">Not included: {notIncluded}</p>}
      {!notIncluded && <span className="pb-2" />}
    </section>
  );
}

/**
 * The session's status row at the top of p-active, p-paused and p-ended:
 * an optional minimise link, a coloured dot with the state in words, and the
 * time on the right. The time is not a live region (it ticks); milestones are
 * announced elsewhere.
 */
export function SessionStatusRow({
  label,
  dot,
  time,
  timeLabel,
  minimiseHref,
  tone = "indigo",
}: {
  label: string;
  dot: "teal" | "peach" | "red";
  time?: string;
  /** Spoken form of the time ("24 minutes 31 seconds left"). */
  timeLabel?: string;
  minimiseHref?: string;
  tone?: "indigo" | "page";
}) {
  const dotClass = { teal: "bg-teal-400", peach: "bg-brand-peach", red: "bg-status-danger" }[dot];
  return (
    <div className={cn("flex min-h-11 items-center gap-2", tone === "indigo" ? "text-white" : "text-text-primary")}>
      {minimiseHref && (
        <Link
          href={minimiseHref}
          aria-label="Minimise. Back to Home"
          className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full hovered:bg-white/10"
        >
          <ChevronDown aria-hidden="true" className="size-6" />
        </Link>
      )}
      <p className="flex items-center gap-1.5 text-label font-medium">
        <span aria-hidden="true" className={cn("size-2 rounded-full", dotClass)} />
        {label}
      </p>
      <span className="flex-1" />
      {time !== undefined && (
        <p className="flex items-center gap-1.5 text-label font-medium">
          <Clock aria-hidden="true" className="size-4" />
          <span aria-hidden={timeLabel ? true : undefined}>{time}</span>
          {timeLabel && <span className="sr-only">{timeLabel}</span>}
        </p>
      )}
    </div>
  );
}

/** A full-width white action on indigo ("End sharing now"). */
export function OnDarkNote({ children }: { children: ReactNode }) {
  return <p className="text-center text-body-tiny text-white">{children}</p>;
}
