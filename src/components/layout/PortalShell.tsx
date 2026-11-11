import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page frame for the clinician portal (PLAN.md section 6, "Layout rules").
 *
 * From 1024px: header across the top, then three columns, sidebar 256px,
 * the record (fluid), session notes 330px, then the footer. Sidebar and notes
 * stick while the record scrolls.
 *
 * Below 1024px everything stacks: header, the sidebar as a row of section
 * tabs, the record, the notes under it, the footer. A GP may well open it on
 * a tablet.
 *
 * Pages without a session (the name and code steps) pass no sidebar or notes
 * and get a single centred column; `tone="indigo"` gives c-code's indigo
 * background.
 */
export function PortalShell({
  header,
  sidebar,
  notes,
  footer,
  children,
  tone = "page",
  className,
}: {
  header: ReactNode;
  sidebar?: ReactNode;
  notes?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  tone?: "page" | "indigo";
  className?: string;
}) {
  const hasSidebar = Boolean(sidebar);
  const hasNotes = Boolean(notes);
  const hasColumns = hasSidebar || hasNotes;
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col",
        tone === "indigo" ? "on-dark bg-indigo-surface-dark text-white" : "bg-surface-page",
        className,
      )}
    >
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md bg-surface-card px-4 py-2 text-body-sm font-medium text-indigo-text shadow-lg"
      >
        Skip to the record
      </a>
      {header}
      <div
        className={cn(
          "flex flex-1 flex-col",
          hasColumns &&
            cn(
              "lg:grid",
              hasSidebar && hasNotes && "lg:grid-cols-[256px_minmax(0,1fr)_330px]",
              hasSidebar && !hasNotes && "lg:grid-cols-[256px_minmax(0,1fr)]",
              !hasSidebar && hasNotes && "lg:grid-cols-[minmax(0,1fr)_330px]",
            ),
        )}
      >
        {sidebar && (
          <div className="bg-indigo-surface-dark">
            <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">{sidebar}</div>
          </div>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
        {notes && (
          <div className="border-t-[3px] border-brand-indigo bg-brand-indigo-tint lg:border-l-[3px] lg:border-t-0">
            <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">{notes}</div>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
