import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/layout/PortalShell";
import { CASE_STUDY_URL, PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";

export const metadata: Metadata = { title: "About the portal" };

/**
 * /view/about: where the code step's footer links go ("Privacy and
 * security", "For your practice"). No board: the entry screen's frame, a
 * Sora title and plain rows. The words were rewritten in the review fixes
 * (docs/REVIEW.md 1.6). Static, no patient data.
 */

const PRACTICE: Array<[string, string]> = [
  [
    "Your patient sees your details",
    "The name, role and practice you type show on your patient's phone when you ask for access. Trace does not check them, so your patient decides whether to allow it.",
  ],
  [
    "Kept in this browser",
    "Your details stay in this browser, so you type them once. Each share also keeps them in your patient's share history.",
  ],
];

const PRIVACY: Array<[string, string]> = [
  [
    "The patient decides",
    "They choose what you see and for how long, and can end the session at any time. Nothing opens until they allow it.",
  ],
  ["Read only", "You cannot change the record. It closes when the session ends."],
  [
    "Every view is logged",
    "Your patient's share history lists each doctor who opened their record and the parts they looked at.",
  ],
  [
    "Encrypted in transit and at rest",
    "Connections and stored data are encrypted. This is not end-to-end encryption. A share code works once and expires after 5 minutes if it is not used.",
  ],
];

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <ul className="flex flex-col border-b border-border-card">
      {rows.map(([title, body]) => (
        <li key={title} className="flex flex-col gap-0.5 border-t border-border-card py-4">
          <h3 className="text-row font-medium">{title}</h3>
          <p className="text-caption text-ink-2">{body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function PortalAboutPage() {
  return (
    <PortalShell tone="ground" header={<PortalHeader />} footer={<PortalFooter />}>
      <div className="flex w-full max-w-170 flex-col gap-12 px-5 py-10 sm:px-14 xl:pl-40 xl:pr-0">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-display font-light">About the portal</h1>
          <p className="text-body-lg text-ink-2">
            Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
            <Link href={CASE_STUDY_URL} className="font-semibold text-accent hovered:underline">
              Read the case study
            </Link>{" "}
            or the{" "}
            <Link href="/terms" className="font-semibold text-accent hovered:underline">
              terms
            </Link>
            .
          </p>
        </div>
        <section id="practice" aria-labelledby="practice-title" className="flex scroll-mt-6 flex-col gap-3">
          <h2 id="practice-title" className="font-display text-heading font-light">
            For your practice
          </h2>
          <p className="text-body text-ink-2">There is nothing to set up.</p>
          <Rows rows={PRACTICE} />
        </section>
        <section id="privacy" aria-labelledby="privacy-title" className="flex scroll-mt-6 flex-col gap-3">
          <h2 id="privacy-title" className="font-display text-heading font-light">
            Privacy and security
          </h2>
          <Rows rows={PRIVACY} />
        </section>
        <Link href="/view" className="flex min-h-11 w-fit items-center text-label font-semibold text-accent hovered:underline">
          Back to the portal
        </Link>
      </div>
    </PortalShell>
  );
}
