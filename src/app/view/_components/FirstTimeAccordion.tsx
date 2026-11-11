"use client";

import {
  Activity,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Heart,
  Pill,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "First time using Trace?" under the code card, from c-code (867:58731) and
 * the Design System accordions: How it works (140:5817), What you'll see
 * (140:5858), For your practice (140:5653), Privacy and security (140:5774).
 *
 * Static content. Where Figma's words are not true of this MVP (QR codes,
 * practice profiles, team audit logs, end-to-end encryption, a 30 minute
 * code, GDPR claims) they are replaced with plain, true stand-ins, listed in
 * docs/REVIEW.md ("Clinician portal").
 *
 * Each header is a real button in a heading (aria-expanded, aria-controls).
 */

type Item = { key: string; title: string; icon: ReactNode; content: ReactNode };

function NumberedCard({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4 rounded-card-tight bg-white/[0.08] p-4">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-pill-loose bg-white/15 text-label font-medium"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="text-label font-bold">
          <span className="sr-only">Step {Number(n)}: </span>
          {title}
        </h4>
        <p className="text-body-sm text-white/90">{children}</p>
      </div>
    </li>
  );
}

function IconCard({ icon, title, children, tile = "large" }: { icon: ReactNode; title: string; children: ReactNode; tile?: "small" | "large" }) {
  return (
    <li
      className={cn(
        "flex rounded-card-tight bg-white/[0.08] p-4",
        tile === "large" ? "items-start gap-4" : "flex-col gap-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm [&_svg]:size-4",
          tile === "large" ? "size-10 bg-white/15" : "size-6",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="text-label font-bold">{title}</h4>
        <p className="text-body-sm text-white/90">{children}</p>
      </div>
    </li>
  );
}

const ITEMS: Item[] = [
  {
    key: "how",
    title: "How it works",
    icon: <Activity />,
    content: (
      <ol className="flex flex-col gap-4">
        <NumberedCard n="01" title="Patient opens Trace and generates a code">
          From the home screen they tap their appointment card, review what to share, and tap &quot;Generate share
          code&quot;. A 4-digit code appears on their screen.
        </NumberedCard>
        <NumberedCard n="02" title="You enter the code here">
          The patient shows you their screen. Type the 4 digits into the boxes above. The patient will immediately see
          a consent screen on their phone.
        </NumberedCard>
        <NumberedCard n="03" title="Patient approves, record loads">
          Once the patient taps Allow, their record opens here as a read-only view. You can see exactly what they chose
          to share. Access closes when the session ends or the timer expires.
        </NumberedCard>
      </ol>
    ),
  },
  {
    key: "see",
    title: "What you'll see",
    icon: <Stethoscope />,
    content: (
      <>
        <p className="text-body-sm text-white/90">
          The patient controls which sections you can access. These are the sections available in Trace.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          <IconCard tile="small" icon={<TriangleAlert />} title="Critical safety">
            Allergies, blood type and implants, always shown first
          </IconCard>
          <IconCard tile="small" icon={<Heart />} title="Conditions">
            Active diagnoses, status, treating clinician
          </IconCard>
          <IconCard tile="small" icon={<Pill />} title="Medications">
            Full list with doses, prescriber, refill dates
          </IconCard>
          <IconCard tile="small" icon={<Calendar />} title="Visit history">
            Visits, results, prescriptions and letters, newest first
          </IconCard>
          <IconCard tile="small" icon={<Users />} title="Care team">
            The patient&apos;s GP, specialists and pharmacy
          </IconCard>
          <IconCard tile="small" icon={<UserRound />} title="Session notes">
            If the patient allows it, notes you write go back to their record
          </IconCard>
        </ul>
      </>
    ),
  },
  {
    key: "practice",
    title: "For your practice",
    icon: <Building2 />,
    content: (
      <>
        <p className="text-body-sm text-white/90">There is nothing to set up. You type your details each time.</p>
        <ul className="flex flex-col gap-4">
          <IconCard icon={<UserRound />} title="Your details appear on the consent screen">
            Patients see the name, role and practice you type here when they receive your access request. Trace does
            not check these details, so patients decide who to trust.
          </IconCard>
          <IconCard icon={<Building2 />} title="Remembered on this computer">
            Your details are saved in this browser so you do not have to type them again. Nothing is saved on our side.
          </IconCard>
        </ul>
      </>
    ),
  },
  {
    key: "privacy",
    title: "Privacy and security",
    icon: <ShieldCheck />,
    content: (
      <ul className="flex flex-col gap-4">
        <IconCard icon={<Check />} title="Patient-controlled access">
          The patient chooses what you see, for how long, and they can end the session at any point. Nothing is shared
          without their explicit approval.
        </IconCard>
        <IconCard icon={<Check />} title="Read-only throughout">
          You cannot edit any part of the record. The view closes when the session ends.
        </IconCard>
        <IconCard icon={<Check />} title="Every view is logged">
          All access is consent-based, session-scoped and logged. The patient has a complete log of every clinician who
          has accessed their record.
        </IconCard>
        <IconCard icon={<Check />} title="Encrypted in transit and at rest">
          Connections and stored data are encrypted. This is not end-to-end encryption. A share code works once and
          expires after 5 minutes if it is not used.
        </IconCard>
      </ul>
    ),
  },
];

export function FirstTimeAccordion({ className }: { className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  return (
    <section
      id="first-time"
      aria-labelledby={`${base}-title`}
      tabIndex={-1}
      className={cn("mx-auto w-full max-w-[722px] px-4 focus:outline-none sm:px-0", className)}
    >
      <h2 id={`${base}-title`} className="mb-3 text-center text-h3 font-medium text-white">
        First time using Trace?
      </h2>
      <div>
        {ITEMS.map((item) => {
          const isOpen = open === item.key;
          const btnId = `${base}-${item.key}-btn`;
          const panelId = `${base}-${item.key}-panel`;
          return (
            <div key={item.key} className="border-b border-indigo-divider-dark">
              <h3>
                <button
                  id={btnId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className="flex min-h-20 w-full items-center gap-4 rounded-sm px-4 py-[18px] text-left sm:px-6"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-indigo-accessible [&_svg]:size-6"
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-h3 font-medium">{item.title}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-6 shrink-0 transition-transform duration-150", isOpen && "rotate-180")}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                hidden={!isOpen}
                className="flex flex-col gap-4 px-4 pb-6 sm:px-6"
              >
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
