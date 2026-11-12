import { Suspense } from "react";
import { SessionScope } from "./_components/SessionFrame";

/**
 * Not instant, on purpose: nothing of the record renders until a status call
 * says the session is active, so the pages below are held back on first
 * render (and Next's instant-navigation check would flag them as dropped).
 */
export const instant = false;

/**
 * /view/session/*: the shared record while the session is live. The frame
 * (polling, shell, notes) persists while the doctor moves between sections,
 * so the notes draft and the countdown carry across pages. SessionScope
 * starts it afresh whenever the doctor comes back from outside
 * /view/session (a new code, browser Back and Forward), so nothing of one
 * session can show in the next.
 */
export default function SessionLayout({ children }: LayoutProps<"/view/session">) {
  // The frame reads the clock (the countdown) as it renders, which cannot be
  // prerendered, so it renders in the browser behind this boundary. There is
  // nothing to show before the first status call anyway.
  return (
    <Suspense fallback={null}>
      <SessionScope>{children}</SessionScope>
    </Suspense>
  );
}
