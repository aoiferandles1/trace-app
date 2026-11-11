import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Clinician portal footer, from Figma "Footer / Desktop" (489:3498): an
 * indigo/700 bar with white 12px text.
 *
 * Copy differs from Figma on purpose (PLAN.md section 11, listed in
 * docs/REVIEW.md): "End-to-end encrypted · Access audited" became
 * "Encrypted in transit · Access logged", the dead Privacy / Data Protection /
 * Accessibility / Support links are gone, and a line says Trace is a
 * portfolio project, not a medical service, linking to the case study.
 */

export const CASE_STUDY_URL = "https://aoiferandles.com/trace/";

export function PortalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "on-dark flex flex-col gap-2 border-t border-border-default bg-indigo-700 px-4 py-3 text-label tracking-normal text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
        className,
      )}
    >
      <p>Trace · Clinical Access Portal</p>
      <p>
        A portfolio project by Aoife Randles, not a medical service.{" "}
        <Link href={CASE_STUDY_URL} className="underline underline-offset-2">
          Read the case study
        </Link>
        {" · "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
      </p>
      <p className="flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="size-4" />
        Encrypted in transit · Access logged
      </p>
    </footer>
  );
}
