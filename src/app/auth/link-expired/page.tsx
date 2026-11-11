import type { Metadata } from "next";
import { PatientShell } from "@/components/layout/PatientShell";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Link expired" };

/** Where a used or expired email link lands (no Figma frame). */
export default function LinkExpiredPage() {
  return (
    <PatientShell>
      <div className="flex flex-1 flex-col justify-center gap-5 px-5 py-12">
        <h1 className="font-display text-title font-light">That link didn&apos;t work.</h1>
        <p className="text-body text-ink-2">
          Sign-in links work once, for a short time, and only on the device that asked for them. Ask for a new one.
        </p>
        <ButtonLink href="/login" size="lg" fullWidth>
          Sign in
        </ButtonLink>
        <ButtonLink href="/" variant="text" className="self-center">
          Back to Trace
        </ButtonLink>
      </div>
    </PatientShell>
  );
}
