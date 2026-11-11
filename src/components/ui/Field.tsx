import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Label, hint and error around a form control (BRIEF.md section 7): a
 * visible 14px 500 label above, the hint in ink-2, and an error in the
 * critical colour with an icon, in words. Used by TextField, TextArea,
 * SelectField and CodeInput; screens rarely need it directly.
 *
 * The control must carry `id={ids.control}` and
 * `aria-describedby={describedBy}` so the hint and error are announced.
 * Errors are words, not only red: always pass a message that says what is wrong.
 */

export function fieldIds(id: string) {
  return { control: id, hint: `${id}-hint`, error: `${id}-error`, label: `${id}-label` };
}

export function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  const ids = fieldIds(id);
  return [error ? ids.error : null, hint ? ids.hint : null].filter(Boolean).join(" ") || undefined;
}

export type FieldProps = {
  id: string;
  label: ReactNode;
  /** Hide the label visually but keep it for screen readers. Avoid unless the design gives no room. */
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Shown after the label as "(optional)". Fields are required unless marked. */
  optional?: boolean;
  children: ReactNode;
  className?: string;
  /** Render the label as a <legend>-free <span> (for grouped controls that label themselves). */
  as?: "label" | "span";
};

export function Field({
  id,
  label,
  labelHidden = false,
  hint,
  error,
  optional = false,
  children,
  className,
  as = "label",
}: FieldProps) {
  const ids = fieldIds(id);
  const LabelTag = as;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <LabelTag
        id={ids.label}
        {...(as === "label" ? { htmlFor: ids.control } : {})}
        className={cn(labelHidden ? "sr-only" : "text-caption font-medium text-ink")}
      >
        {label}
        {optional && <span className="font-normal text-ink-2"> (optional)</span>}
      </LabelTag>
      {children}
      {error && (
        <p id={ids.error} className="flex items-start gap-1.5 text-caption text-critical">
          <Icon name="alert" size={18} className="mt-px" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={ids.hint} className="text-caption text-ink-2">
          {hint}
        </p>
      )}
    </div>
  );
}
