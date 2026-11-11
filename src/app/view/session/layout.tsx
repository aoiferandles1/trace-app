import { SessionFrame } from "./_components/SessionFrame";

/**
 * /view/session/*: the shared record while the session is live. The frame
 * (polling, shell, notes) persists while the doctor moves between sections,
 * so the notes draft and the countdown carry across pages.
 */
export default function SessionLayout({ children }: LayoutProps<"/view/session">) {
  return <SessionFrame>{children}</SessionFrame>;
}
