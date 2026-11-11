import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page frame for every patient screen.
 *
 * - Up to 480px wide it fills the screen; wider, it is a centred 430px
 *   column on ground with border-card edges. No fake iOS status bar.
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
 */
export function PatientShell({
  children,
  demo,
  banner,
  header,
  footer,
  tabBar,
  tone = "ground",
  className,
}: {
  children: ReactNode;
  demo?: ReactNode;
  banner?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabBar?: ReactNode;
  tone?: "ground" | "session";
  className?: string;
}) {
  const session = tone === "session";
  return (
    <div className={cn("min-h-dvh", session ? "bg-session" : "bg-ground")}>
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-[480px] flex-col min-[481px]:max-w-[430px] min-[481px]:border-x",
          session
            ? "on-session bg-session text-white min-[481px]:border-on-session-border"
            : "bg-ground text-ink min-[481px]:border-border-card",
          className,
        )}
      >
        {demo}
        {banner && <div className="sticky top-0 z-30">{banner}</div>}
        {header}
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        {footer && (
          <div
            className={cn(
              "sticky bottom-0 z-20 px-5 pb-6 pt-3",
              session ? "bg-session" : "border-t border-border-tabbar bg-ground",
            )}
          >
            {footer}
          </div>
        )}
        {tabBar && <div className="sticky bottom-0 z-20">{tabBar}</div>}
      </div>
    </div>
  );
}
