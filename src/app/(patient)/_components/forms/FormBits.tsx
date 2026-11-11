"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { SwitchRow } from "@/components/ui/Switch";

/** Pieces every add and edit form shares. */

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
      surface="sunken"
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
        <HintStrip tone="danger" live="assertive">
          {error}
        </HintStrip>
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
      <Button variant="ghost" size="md" onClick={() => setOpen(true)} className="w-fit">
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
                if (!ok) setFailed(true);
              }}
            >
              {label}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-tertiary">{body}</p>
        {failed && (
          <HintStrip tone="danger" live="assertive">
            This couldn&apos;t be deleted. Check your connection and try again.
          </HintStrip>
        )}
      </BottomSheet>
    </>
  );
}
