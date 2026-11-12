"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SwitchRow } from "@/components/ui/Switch";
import { errorCode } from "@/lib/patient/record";

/** Pieces every add and edit form shares. */

/** What a form needs from its screen: its id, and what to call while saving and once saved. */
export type FormControl = {
  formId: string;
  onSaving: (busy: boolean) => void;
  /** After a successful save: leaves for `href`, replacing the form in the history. */
  onSaved: (href: string) => void;
};

/**
 * The one way a screen with a form saves and leaves (every add and edit form).
 *
 * Next.js keeps a screen alive and hidden after you leave it, with its React
 * state, so a form left after a save would come back holding the old values
 * and a spinning Save. After a successful save this screen leaves with
 * `router.replace` (browser Back does not return to the filled form), and as
 * it hides it clears the busy flag and gives the form a new key, so the next
 * visit starts from the saved data, or empty for a new item. A form left
 * without saving keeps its draft.
 *
 * Use `key={formKey}` on the form (plus the saved row's `updated_at` on an
 * edit form, so it re-seeds when the row is read again), `busy` on the
 * SaveButton and spread `control` into the form.
 */
export function useFormScreen() {
  const formId = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const saved = useRef(false);
  useLayoutEffect(
    () => () => {
      // Runs when Next.js hides this screen (and on unmount).
      if (!saved.current) return;
      saved.current = false;
      setBusy(false);
      setRound((r) => r + 1);
    },
    [],
  );
  const onSaved = useCallback(
    (href: string) => {
      saved.current = true;
      router.replace(href);
    },
    [router],
  );
  const control: FormControl = { formId, onSaving: setBusy, onSaved };
  return { formId, busy, formKey: String(round), control };
}

/** Words for a save that failed: the database's refusal, or the connection. */
export function saveFailedMessage(error: unknown): string {
  const code = errorCode(error);
  if (!code || /fetch|network|load failed/i.test(code)) return SAVE_FAILED;
  if (code === "not_signed_in") return "You've been signed out. Sign in again to save this.";
  if (code === "quota_exceeded" || code === "storage_full") return "There's no room left for this.";
  return "This couldn't be saved. Check what you entered and try again.";
}

export type FieldErrors = Record<string, string | undefined>;

/** Focuses the first field with an error, by id. Returns true when there are none. */
export function checkErrors(errors: FieldErrors, ids: Record<string, string>): boolean {
  const first = Object.keys(errors).find((k) => errors[k]);
  if (!first) return true;
  document.getElementById(ids[first] ?? first)?.focus();
  return false;
}

/** The "About mental health" switch (PLAN.md section 8). */
export function MentalHealthSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <SwitchRow
      surface="tile"
      title="About mental health"
      description="Kept out of every share unless you include mental health for that share."
      checked={checked}
      onCheckedChange={onChange}
    />
  );
}

/** A <form> with a save error line and the submit button at the bottom of the screen. */
export function FormFrame({
  id,
  onSubmit,
  error,
  children,
}: {
  id: string;
  onSubmit: (e: FormEvent) => void;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <form id={id} onSubmit={onSubmit} noValidate className="flex flex-col gap-5 px-5 pb-8 pt-2">
      {children}
      {error && (
        <Notice tone="critical" live="assertive">
          {error}
        </Notice>
      )}
    </form>
  );
}

export function SaveButton({ form, busy, children = "Save" }: { form: string; busy: boolean; children?: ReactNode }) {
  return (
    <Button type="submit" form={form} size="lg" fullWidth loading={busy}>
      {children}
    </Button>
  );
}

export const SAVE_FAILED = "This couldn't be saved. Check your connection and try again.";

/**
 * A "Delete" button that opens a confirm sheet. `onConfirm` returns false if
 * the delete failed, and the sheet says so.
 */
export function DeleteWithConfirm({
  label,
  title,
  body,
  onConfirm,
}: {
  /** The button's text, e.g. "Delete entry". */
  label: string;
  title: string;
  body: ReactNode;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button variant="destructive" size="md" onClick={() => setOpen(true)} className="w-fit">
        {label}
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        actions={
          <>
            <Button
              size="lg"
              fullWidth
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setFailed(false);
                const ok = await onConfirm();
                setBusy(false);
                // Closed on success, so going back to this screen does not reopen it.
                if (ok) setOpen(false);
                else setFailed(true);
              }}
            >
              {label}
            </Button>
            <Button variant="text" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">{body}</p>
        {failed && (
          <Notice tone="critical" live="assertive">
            This couldn&apos;t be deleted. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
    </>
  );
}
