import type { ReactNode } from "react";
import { PageState, type StateAction } from "@/components/ui/StateMessage";
import { cn } from "@/lib/cn";

/**
 * A whole page that is only a state (BRIEF.md section 7: 404, offline,
 * session expired, permission denied): on ground, the "trace" wordmark at
 * the top left, then a centred Sora title, one line and one text button. No
 * illustration. Used by the not-found and error pages of both apps.
 */
export function StatePage({
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
    <div className={cn("flex min-h-dvh flex-col bg-ground text-ink", className)}>
      <p className="px-5 pt-4 font-display text-wordmark font-light lg:px-10 lg:pt-7">trace</p>
      <main id="main" className="flex flex-1 flex-col items-center justify-center pb-16">
        <PageState title={title} message={message} action={action} />
      </main>
    </div>
  );
}
