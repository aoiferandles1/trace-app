"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds } from "./Field";

/**
 * Single-line text input (BRIEF.md section 7): white, 1px border-control,
 * 56px tall with radius 16 on the phone (44px, radius 12 in the portal),
 * 16px text. Focus shows the global 2px ink ring and an accent border; an
 * error turns the border critical and adds a message.
 *
 * Always pass a visible `label`. Pass `error` as words ("Enter a date like
 * 12/03/1991"), never only a red border. Native input props (type,
 * autoComplete, inputMode, required, value, onChange...) pass through.
 */

export const controlBase =
  "w-full rounded-input border bg-surface text-row text-ink placeholder:text-ink-2 " +
  "transition-colors duration-150 ease-out focus:border-accent data-[force~=focus]:border-accent " +
  "disabled:cursor-not-allowed disabled:bg-ground disabled:text-ink-2";

export const controlBorder = (invalid: boolean) => (invalid ? "border-critical" : "border-border-field");

export type TextFieldProps = Omit<ComponentProps<"input">, "size"> & {
  label: ReactNode;
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
      labelHidden={labelHidden}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-2">
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
            "h-(--h-input) px-4",
            Boolean(leading) && "pl-11",
            Boolean(trailing) && "pr-12",
            inputClassName,
          )}
          {...inputProps}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-3 flex items-center text-ink-2">
            {trailing}
          </span>
        )}
      </div>
    </Field>
  );
}
