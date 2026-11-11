import type { ReactNode } from "react";

/**
 * The live record's frame (BRIEF.md 6.3, board PortalRecordE at 1280 x 800).
 * No header bar and no banner.
 *
 * From 1024px it fills the window: the rail (232px, full height) on the
 * left, the record in the middle (white; the patient header, then the view,
 * which scrolls inside itself), then the notes (a drag handle and the
 * resizable panel, from ResizableNotes) on the right. Below 1024px it is
 * one column that scrolls as a page: the rail as a bar of section tabs, the
 * record, then the notes.
 *
 * The view area is a size container, so views can lay out by the room they
 * really have (two panes side by side only when both fit).
 */
export function RecordFrame({
  rail,
  header,
  notes,
  children,
}: {
  rail: ReactNode;
  header: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="desk flex min-h-dvh flex-col bg-surface text-ink lg:h-dvh lg:flex-row lg:overflow-hidden">
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded-button border border-border-control bg-surface px-4 py-2 text-caption font-semibold text-accent"
      >
        Skip to the record
      </a>
      {rail}
      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col focus:outline-none lg:overflow-hidden">
        <div className="px-5 pt-7 sm:px-10">{header}</div>
        <div className="@container flex min-h-0 flex-1 flex-col px-5 pb-10 sm:px-10 lg:overflow-y-auto">{children}</div>
      </main>
      {notes}
    </div>
  );
}
