import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "Demo with sample data" (BRIEF.md section 3.2): a 28px strip at the very
 * top of the screen, 12px ink-2 text centred over a border-tabbar hairline.
 * As on every board, the hairline is under the 28px, so the strip takes 29.
 * On session indigo the text is white at 78% over an on-session hairline.
 *
 * It is the flag's one place: render it only while the app runs on sample
 * data (a demo account). Patient screens get it from <DemoMarker />, which
 * checks the account. `children` adds to the line (CodeA2 adds a link).
 */
export function DemoStrip({
  tone = "default",
  children,
  className,
}: {
  tone?: "default" | "session";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex min-h-7.25 shrink-0 flex-wrap items-center justify-center gap-x-1.5 border-b px-5 text-micro",
        tone === "session" ? "border-on-session-border text-on-session-2" : "border-border-tabbar text-ink-2",
        className,
      )}
    >
      Demo with sample data
      {children}
    </p>
  );
}
