import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page frame for the clinician portal. It sets `.desk`, so every token
 * inside takes its desktop value (12px card radius, 40px buttons, 26px
 * titles).
 *
 * From 1024px: the rail (232px, session indigo, full height), the record
 * (white, fluid), and the notes column (300px, ground) on the right, with
 * the rail and notes sticky. Below 1024px everything stacks: the rail
 * becomes a row of section tabs above the record, and the notes follow it.
 *
 * Pages without a session (the code and waiting steps, ended) pass no
 * sidebar and get one column; `tone="session"` gives the waiting screen's
 * session indigo. The paused screen passes `notes` alone. <main> is a flex
 * column, so a child with `flex-1` fills the height between header and
 * footer.
 *
 * The live record has its own frame, RecordFrame (components/portal), with
 * the full-height rail and the resizable notes panel.
 */
export function PortalShell({
  header,
  sidebar,
  notes,
  footer,
  children,
  tone = "ground",
  className,
}: {
  header?: ReactNode;
  sidebar?: ReactNode;
  notes?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  tone?: "ground" | "surface" | "session";
  className?: string;
}) {
  const hasSidebar = Boolean(sidebar);
  const hasNotes = Boolean(notes);
  const hasColumns = hasSidebar || hasNotes;
  return (
    <div
      className={cn(
        "desk flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)]",
        tone === "session" && "on-session bg-session text-white",
        tone === "ground" && "bg-ground text-ink",
        tone === "surface" && "bg-surface text-ink",
        className,
      )}
    >
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded-button border border-border-control bg-surface px-4 py-2 text-caption font-semibold text-accent"
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
              hasSidebar && hasNotes && "lg:grid-cols-[232px_minmax(0,1fr)_300px]",
              hasSidebar && !hasNotes && "lg:grid-cols-[232px_minmax(0,1fr)]",
              !hasSidebar && hasNotes && "lg:grid-cols-[minmax(0,1fr)_300px]",
            ),
        )}
      >
        {sidebar && (
          <div className="bg-session">
            <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">{sidebar}</div>
          </div>
        )}
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col focus:outline-none">
          {children}
        </main>
        {notes && (
          <div className="border-t border-border-card bg-ground lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">{notes}</div>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
