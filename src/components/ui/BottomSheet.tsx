"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

/**
 * Bottom sheet (BRIEF.md section 3.9, boards TimelineA2 and ApproveA2): a
 * white panel with 28px top corners, a 40 x 4 grab handle in border-control,
 * a 36px close button at the top right, over the rgba(20,22,58,.45) scrim
 * (over session indigo that scrim is ApproveA2's #2A3787 backdrop). 12px
 * between its parts, 12px above the handle and 24px below, as both boards.
 * It is at most 75% of the viewport tall: its content scrolls, and the
 * `actions` stay pinned under it, so a long access request still shows Allow
 * and Deny together without scrolling. No shadow.
 *
 * It is a modal <dialog> opened with showModal(), so the browser moves focus
 * in, makes the page behind inert, and returns focus to whatever opened it
 * when it closes. Tab and Shift+Tab also wrap inside the sheet, so focus
 * cannot leave it for the browser's own controls.
 *
 * - `title` is the dialog's accessible name (rendered as the sheet's h2).
 * - Escape, the close button and a backdrop tap call `onClose`. Set
 *   `dismissible={false}` when the user must answer with a button (the
 *   access request: Allow or Deny); the close button is then not drawn.
 * - Put the primary actions in `actions`; they sit at the bottom, outside
 *   the part that scrolls.
 */

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small accent line above the title ("Access request"). */
  eyebrow?: ReactNode;
  /** A caption under the title ("Aug 2026, Infection" on TimelineA2's sheet). */
  meta?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  /** Element to focus first, by id. Defaults to the first focusable element. */
  initialFocusId?: string;
  className?: string;
};

export function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  meta,
  children,
  actions,
  dismissible = true,
  initialFocusId,
  className,
}: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // While the content scrolls (a long request at 390 x 844) the scrolling part takes focus,
  // so it can be scrolled from the keyboard.
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;
    const check = () => setScrolls(body.scrollHeight > body.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(body);
    for (const child of Array.from(body.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Without scrolling: the part that scrolls would otherwise start at the focused element
      // and hide the title above it.
      if (initialFocusId) document.getElementById(initialFocusId)?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Next.js keeps a screen mounted but hidden after navigating away (React
    // Activity), which runs this cleanup. A modal <dialog> left open there
    // would stay in the top layer and make every other screen inert, so close
    // it; if the screen comes back with `open` still true, it reopens.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open, initialFocusId]);

  function trapTab(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !ref.current) return;
    const focusable = Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      onKeyDown={trapTab}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mx-auto mt-auto max-h-[75dvh] w-full max-w-[430px] overflow-hidden rounded-t-sheet bg-surface p-0 text-ink",
        // display: only while open, so a closed dialog stays hidden.
        "backdrop:bg-scrim open:flex open:animate-sheet-up open:flex-col",
        className,
      )}
    >
      <div
        ref={bodyRef}
        tabIndex={scrolls ? 0 : undefined}
        className={cn(
          "flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pt-3 focus-visible:-outline-offset-2",
          actions ? "pb-1" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <span aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-border-control" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {eyebrow && <p className="text-meta leading-4 font-semibold text-accent">{eyebrow}</p>}
            <h2 id={titleId} className="font-display text-title-md font-light">
              {title}
            </h2>
            {meta && <p className="text-caption text-ink-2">{meta}</p>}
          </div>
          {dismissible && <IconButton label="Close" icon="close" iconSize={22} size={36} tone="muted" onClick={onClose} />}
        </div>
        {children}
      </div>
      {/* 16px above the actions (the boards' 12px gap and 4px padding), 24px below (more on a phone
          with a home indicator, when the app runs full screen). */}
      {actions && (
        <div className="flex shrink-0 flex-col items-center gap-1 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          {actions}
        </div>
      )}
    </dialog>
  );
}
