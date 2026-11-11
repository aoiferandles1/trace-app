import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons, from Figma "Button" (Design System 21:89).
 *
 * - primary: filled Indigo/Accessible, white text. One per screen.
 * - secondary: white with an indigo outline. Equal-weight pairs (Allow / Deny).
 * - tertiary: white fill for indigo or photographic surfaces ("Share your record now").
 * - ghost: text-only, for inline actions like "Didn't get it? Resend code".
 * - ghostOnDark: text-only in white, on the indigo screens ("Regenerate").
 *
 * Sizes: sm 32px (dense desktop), md 40px, lg 48px (mobile primary CTA).
 * sm and md keep their look but get a 44px tall tap target.
 *
 * Use <Button> for actions and <ButtonLink> for navigation; both share styles.
 */

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "ghostOnDark";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap " +
  "transition-colors duration-150 select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-4 text-button-sm hit-area",
  md: "h-10 px-5 text-button-md hit-area",
  lg: "h-12 px-6 text-button-lg",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-interactive-primary text-text-on-accent hovered:bg-interactive-primary-hover pressed:bg-interactive-primary-press " +
    "disabled:bg-interactive-disabled-bg disabled:text-interactive-disabled-text " +
    "aria-disabled:bg-interactive-disabled-bg aria-disabled:text-interactive-disabled-text",
  secondary:
    "bg-surface-card text-indigo-text border border-brand-indigo hovered:bg-brand-indigo-tint pressed:bg-indigo-100 " +
    "disabled:border-interactive-disabled-bg disabled:text-interactive-disabled-text " +
    "aria-disabled:border-interactive-disabled-bg aria-disabled:text-interactive-disabled-text",
  tertiary:
    "bg-white text-indigo-700 hovered:bg-indigo-50 pressed:bg-indigo-100 " +
    "disabled:bg-white/40 disabled:text-white aria-disabled:bg-white/40 aria-disabled:text-white",
  ghost:
    "bg-transparent text-indigo-text hovered:bg-brand-indigo-tint pressed:bg-indigo-100 " +
    "disabled:text-interactive-disabled-text aria-disabled:text-interactive-disabled-text",
  ghostOnDark:
    "bg-transparent text-white hovered:bg-white/10 pressed:bg-white/20 disabled:text-white/60 aria-disabled:text-white/60",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(base, sizes[size], variants[variant], fullWidth && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Icon before the label. Decorative: give it aria-hidden (lucide icons do this by default). */
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export type ButtonProps = CommonProps &
  ComponentProps<"button"> & {
    /** Shows a spinner, sets aria-busy and blocks clicks. The label stays for screen readers. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  fullWidth,
  iconLeft,
  iconRight,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}

export type ButtonLinkProps = CommonProps & ComponentProps<typeof Link>;

/** A link that looks like a button. Use for navigation (it renders <a>). */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
