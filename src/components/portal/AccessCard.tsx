import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Pieces of the portal's code, waiting and ended steps (boards PortalEntryB
 * and PortalWaitB). Phase 7 lays these screens out to the boards; these
 * pieces already wear the new look.
 */

/**
 * A page title block: Sora 300 at 44px with an optional line under it. On
 * light pages the line is ink-2; inside `.on-session` pass tone="session".
 */
export function PortalHero({
  title,
  subtitle,
  tone = "default",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: "default" | "session";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5 px-5 pt-8 sm:px-14", className)}>
      <h1 className="max-w-[20ch] font-display text-display font-light">{title}</h1>
      {subtitle && (
        <p className={cn("max-w-[52ch] text-body-lg", tone === "session" ? "text-on-session-2" : "text-ink-2")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

const eyebrowTone = {
  default: "text-ink-2",
  critical: "text-critical",
  urgent: "text-urgent",
} as const;

export type AccessCardTone = keyof typeof eyebrowTone;

/**
 * A step's content block (code entry, error, expired, ended): a small 600
 * line, a Sora 300 heading, a line of body text, then the controls. Flat on
 * the page: no card fill, no shadow.
 *
 * `headingRef` lets a screen move focus to the heading when the state
 * changes, so screen reader users hear the new state.
 */
export function AccessCard({
  eyebrow,
  tone = "default",
  title,
  body,
  children,
  headingRef,
  surface = "default",
  className,
}: {
  eyebrow: string;
  tone?: AccessCardTone;
  /** "session" on session indigo (the waiting screen): white text. */
  surface?: "default" | "session";
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  return (
    <section className={cn("flex w-full max-w-[520px] flex-col gap-5", surface === "session" ? "text-white" : "text-ink", className)}>
      <p className={cn("text-caption font-semibold", surface === "session" ? "text-white" : eyebrowTone[tone])}>{eyebrow}</p>
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-title font-light focus:outline-none">
        {title}
      </h2>
      {body && <div className={cn("text-body-lg", surface === "session" ? "text-on-session-2" : "text-ink-2")}>{body}</div>}
      {children}
    </section>
  );
}

/**
 * Steps with a state each (PortalWaitB "Code accepted / Waiting for
 * approval / Open record"): 76px rows between hairlines. Done is a filled
 * disc with a tick, current a ring with 600 text, to do a faint ring in
 * dimmed text. No pulse. Screen readers hear "done", "in progress" or
 * "not yet".
 */
export type Step = { label: string; state: "done" | "current" | "todo" };

export function StepList({
  steps,
  tone = "session",
  className,
}: {
  steps: Step[];
  /** "session" on session indigo (the board); "default" on a light page. */
  tone?: "session" | "default";
  className?: string;
}) {
  const s = tone === "session";
  return (
    <ol className={cn("flex flex-col border-b", s ? "border-on-session-border" : "border-border-card", className)}>
      {steps.map((step) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn(
            "flex min-h-19 items-center gap-4 border-t text-row",
            s ? "border-on-session-border" : "border-border-card",
            step.state === "current" && "font-semibold",
            step.state === "todo" && (s ? "text-on-session-2" : "text-ink-2"),
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              step.state === "done" && (s ? "bg-white text-session" : "bg-accent text-white"),
              step.state === "current" && (s ? "border-2 border-white" : "border-2 border-accent"),
              step.state === "todo" && (s ? "border-2 border-on-session-ring" : "border-2 border-ring-off"),
            )}
          >
            {step.state === "done" && <Icon name="tick" size={14} strokeWidth={3.5} />}
          </span>
          <span>
            {step.label}
            <span className="sr-only">
              {step.state === "done" ? " (done)" : step.state === "current" ? " (in progress)" : " (not yet)"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
