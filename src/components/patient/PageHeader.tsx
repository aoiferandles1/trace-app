import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton, IconLink } from "@/components/ui/IconButton";

/**
 * Phone page header (BRIEF.md section 3.1, boards RecordA2, MedsA2,
 * FamilyA2, MedDetailA2): 56px high, the title in Sora 300 on the left.
 * Detail screens add a 32px back arrow at the page edge (-6px optical
 * offset, 44px tap target) before the title.
 *
 * - `size="lg"` (default): 28/34, the main screens and most details
 *   ("Record", "Timeline", "Concerta").
 * - `size="md"`: 24/30 ("Family history", "Insurance", "Share your record").
 * - `variant="greeting"` (MainA2): 48px, a caption line above a 22px name
 *   ("Good afternoon" / "Jane", one h1), with `action` on the right (the
 *   avatar).
 * - `subtitle`: a caption under the title.
 * - `tone="session"` on session indigo: white back arrow and text.
 *
 * The title is the page's <h1>. It sits inside the page's 20px gutter.
 */

export type PageHeaderProps = {
  title: ReactNode;
  variant?: "title" | "greeting";
  size?: "lg" | "md";
  /** Greeting: the caption above the name. Title: a caption under the title. */
  subtitle?: ReactNode;
  /** Back link. Pass `backHref` for navigation or `onBack` for in-page steps. */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Right-hand slot: an avatar, an IconButton or a small Button. */
  action?: ReactNode;
  tone?: "default" | "session";
  /** 56 (default) or 48 (RecordA2's title row). */
  height?: 48 | 56;
  className?: string;
};

export function PageHeader({
  title,
  variant = "title",
  size = "lg",
  subtitle,
  backHref,
  onBack,
  backLabel = "Back",
  action,
  tone = "default",
  height = 56,
  className,
}: PageHeaderProps) {
  const iconTone = tone === "session" ? "session" : "default";
  const back = backHref ? (
    <IconLink href={backHref} label={backLabel} icon="chevron-left" size={32} tone={iconTone} className="-ml-1.5" />
  ) : onBack ? (
    <IconButton onClick={onBack} label={backLabel} icon="chevron-left" size={32} tone={iconTone} className="-ml-1.5" />
  ) : null;

  if (variant === "greeting") {
    return (
      <header className={cn("flex h-12 shrink-0 items-center justify-between gap-3 px-5", className)}>
        {/* One heading, read as "Good afternoon, Jane". */}
        <h1 className="flex min-w-0 flex-col">
          <span className="sr-only">{subtitle ? <>{subtitle}, {title}</> : title}</span>
          {subtitle && (
            <span aria-hidden="true" className={cn("text-caption", tone === "session" ? "text-on-session-2" : "text-ink-2")}>
              {subtitle}
            </span>
          )}
          <span aria-hidden="true" className="truncate font-display text-numeral font-light">
            {title}
          </span>
        </h1>
        {action}
      </header>
    );
  }

  return (
    <header className={cn("flex shrink-0 items-center gap-3 px-5", height === 48 ? "min-h-12" : "min-h-14", className)}>
      {back}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className={cn("font-display font-light", size === "lg" ? "text-title" : "text-title-sm")}>{title}</h1>
        {subtitle && (
          <p className={cn("text-body", tone === "session" ? "text-on-session-2" : "text-ink-2")}>{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}
