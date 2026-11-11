import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The portal's footer outside a session (boards PortalEntryB and
 * PortalWaitB): a 64px row on the page, no bar. On the left, by default,
 * "Privacy and security" and "For your practice" (14px 500 accent links to
 * /view/about); the waiting screen passes its own line instead. On the
 * right, a 13px ink-2 note: "Demo with sample data" in the demo, otherwise
 * that Trace is a portfolio project.
 */

export const CASE_STUDY_URL = "https://aoiferandles.com/trace/";

export function PortalFooter({
  tone = "default",
  demo = false,
  children,
  className,
}: {
  tone?: "default" | "session";
  /** The demo (/view?demo=1): "Demo with sample data" on the right. */
  demo?: boolean;
  /** Replaces the two links on the left. */
  children?: ReactNode;
  className?: string;
}) {
  const session = tone === "session";
  const link = cn(
    "flex min-h-8 items-center text-caption font-medium",
    session ? "text-white underline underline-offset-2" : "text-accent hovered:underline",
  );
  return (
    <footer
      className={cn(
        "flex flex-col gap-3 px-5 py-5 text-meta leading-4 sm:px-14 md:min-h-16 md:flex-row md:items-center md:justify-between md:gap-6 md:py-0",
        session ? "text-on-session-2" : "text-ink-2",
        className,
      )}
    >
      {children ?? (
        <nav aria-label="About the portal" className="flex gap-6">
          <Link href="/view/about#privacy" className={link}>
            Privacy and security
          </Link>
          <Link href="/view/about#practice" className={link}>
            For your practice
          </Link>
        </nav>
      )}
      <p>{demo ? "Demo with sample data" : "A portfolio project, not a medical service"}</p>
    </footer>
  );
}
