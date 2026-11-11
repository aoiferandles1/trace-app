import type { ReactNode } from "react";

/**
 * What the right-hand pane says at desktop widths before anything in the
 * list beside it is chosen: one ink-2 line where a detail's title would be,
 * as the brief's empty states (BRIEF.md section 3.13).
 */
export function PaneHint({ children }: { children: ReactNode }) {
  return <p className="flex min-h-14 items-center px-5 text-body text-ink-2">{children}</p>;
}
