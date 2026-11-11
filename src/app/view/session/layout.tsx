import { SessionFrame } from "./_components/SessionFrame";

/**
 * Not instant, on purpose: nothing of the record renders until a status call
 * says the session is active, so the pages below are held back on first
 * render (and Next's instant-navigation check would flag them as dropped).
 */
export const instant = false;

/**
 * /view/session/*: the shared record while the session is live. The frame
 * (polling, shell, notes) persists while the doctor moves between sections,
 * so the notes draft and the countdown carry across pages.
 */
export default function SessionLayout({ children }: LayoutProps<"/view/session">) {
  return <SessionFrame>{children}</SessionFrame>;
}
