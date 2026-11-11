import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The portal's top row outside a session (boards PortalEntryB and
 * PortalWaitB): the "trace" wordmark in Sora 300 on the left and, on the
 * right, the name and practice the doctor typed (not verified, so no badge).
 * No header bar and no fill: it sits on the page. 88px tall with 56px sides
 * from 640px.
 */
export function PortalHeader({
  clinician,
  tone = "default",
  className,
}: {
  /** Omit before the doctor has entered their details (the name step). */
  clinician?: { name: string; role?: string; practice?: string };
  /** "session" on the waiting screen's session indigo. */
  tone?: "default" | "session";
  className?: string;
}) {
  const line = [clinician?.name, clinician?.practice].filter(Boolean).join(", ");
  return (
    <header className={cn("flex min-h-22 items-center justify-between gap-4 px-5 sm:px-14", className)}>
      <Link href="/view" className={cn("font-display text-wordmark font-light", tone === "session" ? "text-white" : "text-ink")}>
        trace
        <span className="sr-only"> clinical access portal home</span>
      </Link>
      {clinician && (
        <p className={cn("relative min-w-0 truncate text-caption", tone === "session" ? "text-on-session-2" : "text-ink-2")}>
          {line}
          {clinician.role && <span className="sr-only">, {clinician.role}</span>}
        </p>
      )}
    </header>
  );
}
