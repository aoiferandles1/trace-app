"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds, type FieldLabelStyle } from "./Field";

/**
 * Single-line text input, from Figma "Input" (33:235): 50px tall, 14px radius,
 * 2px indigo border on focus, red border and a red message on error.
 *
 * Always pass a visible `label`. Pass `error` as words ("Enter a date like
 * 12/03/1991"), never only a red border. Native input props (type,
 * autoComplete, inputMode, required, value, onChange...) pass through.
 */

export const controlBase =
  "w-full rounded-card-tight border bg-surface-card text-body-lg text-text-primary " +
  "placeholder:text-text-tertiary transition-colors duration-150 " +
  "focus:outline-none focus:border-brand-indigo focus:shadow-[inset_0_0_0_1px_var(--brand-indigo)] " +
  "data-[force~=focus]:border-brand-indigo data-[force~=focus]:shadow-[inset_0_0_0_1px_var(--brand-indigo)] data-[force~=focus]:outline-none " +
  "disabled:cursor-not-allowed disabled:border-border-default disabled:bg-neutral-100 disabled:text-interactive-disabled-text";

export const controlBorder = (invalid: boolean) =>
  invalid
    ? "border-status-danger shadow-[inset_0_0_0_1px_var(--status-danger)]"
    : "border-border-control";

export type TextFieldProps = Omit<ComponentProps<"input">, "size"> & {
  label: ReactNode;
  labelStyle?: FieldLabelStyle;
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Icon or text inside the field, on the left. Decorative. */
  leading?: ReactNode;
  /** Icon or short text inside the field, on the right. */
  trailing?: ReactNode;
  /** Classes for the wrapper (layout only). */
  className?: string;
  /** Classes for the <input> itself. */
  inputClassName?: string;
};

export function TextField({
  id: idProp,
  label,
  labelStyle,
  labelHidden,
  hint,
  error,
  optional,
  leading,
  trailing,
  className,
  inputClassName,
  required,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ids = fieldIds(id);
  return (
    <Field
      id={id}
      label={label}
      labelStyle={labelStyle}
      labelHidden={labelHidden}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-tertiary">
            {leading}
          </span>
        )}
        <input
          id={ids.control}
          aria-describedby={describedBy(id, hint, error)}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(
            controlBase,
            controlBorder(Boolean(error)),
            "h-[50px] px-4",
            Boolean(leading) && "pl-11",
            Boolean(trailing) && "pr-12",
            inputClassName,
          )}
          {...inputProps}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-3 flex items-center text-text-tertiary">
            {trailing}
          </span>
        )}
      </div>
    </Field>
  );
}
