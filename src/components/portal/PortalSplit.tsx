import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The body of the portal's steps outside a session (boards PortalEntryB and
 * PortalWaitB, 1280 x 800): two columns centred on the page's height, the
 * step itself (520px) and a quiet list beside it (340px), 140px apart, with
 * 160px on the left and 56px on the right.
 *
 * Narrower than 1280 the gap and left inset shrink; below 1024 the columns
 * stack with the 20px (56px from 640) gutter.
 */
export function PortalSplit({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  /** The 340px column ("What happens next", the waiting steps). */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-12 px-5 py-10 sm:px-14 lg:flex-row lg:items-center lg:gap-16 lg:py-6 xl:gap-35 xl:pl-40",
        className,
      )}
    >
      <div className="flex w-full max-w-130 flex-col">{children}</div>
      {aside && <div className="flex w-full max-w-85 flex-col">{aside}</div>}
    </div>
  );
}

/**
 * A numbered or ticked list of three steps, each a 76px row between
 * hairlines (PortalEntryB's "What happens next", PortalWaitB's progress).
 */
export function StepRows({
  children,
  tone = "default",
  label,
  className,
}: {
  children: ReactNode;
  tone?: "default" | "session";
  /** Names the list for screen readers when there is no heading. */
  label?: string;
  className?: string;
}) {
  return (
    <ol
      aria-label={label}
      className={cn(
        "flex flex-col border-b",
        tone === "session" ? "border-on-session-border" : "border-border-card",
        className,
      )}
    >
      {children}
    </ol>
  );
}

export function StepRow({
  marker,
  children,
  tone = "default",
  current = false,
  muted = false,
  className,
}: {
  marker: ReactNode;
  children: ReactNode;
  tone?: "default" | "session";
  current?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "flex min-h-19 items-center border-t py-3 text-row",
        tone === "session" ? "gap-4 border-on-session-border" : "gap-5 border-border-card",
        current && "font-semibold",
        muted && "text-on-session-2",
        className,
      )}
    >
      {marker}
      <span>{children}</span>
    </li>
  );
}
