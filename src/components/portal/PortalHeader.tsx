import { UserRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Clinician portal top bar, from Figma "Header / Desktop" (488:3460):
 * "trace" wordmark, a divider, "Clinical Access Portal", and on the right the
 * name, role and practice the doctor typed (not verified, so no badge).
 *
 * Accessibility substitution: the wordmark is Indigo/Text (#4258CB) instead
 * of Brand/Indigo (#5B7AE8, 3.9:1 at 20px medium).
 */
export function PortalHeader({
  clinician,
  className,
}: {
  /** Omit before the doctor has entered their details (the name step). */
  clinician?: { name: string; role?: string; practice?: string };
  className?: string;
}) {
  const subline = [clinician?.role, clinician?.practice].filter(Boolean).join(" · ");
  return (
    <header
      className={cn(
        "flex min-h-[76px] items-center justify-between gap-4 border-b border-border-default bg-surface-card px-4 sm:px-8",
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <Link href="/view" className="rounded-xs text-h3 font-medium text-indigo-text">
          trace
          <span className="sr-only"> clinical access portal home</span>
        </Link>
        <span aria-hidden="true" className={cn("h-6 w-px bg-border-default", clinician && "hidden sm:block")} />
        <span className={cn("text-label font-medium text-text-tertiary", clinician && "hidden sm:inline")}>
          Clinical Access Portal
        </span>
      </div>
      {clinician && (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-brand-indigo-tint text-brand-indigo"
          >
            <UserRound className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-text-primary">{clinician.name}</p>
            {subline && <p className="truncate text-label tracking-normal text-text-tertiary">{subline}</p>}
          </div>
        </div>
      )}
    </header>
  );
}
