import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page frame for every patient screen (PLAN.md section 6, "Layout rules").
 *
 * - Up to 480px wide it fills the screen.
 * - Wider, it is a centred 430px column on Surface/Page with hairline edges.
 * - No fake iOS status bar: the 9:41 row in Figma is device chrome.
 *
 * Slots, top to bottom:
 *   banner  - LiveShareBanner while a session is live (sticks to the top)
 *   header  - ScreenHeader or ProgressHeader
 *   children - the screen, inside <main id="main">
 *   footer  - a sticky bottom action bar (sign-up "Continue"), above the tab bar
 *   tabBar  - <TabBar /> on the five main screens (sticks to the bottom)
 *
 * `tone="indigo"` is for the full-bleed indigo screens (p-active, p-paused):
 * Indigo/Surface-Dark background, white text, white focus rings.
 */
export function PatientShell({
  children,
  banner,
  header,
  footer,
  tabBar,
  tone = "page",
  className,
}: {
  children: ReactNode;
  banner?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabBar?: ReactNode;
  tone?: "page" | "indigo";
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh", tone === "indigo" ? "bg-indigo-surface-dark" : "bg-surface-page")}>
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-[480px] flex-col min-[481px]:max-w-[430px] min-[481px]:border-x",
          tone === "indigo"
            ? "on-dark bg-indigo-surface-dark text-white min-[481px]:border-indigo-divider-dark"
            : "bg-surface-page min-[481px]:border-border-default",
          className,
        )}
      >
        {banner && <div className="sticky top-0 z-30">{banner}</div>}
        {header}
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        {footer && (
          <div className="sticky bottom-0 z-20 border-t border-border-default bg-surface-page px-5 py-3">
            {footer}
          </div>
        )}
        {tabBar && <div className="sticky bottom-0 z-20">{tabBar}</div>}
      </div>
    </div>
  );
}
