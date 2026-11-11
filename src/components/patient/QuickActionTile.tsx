import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Home quick action, from Figma "Quick Action": a 56px tinted icon tile with
 * a 12px label under it. The whole thing is one link.
 *
 * Out-of-scope actions ("Upload doc") are hidden, not shown disabled.
 */

const tones = {
  indigo: "bg-brand-indigo-tint text-brand-indigo",
  teal: "bg-brand-teal-tint text-teal-600",
  peach: "bg-brand-peach-tint text-peach-500",
  neutral: "bg-surface-card text-text-primary",
} as const;

export function QuickActionTile({
  href,
  label,
  icon,
  tone = "indigo",
  className,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group flex min-w-0 flex-col items-center gap-2 rounded-card-tight", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-14 items-center justify-center rounded-card-tight border border-border-default shadow-card transition-transform duration-150 group-hover:-translate-y-0.5 [&_svg]:size-6",
          tones[tone],
        )}
      >
        {icon}
      </span>
      <span className="text-center text-label text-text-tertiary tracking-normal">{label}</span>
    </Link>
  );
}
