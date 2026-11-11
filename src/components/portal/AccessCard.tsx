import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The indigo hero above the portal's entry card, from c-code "HERO ABOVE
 * CARD" (867:58739): a "Clinical Access Portal" pill, a Sora Light headline
 * and one line under it. c-end uses the same hero with its own title.
 */
export function PortalHero({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 pt-10 text-center sm:pt-[60px]", className)}>
      <p className="flex h-7 items-center gap-1.5 rounded-pill border border-white/30 bg-white/10 px-[15px] text-label font-medium tracking-normal text-white">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
        Clinical Access Portal
      </p>
      <h1 className="mt-5 max-w-[22ch] font-display text-[36px] font-light leading-[1.1] tracking-[-0.02em] text-white sm:text-[52px]">
        {title}
      </h1>
      {subtitle && <p className="mt-3 max-w-[440px] text-body-lg text-white">{subtitle}</p>}
    </div>
  );
}

const eyebrowTone = {
  indigo: { dot: "bg-brand-indigo", text: "text-indigo-text" },
  red: { dot: "bg-status-danger", text: "text-red-700" },
  peach: { dot: "bg-brand-peach", text: "text-peach-700" },
  teal: { dot: "bg-brand-teal", text: "text-teal-700" },
  neutral: { dot: "bg-text-tertiary", text: "text-text-tertiary" },
} as const;

export type AccessCardTone = keyof typeof eyebrowTone;

/**
 * The white entry card, from Figma "Doctor Access Card" (867:58736): 420px
 * wide, 36px padding, 28px corners, an eyebrow with a dot, a Sora Light
 * heading, a line of body text, then the card's controls.
 *
 * The heading is the page's main heading after the hero's h1, so it is an h2.
 * `headingRef` lets a screen move focus to it when the state changes, so
 * screen reader users hear the new state ("That code doesn't match.").
 */
export function AccessCard({
  eyebrow,
  tone = "indigo",
  title,
  body,
  children,
  headingRef,
  className,
}: {
  eyebrow: string;
  tone?: AccessCardTone;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const t = eyebrowTone[tone];
  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-[420px] flex-col gap-5 rounded-sheet bg-surface-card p-6 text-text-primary shadow-[0_12px_16px_rgba(0,0,0,0.1)] sm:p-9",
        className,
      )}
    >
      <p className={cn("flex items-center gap-2 text-label font-medium uppercase", t.text)}>
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", t.dot)} />
        {eyebrow}
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-display-sm font-light leading-[1.25] focus:outline-none"
      >
        {title}
      </h2>
      {body && <div className="text-body-lg text-text-tertiary">{body}</div>}
      {children}
    </section>
  );
}

/**
 * A short list of steps with a circle each (c-waiting, c-opening). The
 * circle is decorative; screen readers hear "done" or "in progress".
 */
export type Step = { label: string; state: "done" | "current" | "todo" };

export function StepList({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-body-lg">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              s.state === "done" && "border-brand-teal bg-brand-teal text-white",
              s.state === "current" && "border-2 border-brand-indigo bg-brand-indigo-tint",
              s.state === "todo" && "border-border-default bg-surface-page",
            )}
          >
            {s.state === "done" && <Check className="size-3" strokeWidth={3} />}
            {s.state === "current" && <span className="size-1.5 animate-pulse rounded-full bg-brand-indigo" />}
          </span>
          <span className={s.state === "todo" ? "text-text-tertiary" : "text-text-primary"}>
            {s.label}
            <span className="sr-only">
              {s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : " (not yet)"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
