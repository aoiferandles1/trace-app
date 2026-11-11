import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The top of each sign-up step: one question per screen (BRIEF.md section
 * 7). A short ink-2 line naming the part ("About you"), the question as the
 * page's <h1> in Sora 300, and an optional line under it. No eyebrow dots.
 */
export function StepIntro({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 pt-4", className)}>
      <p className="text-caption font-medium text-ink-2">{eyebrow}</p>
      <h1 className="font-display text-title font-light">{title}</h1>
      {children && <p className="text-body text-ink-2">{children}</p>}
    </div>
  );
}
