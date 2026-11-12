"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds } from "./Field";
import { controlBase, controlBorder } from "./TextField";

/**
 * Multi-line text. `density="compact"` is the portal notes panel
 * (PortalRecordE: 72px tall, 14px text, radius 12); the default matches the
 * patient forms (16px text, radius 16).
 */
export type TextAreaProps = ComponentProps<"textarea"> & {
  label: ReactNode;
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  density?: "default" | "compact";
  className?: string;
  textareaClassName?: string;
};

export function TextArea({
  id: idProp,
  label,
  labelHidden,
  hint,
  error,
  optional,
  density = "default",
  className,
  textareaClassName,
  rows = 4,
  ...rest
}: TextAreaProps) {
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
      <textarea
        id={ids.control}
        rows={rows}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          controlBorder(Boolean(error)),
          "block resize-y",
          // Compact is 14px in the portal's desktop notes; below 1024px it stays 16px (the base),
          // because iOS Safari zooms the whole page when a field under 16px takes focus.
          density === "default" ? "min-h-32 px-4 py-3" : "min-h-18 px-3 py-2.5 lg:text-caption",
          textareaClassName,
        )}
        {...rest}
      />
    </Field>
  );
}
