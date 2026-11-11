"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, Field, fieldIds } from "./Field";

/**
 * Digit code entry, from Figma "Session Code Box" (38:273). Two uses:
 * - the portal's 4-digit share code (`length={4}`)
 * - the sign-in email code (`length={6}`; Supabase codes are 6 digits, PLAN.md section 6)
 *
 * It is ONE real <input> (numeric keyboard, paste, autofill of one-time codes,
 * a single field for screen readers) laid over boxes that only draw the digits.
 *
 * States: empty, filled, active (focused, next digit), error, disabled.
 * Pass `error` as words; the boxes also turn red.
 */

export type CodeInputProps = {
  length: 4 | 6;
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void;
  label: ReactNode;
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  name?: string;
  id?: string;
  /** Defaults to "one-time-code" for 6 digits (email codes) and "off" for 4. */
  autoComplete?: string;
  /** Pin the focused look for the /kit page. */
  forceFocus?: boolean;
  className?: string;
};

export function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  label,
  labelHidden,
  hint,
  error,
  disabled = false,
  autoFocus,
  name,
  id: idProp,
  autoComplete,
  forceFocus = false,
  className,
}: CodeInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ids = fieldIds(id);
  const [focused, setFocused] = useState(false);
  const showFocus = (focused || forceFocus) && !disabled;
  const activeIndex = Math.min(value.length, length - 1);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  return (
    <Field
      id={id}
      label={label}
      labelHidden={labelHidden}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="relative">
        <div aria-hidden="true" className={cn("flex", length === 4 ? "gap-3" : "gap-2")}>
          {Array.from({ length }, (_, i) => {
            const digit = value[i] ?? "";
            const isActive = showFocus && i === activeIndex;
            return (
              <div
                key={i}
                className={cn(
                  "flex aspect-square max-w-20 min-w-0 flex-1 items-center justify-center rounded-card border",
                  "font-display text-display-sm font-light text-text-primary shadow-sm transition-colors duration-100",
                  disabled
                    ? "border-border-default bg-neutral-100 text-interactive-disabled-text"
                    : error
                      ? "border-2 border-status-danger bg-status-danger-tint"
                      : isActive
                        ? "border-2 border-brand-indigo bg-brand-indigo-tint outline-2 outline-offset-2 outline-[var(--focus-ring)]"
                        : digit
                          ? "border-brand-indigo-tint bg-brand-indigo-tint"
                          : "border-border-control bg-surface-sunken",
                )}
              >
                {digit}
              </div>
            );
          })}
        </div>
        <input
          id={ids.control}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoComplete ?? (length === 6 ? "one-time-code" : "off")}
          maxLength={length}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={describedBy(id, hint, error)}
          aria-invalid={error ? true : undefined}
          spellCheck={false}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
        />
      </div>
    </Field>
  );
}
