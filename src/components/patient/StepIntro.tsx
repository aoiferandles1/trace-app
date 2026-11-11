import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * The top of each sign-up step (p-create to p-profiles): a small eyebrow
 * ("About You"), the step's question as the page's <h1> (DM Sans Bold 28),
 * and a short line under it.
 */
export function StepIntro({
  eyebrow,
  tone = "indigo",
  title,
  children,
  className,
}: {
  eyebrow: string;
  tone?: "indigo" | "teal" | "red";
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <Eyebrow tone={tone} size="sm" className="mt-6">
        {eyebrow}
      </Eyebrow>
      <h1 className="text-h2 font-bold">{title}</h1>
      {children && <p className="text-body-sm text-text-tertiary">{children}</p>}
    </div>
  );
}
