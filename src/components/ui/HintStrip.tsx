import { CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Compact inline hint, from Figma "Hint Strip" (135:4749): a tinted 12px
 * radius strip with an icon and 12px medium text. Five tones.
 *
 * Also used for the portal's "Shared for this visit" scope strip (neutral,
 * with bold lead-ins in the children).
 *
 * For a message that appears after an action (saved, failed), set
 * `live="polite"` (or "assertive" for errors that block the user).
 */

const tones = {
  neutral: "bg-surface-sunken text-text-tertiary",
  indigo: "bg-brand-indigo-tint text-indigo-text",
  peach: "bg-brand-peach-tint text-peach-700",
  teal: "bg-brand-teal-tint text-teal-700",
  danger: "bg-status-danger-tint text-red-700",
} as const;

export type HintStripProps = {
  children: ReactNode;
  tone?: keyof typeof tones;
  /** Replace the default icon (info, or alert for danger). Pass null for none. */
  icon?: ReactNode | null;
  live?: "polite" | "assertive";
  className?: string;
};

export function HintStrip({ children, tone = "indigo", icon, live, className }: HintStripProps) {
  const defaultIcon =
    tone === "danger" ? (
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
    ) : (
      <Info aria-hidden="true" className="size-4 shrink-0" />
    );
  return (
    <div
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3.5 py-3 text-label font-medium",
        tones[tone],
        className,
      )}
    >
      {icon === undefined ? defaultIcon : icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
