"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet, from p-request ("Sheet · Access Request"): page-coloured
 * panel with 28px top corners and a grabber, over a dark scrim.
 *
 * It is a modal <dialog> opened with showModal(), so the browser moves focus
 * in, makes the page behind inert, and returns focus to whatever opened it
 * when it closes. Tab and Shift+Tab also wrap inside the sheet, so focus
 * cannot leave it for the browser's own controls.
 *
 * - `title` is the dialog's accessible name (rendered as the sheet's h2).
 * - Escape calls `onClose`. Set `dismissible={false}` to ignore Escape and
 *   backdrop clicks when the user must answer with a button (the access
 *   request: Allow or Deny).
 * - Put the primary actions in `actions`; they sit at the bottom.
 */

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small caps line above the title ("ACCESS REQUEST"). */
  eyebrow?: ReactNode;
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
        "m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-sheet bg-surface-page p-0 text-text-primary shadow-sheet",
        "backdrop:bg-[rgba(12,25,39,0.6)]",
        "open:animate-[sheet-up_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
        className,
      )}
    >
      <div className="flex min-h-full flex-col gap-3.5 px-5 pb-6 pt-2.5">
        <div aria-hidden="true" className="flex justify-center pb-1.5 pt-0.5">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex flex-col gap-0.5">
          {eyebrow && <p className="text-label font-medium uppercase text-indigo-text">{eyebrow}</p>}
          <h2 id={titleId} className="font-display text-[26px] font-light leading-8">
            {title}
          </h2>
        </div>
        {children}
        {actions && <div className="mt-4 flex flex-col gap-3.5">{actions}</div>}
      </div>
    </dialog>
  );
}
