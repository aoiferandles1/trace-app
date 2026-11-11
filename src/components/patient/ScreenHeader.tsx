import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton, IconLink } from "@/components/ui/IconButton";

/**
 * Top bar for patient screens, from Figma "Header (mobile)" (49:883).
 *
 * - `variant="title"` (default): centred 20px title ("Record", "My profile"),
 *   optional back button on the left and an action on the right.
 * - `variant="greeting"`: left-aligned title with a small caps line under it
 *   ("Good morning, Jane" / "WEDNESDAY · 14 JAN 2026"), as on Home.
 *
 * The title is the page's <h1>. No fake iOS status bar above it.
 * The notification bell in Figma is out of scope (PLAN.md section 11).
 */

export type ScreenHeaderProps = {
  title: ReactNode;
  variant?: "title" | "greeting";
  subtitle?: ReactNode;
  /** Back link. Pass `backHref` for navigation or `onBack` for in-page steps. */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Right-hand slot, e.g. an IconButton or a small Button. */
  action?: ReactNode;
  /** "onDark" on the full-bleed indigo screens (white back arrow). */
  tone?: "default" | "onDark";
  className?: string;
};

export function ScreenHeader({
  title,
  variant = "title",
  subtitle,
  backHref,
  onBack,
  backLabel = "Back",
  action,
  tone = "default",
  className,
}: ScreenHeaderProps) {
  const back = backHref ? (
    <IconLink href={backHref} label={backLabel} icon={<ChevronLeft />} tone={tone} className="-ml-2.5" />
  ) : onBack ? (
    <IconButton onClick={onBack} label={backLabel} icon={<ChevronLeft />} tone={tone} className="-ml-2.5" />
  ) : null;

  if (variant === "greeting") {
    return (
      <header className={cn("flex items-center gap-3 px-4 pb-2 pt-4", className)}>
        {back}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5">
          <h1 className="truncate text-h3 font-medium">{title}</h1>
          {subtitle && <p className="text-body-tiny uppercase text-text-tertiary">{subtitle}</p>}
        </div>
        {action}
      </header>
    );
  }

  return (
    <header className={cn("grid min-h-14 grid-cols-[44px_1fr_44px] items-center gap-2 px-4 py-2", className)}>
      <div className="flex">{back}</div>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-h3 font-medium">{title}</h1>
        {subtitle && <p className="truncate text-body-tiny text-text-tertiary">{subtitle}</p>}
      </div>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
