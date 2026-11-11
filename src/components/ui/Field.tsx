import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Label, hint and error around a form control. Used by TextField, TextArea,
 * SelectField and CodeInput; screens rarely need it directly.
 *
 * The control must carry `id={ids.control}` and
 * `aria-describedby={describedBy}` so the hint and error are announced.
 * Errors are words, not only red: always pass a message that says what is wrong.
 */

export type FieldLabelStyle = "default" | "eyebrow";

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
  /** "default": 14px ink label (forms). "eyebrow": 12px indigo caps (portal session notes). */
  labelStyle?: FieldLabelStyle;
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
  labelStyle = "default",
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
    <div className={cn("flex flex-col gap-2", className)}>
      <LabelTag
        id={ids.label}
        {...(as === "label" ? { htmlFor: ids.control } : {})}
        className={cn(
          labelHidden && "sr-only",
          labelStyle === "default" && "text-body-sm text-text-primary",
          labelStyle === "eyebrow" && "text-label font-medium uppercase text-indigo-text",
        )}
      >
        {label}
        {optional && <span className="text-text-tertiary"> (optional)</span>}
      </LabelTag>
      {children}
      {error && (
        <p id={ids.error} className="flex items-start gap-1.5 text-body-sm text-red-700">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={ids.hint} className="text-body-sm text-text-tertiary">
          {hint}
        </p>
      )}
    </div>
  );
}
