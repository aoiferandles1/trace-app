"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

/**
 * Bottom sheet (BRIEF.md section 3.9, boards TimelineA2 and ApproveA2): a
 * white panel with 28px top corners, a 40 x 4 grab handle in border-control,
 * a 36px close button at the top right, over the rgba(20,22,58,.45) scrim.
 * It is at most 75% of the viewport tall and its content scrolls. No shadow.
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
 * - Put the primary actions in `actions`; they sit at the bottom.
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocusId) document.getElementById(initialFocusId)?.focus();
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
        "m-0 mx-auto mt-auto max-h-[75dvh] w-full max-w-[430px] overflow-y-auto rounded-t-sheet bg-surface p-0 text-ink",
        "backdrop:bg-scrim open:animate-sheet-up",
        className,
      )}
    >
      <div className="flex min-h-full flex-col gap-4 px-5 pb-6 pt-3">
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
        {actions && <div className="flex flex-col items-center gap-1 pt-1">{actions}</div>}
      </div>
    </dialog>
  );
}
