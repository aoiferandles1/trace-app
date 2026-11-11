import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons (BRIEF.md section 3.7, boards ApproveA2, SessionA2, PortalEntryB).
 *
 * Variants:
 * - primary: accent fill, white 600 text. One per screen.
 * - secondary: 1px border-control outline on surface, accent text (the
 *   portal's "End session" on PortalRecordE).
 * - text: accent 600 text, no border, 44px tall ("Deny", "Add a condition").
 * - destructive: a text button in the critical colour ("Disconnect", "Delete").
 *
 * Tones change the colours for the surface underneath:
 * - "session" (session indigo): primary is a white fill with ink text
 *   ("End sharing now"), text and secondary become white underlined links
 *   ("Regenerate", "Cancel request").
 * - "onAccent" (inside an accent card, Home's today card): white fill with
 *   accent text ("Share record").
 *
 * Sizes: xl 56px with radius 18 (ShareA2's "Create share code"), lg 52px
 * (the phone's main action, a pill), md 44px phone / 40px
 * portal, sm 36px (dense portal actions, with a 44px tap area). The radius
 * follows the context: a pill on the phone, 12px inside `.desk`.
 *
 * Use <Button> for actions and <ButtonLink> for navigation; both share styles.
 */

export type ButtonVariant = "primary" | "secondary" | "text" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "xl";
export type ButtonTone = "default" | "session" | "onAccent";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none " +
  "transition-colors duration-150 ease-out disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const boxed: Record<ButtonSize, string> = {
  // ShareA2's "Create share code": 56px, radius 18 (the segmented control's radius).
  xl: "h-14 rounded-control px-6 text-row",
  lg: "h-(--h-button-lg) rounded-button px-6 text-row",
  md: "h-(--h-button-md) rounded-button px-5 text-label",
  sm: "hit-area h-(--h-button-sm) rounded-button px-4 text-caption",
};

const textSizes: Record<ButtonSize, string> = {
  xl: "h-11 text-row",
  lg: "h-11 text-row",
  md: "h-11 text-label",
  sm: "hit-area h-9 text-caption",
};

function variantClasses(variant: ButtonVariant, tone: ButtonTone): string {
  if (variant === "primary") {
    if (tone === "session")
      return "bg-white text-ink hovered:bg-ground pressed:bg-border-row disabled:bg-on-session-border disabled:text-on-session-2";
    if (tone === "onAccent")
      return "bg-white text-accent hovered:bg-ground pressed:bg-ground pressed:text-accent-alt disabled:text-ink-2";
    return (
      "bg-accent text-white hovered:bg-accent-alt pressed:bg-accent-alt " +
      "disabled:bg-border-control disabled:text-ink-2 aria-disabled:bg-border-control aria-disabled:text-ink-2"
    );
  }
  if (tone === "session" && (variant === "secondary" || variant === "text"))
    return "bg-transparent text-white underline underline-offset-2 hovered:decoration-2 disabled:text-on-session-2";
  if (variant === "secondary")
    return "border border-border-control bg-surface text-accent hovered:bg-ground pressed:border-accent pressed:bg-ground pressed:text-accent-alt disabled:text-ink-2";
  if (variant === "destructive") return "bg-transparent text-critical hovered:underline disabled:text-ink-2";
  return "bg-transparent text-accent hovered:text-accent-alt hovered:underline disabled:text-ink-2";
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  tone = "default",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  const isText = variant === "text" || variant === "destructive" || (tone === "session" && variant === "secondary");
  return cn(
    base,
    isText ? textSizes[size] : boxed[size],
    variantClasses(variant, tone),
    fullWidth && "w-full",
    className,
  );
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  fullWidth?: boolean;
  /** Icon before the label (an <Icon />; decorative). */
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
  tone,
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
      className={buttonClasses({ variant, size, tone, fullWidth, className })}
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
  tone,
  fullWidth,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, tone, fullWidth, className })} {...rest}>
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
