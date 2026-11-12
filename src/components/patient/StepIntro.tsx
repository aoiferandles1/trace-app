import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The top of each sign-up step: one question per screen (BRIEF.md section
 * 7). The question as the page's <h1> in Sora 300 and an optional line
 * under it. Sign-up steps have "Step 3 of 7" above, so they pass no
 * `eyebrow`; sign in names itself with one ("Sign in").
 */
export function StepIntro({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 pt-4", className)}>
      {eyebrow && <p className="text-caption font-medium text-ink-2">{eyebrow}</p>}
      <h1 className="font-display text-title font-light">{title}</h1>
      {children && <p className="text-body text-ink-2">{children}</p>}
    </div>
  );
}
