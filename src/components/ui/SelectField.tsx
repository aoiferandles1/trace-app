"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds } from "./Field";
import { Icon } from "./Icon";
import { controlBase, controlBorder } from "./TextField";

/**
 * Dropdown for enumerated choices, styled as a text field (BRIEF.md section 7). It is a
 * native <select> with the chevron drawn on top, so keyboard, screen reader
 * and phone pickers all work without extra code.
 *
 * Pass `placeholder` for an empty first option ("Select a country"); it is
 * selectable only while nothing else is chosen.
 */
export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectFieldProps = Omit<ComponentProps<"select">, "children"> & {
  label: ReactNode;
  labelHidden?: boolean;
  options: SelectOption[];
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
};

export function SelectField({
  id: idProp,
  label,
  labelHidden,
  options,
  placeholder,
  hint,
  error,
  optional,
  className,
  value,
  defaultValue,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ids = fieldIds(id);
  const isEmpty =
    value !== undefined ? value === "" : defaultValue === undefined || defaultValue === "";
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
        <select
          id={ids.control}
          aria-describedby={describedBy(id, hint, error)}
          aria-invalid={error ? true : undefined}
          value={value}
          defaultValue={value === undefined ? (defaultValue ?? (placeholder ? "" : undefined)) : undefined}
          className={cn(
            controlBase,
            controlBorder(Boolean(error)),
            "h-(--h-input) appearance-none pl-4 pr-11",
            isEmpty && placeholder && "text-ink-2",
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled={!optional}>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-2"
        />
      </div>
    </Field>
  );
}
