import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The portal's footer (boards PortalEntryB and PortalWaitB): a quiet row of
 * 13px ink-2 text with accent links, on the page, no bar.
 *
 * Copy differs from the old Figma on purpose (PLAN.md section 11, listed in
 * docs/REVIEW.md): "Encrypted in transit · Access logged", and a line saying
 * Trace is a portfolio project, not a medical service, linking to the case
 * study.
 */

export const CASE_STUDY_URL = "https://aoiferandles.com/trace/";

export function PortalFooter({ tone = "default", className }: { tone?: "default" | "session"; className?: string }) {
  const session = tone === "session";
  const link = cn("font-medium", session ? "text-white underline underline-offset-2" : "text-accent hovered:underline");
  return (
    <footer
      className={cn(
        "flex flex-col gap-2 px-5 py-5 text-meta sm:px-14 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-0",
        session ? "text-on-session-2" : "text-ink-2",
        className,
      )}
    >
      <p>
        A portfolio project by Aoife Randles, not a medical service.{" "}
        <Link href={CASE_STUDY_URL} className={link}>
          Read the case study
        </Link>
        {" · "}
        <Link href="/terms" className={link}>
          Terms
        </Link>
      </p>
      <p>Encrypted in transit · Access logged</p>
    </footer>
  );
}
