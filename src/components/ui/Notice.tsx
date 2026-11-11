import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * A one-line message with a bare icon: form errors, "Saved", a note about
 * what a screen does. No background, except where a tint means something
 * (BRIEF.md section 1):
 *
 * - "neutral": ink-2 text, info icon. Plain explanations.
 * - "critical": critical text, alert icon. Errors, always in words.
 * - "urgent": urgent text on urgent-tint, warning icon. Due soon, paused.
 * - "locked": ink-2 text on locked-tint, eye-off icon. What is not shared.
 *
 * On session indigo pass `surface="session"`: the text is white, whatever
 * the tone (no tone colour passes AA there); the icon still says which.
 *
 * For a message that appears after an action (saved, failed), set
 * `live="polite"` (or "assertive" for an error that blocks the user).
 */

const tones = {
  neutral: { box: "text-ink-2", icon: "info" },
  critical: { box: "text-critical", icon: "alert" },
  urgent: { box: "rounded-tile bg-urgent-tint px-3.5 py-3 text-urgent", icon: "warning" },
  locked: { box: "rounded-tile bg-locked-tint px-3.5 py-3 text-ink-2", icon: "eye-off" },
} as const satisfies Record<string, { box: string; icon: IconName }>;

export type NoticeTone = keyof typeof tones;

export function Notice({
  children,
  tone = "neutral",
  icon,
  live,
  surface = "default",
  className,
}: {
  children: ReactNode;
  tone?: NoticeTone;
  /** Replace the tone's icon. Pass null for none. */
  icon?: IconName | null;
  live?: "polite" | "assertive";
  surface?: "default" | "session";
  className?: string;
}) {
  const t = tones[tone];
  const name = icon === undefined ? t.icon : icon;
  return (
    <div
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn("flex items-start gap-2.5 text-caption", surface === "session" ? "text-white" : t.box, className)}
    >
      {name && <Icon name={name} size={18} className="mt-px" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
