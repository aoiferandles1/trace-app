import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/layout/PortalShell";
import { CASE_STUDY_URL, PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";

export const metadata: Metadata = { title: "Privacy and security" };

/**
 * /view/about: where the code step's footer links go ("Privacy and
 * security", "For your practice"). No board: the entry screen's frame, a
 * Sora title and plain rows, with the words the old portal's accordion had
 * (Aoife's, as corrected in docs/REVIEW.md section 4). Static, no patient data.
 */

const PRACTICE: Array<[string, string]> = [
  [
    "Your details appear on the consent screen",
    "Patients see the name, role and practice you type here when they receive your access request. Trace does not check these details, so patients decide who to trust.",
  ],
  [
    "Remembered on this computer",
    "Your details are saved in this browser so you do not have to type them again. Nothing is saved on our side.",
  ],
];

const PRIVACY: Array<[string, string]> = [
  [
    "Patient-controlled access",
    "The patient chooses what you see, for how long, and they can end the session at any point. Nothing is shared without their explicit approval.",
  ],
  ["Read-only throughout", "You cannot edit any part of the record. The view closes when the session ends."],
  [
    "Every view is logged",
    "All access is consent-based, session-scoped and logged. The patient has a complete log of every clinician who has accessed their record.",
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
          <p className="text-body text-ink-2">There is nothing to set up. You type your details each time.</p>
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
