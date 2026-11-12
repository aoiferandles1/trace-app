import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page frame for every patient screen.
 *
 * - Up to 480px wide it fills the screen; wider, it is a centred 430px
 *   column on ground with border-card edges. No fake iOS status bar.
 * - The frame is one screen tall, as on the boards: the demo strip, banner,
 *   footer and tab bar stay put and only <main> (header included) scrolls,
 *   so nothing ever sits underneath the tab bar.
 * - Content sits in a 20px gutter (`px-5`); screens add it themselves.
 *
 * Slots, top to bottom:
 *   demo    - <DemoStrip /> (via DemoMarker), demo accounts only, at the very top
 *   banner  - the live share banner while a session is open (sticks to the top)
 *   header  - <PageHeader /> or <ProgressHeader />
 *   children - the screen, inside <main id="main">
 *   footer  - a sticky bottom action (a pinned primary pill), above the tab bar
 *   tabBar  - <TabBar /> on the five main screens (sticks to the bottom)
 *
 * `tone="session"` is for the sharing screens (code, session active, time's
 * up): session indigo, white text, white focus rings. Session indigo is
 * reserved for sharing; nothing else uses it.
 *
 * Desktop (from 1024px; BRIEF.md section 7, "Patient web", no board). The
 * column screens (welcome, sign-in and sign-up, the sharing screens) keep
 * the centred 430px column, and take the desktop token values (`.desk-lg`).
 * The signed-in screens pass `rail` (only at desktop widths, see
 * `useDesktop`), which switches to the desktop layout:
 *
 *   rail    - <PatientRail />, white, 232px, full height, left
 *   aside   - a list beside a detail (the detail screen's own list), left pane
 *   detail  - what a list screen shows beside its list, right pane
 *
 * The content starts beside the rail and is never wider than 1120px. A
 * screen with neither `aside` nor `detail` is one 640px column; with one of
 * them it is two panes, a 360px list on the left and the detail on the
 * right, each scrolling on its own (the portal's two-pane pattern). The
 * demo strip runs across the top, the live banner and the pinned footer
 * stay with the content. The phone layout (no `rail`) is unchanged.
 */
export function PatientShell({
  children,
  demo,
  banner,
  header,
  footer,
  tabBar,
  rail,
  aside,
  detail,
  tone = "ground",
  className,
}: {
  children: ReactNode;
  demo?: ReactNode;
  banner?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabBar?: ReactNode;
  /** Desktop only: the left rail. Its presence switches to the desktop layout. */
  rail?: ReactNode;
  /** Desktop only: the list shown to the left of this (detail) screen. */
  aside?: ReactNode;
  /** Desktop only: what shows to the right of this (list) screen. */
  detail?: ReactNode;
  tone?: "ground" | "session";
  className?: string;
}) {
  const session = tone === "session";
  if (rail) {
    return (
      <DesktopFrame demo={demo} banner={banner} header={header} footer={footer} rail={rail} aside={aside} detail={detail}>
        {children}
      </DesktopFrame>
    );
  }
  return (
    // Printing (Your record to print) lets the page run on instead of one scrolling screen.
    <div className={cn("desk-lg h-dvh print:h-auto", session ? "bg-session" : "bg-ground")}>
      <div
        className={cn(
          "mx-auto flex h-dvh w-full max-w-[480px] flex-col min-[481px]:max-w-[430px] min-[481px]:border-x print:h-auto print:max-w-none print:border-0",
          session
            ? "on-session bg-session text-white min-[481px]:border-on-session-border"
            : "bg-ground text-ink min-[481px]:border-border-card",
          className,
        )}
      >
        <div className="contents print:hidden">{demo}</div>
        {banner && <div className="shrink-0 print:hidden">{banner}</div>}
        <main
          id="main"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto print:overflow-visible",
            // Whatever is last on screen clears the home indicator (0 outside a full screen
            // home screen app): the tab bar and the footer pad themselves, else <main> does.
            !footer && !tabBar && "pb-[env(safe-area-inset-bottom)]",
          )}
        >
          {header}
          {children}
        </main>
        {footer && (
          <div
            className={cn(
              "shrink-0 px-5 pt-3 print:hidden",
              tabBar ? "pb-6" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
              session ? "bg-session" : "border-t border-border-tabbar bg-ground",
            )}
          >
            {footer}
          </div>
        )}
        {tabBar && <div className="shrink-0 print:hidden">{tabBar}</div>}
      </div>
    </div>
  );
}

/** The signed-in screens from 1024px: the rail, then one column or two panes. */
function DesktopFrame({
  children,
  demo,
  banner,
  header,
  footer,
  rail,
  aside,
  detail,
}: {
  children: ReactNode;
  demo?: ReactNode;
  banner?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  rail: ReactNode;
  aside?: ReactNode;
  detail?: ReactNode;
}) {
  const twoPane = Boolean(aside || detail);
  const content = (
    <>
      {header}
      {children}
    </>
  );
  return (
    <div className="desk flex h-dvh flex-col bg-ground text-ink">
      {demo}
      <div className="flex min-h-0 flex-1">
        {rail}
        <div className="flex min-w-0 flex-1 flex-col">
          {banner && <div className="shrink-0">{banner}</div>}
          {twoPane ? (
            <div className="flex min-h-0 w-full max-w-[1120px] flex-1 px-5 pt-4">
              {aside ? (
                <>
                  <div className="flex w-90 shrink-0 flex-col overflow-y-auto">{aside}</div>
                  <main id="main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border-l border-border-tabbar">
                    {content}
                  </main>
                </>
              ) : (
                <>
                  <main id="main" className="flex min-h-0 w-90 shrink-0 flex-col overflow-y-auto">
                    {content}
                  </main>
                  <section
                    aria-label="Details"
                    aria-live="polite"
                    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border-l border-border-tabbar"
                  >
                    {detail}
                  </section>
                </>
              )}
            </div>
          ) : (
            <main id="main" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex w-full max-w-[1120px] flex-1 flex-col px-5 pt-4">
                <div className="flex w-full max-w-160 flex-1 flex-col">{content}</div>
              </div>
            </main>
          )}
          {footer && (
            <div className="w-full max-w-[1120px] shrink-0 px-5">
              <div className={cn("border-t border-border-tabbar px-5 pb-6 pt-3", twoPane ? "" : "max-w-160")}>{footer}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
