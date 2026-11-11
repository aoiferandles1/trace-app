"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds, type FieldLabelStyle } from "./Field";
import { controlBase, controlBorder } from "./TextField";

/**
 * Multi-line text, from Figma "Note Field" (902:1746) and the portal's session
 * notes fields. `density="compact"` is the portal notes panel (12px radius,
 * 14px text); the default matches the patient forms.
 */
export type TextAreaProps = ComponentProps<"textarea"> & {
  label: ReactNode;
  labelStyle?: FieldLabelStyle;
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
  labelStyle,
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
      labelStyle={labelStyle}
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
          density === "default" ? "min-h-[130px] px-4 py-3" : "min-h-24 rounded-md px-3.5 py-3 text-body-sm",
          textareaClassName,
        )}
        {...rest}
      />
    </Field>
  );
}
