import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "./Button";

/**
 * Empty and error states (BRIEF.md section 3.13 and section 7): one line of
 * ink-2 text and one text-button action. No illustration.
 *
 * - StateMessage: inside a screen ("No current medications." / "Add a
 *   medication"). `tone="error"` makes it an alert, for a load that failed.
 * - PageState: a whole page (404, session expired, permission denied): a
 *   centred Sora title, one line, one text button.
 *
 * The action is a link (`href`) or a button (`onClick`).
 */

export type StateAction = { label: string; href?: string; onClick?: () => void };

function Action({ action, tone }: { action: StateAction; tone: "default" | "session" }) {
  return action.href ? (
    <ButtonLink href={action.href} variant="text" tone={tone}>
      {action.label}
    </ButtonLink>
  ) : (
    <Button variant="text" tone={tone} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function StateMessage({
  message,
  action,
  tone = "empty",
  surface = "default",
  align = "start",
  className,
}: {
  message: ReactNode;
  action?: StateAction;
  tone?: "empty" | "error";
  /** "session" on session indigo. */
  surface?: "default" | "session";
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex flex-col", align === "center" ? "items-center text-center" : "items-start", className)}
    >
      <p className={cn("text-body", surface === "session" ? "text-on-session-2" : "text-ink-2")}>{message}</p>
      {action && <Action action={action} tone={surface === "session" ? "session" : "default"} />}
    </div>
  );
}

export function PageState({
  title,
  message,
  action,
  className,
}: {
  title: ReactNode;
  message: ReactNode;
  action?: StateAction;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-5 py-16 text-center", className)}>
      <h1 className="font-display text-title font-light">{title}</h1>
      <p className="max-w-sm text-body text-ink-2">{message}</p>
      {action && <Action action={action} tone="default" />}
    </div>
  );
}
