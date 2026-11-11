"use client";

import { Icon } from "@/components/ui/Icon";
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
    <li className="flex items-start gap-5 border-t border-border-card py-4 first:border-t-0">
      <span aria-hidden="true" className="w-7 shrink-0 font-display text-numeral-lg font-light text-accent">
        {Number(n)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4 className="text-row font-medium">
          <span className="sr-only">Step {Number(n)}: </span>
          {title}
        </h4>
        <p className="text-caption text-ink-2">{children}</p>
      </div>
    </li>
  );
}

function IconCard({ icon, title, children, tile = "large" }: { icon: ReactNode; title: string; children: ReactNode; tile?: "small" | "large" }) {
  return (
    <li className={cn("flex", tile === "large" ? "items-start gap-3.5 py-2" : "flex-col gap-1.5 py-2")}>
      <span aria-hidden="true" className="flex shrink-0 text-accent">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4 className="text-row font-medium">{title}</h4>
        <p className="text-caption text-ink-2">{children}</p>
      </div>
    </li>
  );
}

const ITEMS: Item[] = [
  {
    key: "how",
    title: "How it works",
    icon: <Icon name="record" />,
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
    icon: <Icon name="calendar" />,
    content: (
      <>
        <p className="text-caption text-ink-2">
          The patient controls which sections you can access. These are the sections available in Trace.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          <IconCard tile="small" icon={<Icon name="warning" />} title="Critical safety">
            Allergies, blood type and implants, always shown first
          </IconCard>
          <IconCard tile="small" icon={<Icon name="heart" />} title="Conditions">
            Active diagnoses, status, treating clinician
          </IconCard>
          <IconCard tile="small" icon={<Icon name="pill" />} title="Medications">
            Full list with doses, prescriber, refill dates
          </IconCard>
          <IconCard tile="small" icon={<Icon name="calendar" />} title="Visit history">
            Visits, results, prescriptions and letters, newest first
          </IconCard>
          <IconCard tile="small" icon={<Icon name="people" />} title="Care team">
            The patient&apos;s GP, specialists and pharmacy
          </IconCard>
          <IconCard tile="small" icon={<Icon name="person" />} title="Session notes">
            If the patient allows it, notes you write go back to their record
          </IconCard>
        </ul>
      </>
    ),
  },
  {
    key: "practice",
    title: "For your practice",
    icon: <Icon name="building" />,
    content: (
      <>
        <p className="text-caption text-ink-2">There is nothing to set up. You type your details each time.</p>
        <ul className="flex flex-col gap-4">
          <IconCard icon={<Icon name="person" />} title="Your details appear on the consent screen">
            Patients see the name, role and practice you type here when they receive your access request. Trace does
            not check these details, so patients decide who to trust.
          </IconCard>
          <IconCard icon={<Icon name="building" />} title="Remembered on this computer">
            Your details are saved in this browser so you do not have to type them again. Nothing is saved on our side.
          </IconCard>
        </ul>
      </>
    ),
  },
  {
    key: "privacy",
    title: "Privacy and security",
    icon: <Icon name="shield" />,
    content: (
      <ul className="flex flex-col gap-4">
        <IconCard icon={<Icon name="tick" />} title="Patient-controlled access">
          The patient chooses what you see, for how long, and they can end the session at any point. Nothing is shared
          without their explicit approval.
        </IconCard>
        <IconCard icon={<Icon name="tick" />} title="Read-only throughout">
          You cannot edit any part of the record. The view closes when the session ends.
        </IconCard>
        <IconCard icon={<Icon name="tick" />} title="Every view is logged">
          All access is consent-based, session-scoped and logged. The patient has a complete log of every clinician who
          has accessed their record.
        </IconCard>
        <IconCard icon={<Icon name="tick" />} title="Encrypted in transit and at rest">
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
      className={cn("w-full max-w-[722px] focus:outline-none", className)}
    >
      <h2 id={`${base}-title`} className="mb-2 font-display text-heading font-light">
        First time using Trace?
      </h2>
      <div>
        {ITEMS.map((item) => {
          const isOpen = open === item.key;
          const btnId = `${base}-${item.key}-btn`;
          const panelId = `${base}-${item.key}-panel`;
          return (
            <div key={item.key} className="border-b border-border-card">
              <h3>
                <button
                  id={btnId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className="flex min-h-16 w-full items-center gap-3.5 py-3 text-left"
                >
                  <span aria-hidden="true" className="flex shrink-0 text-accent">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-row-lg font-medium">{item.title}</span>
                  <Icon
                    name="chevron-down"
                    className={cn("text-ink-2 transition-transform duration-150 ease-out", isOpen && "rotate-180")}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                hidden={!isOpen}
                className="flex flex-col gap-4 pb-6"
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
