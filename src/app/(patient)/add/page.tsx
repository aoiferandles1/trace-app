"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { CalendarDays, FileText, HeartPulse, Pill } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { cn } from "@/lib/cn";
import { TabScreen } from "../_components/Screens";

const tileTone = {
  indigo: "bg-brand-indigo-tint text-indigo-text",
  teal: "bg-brand-teal-tint text-teal-700",
  peach: "bg-brand-peach-tint text-peach-700",
  neutral: "bg-surface-sunken text-text-primary",
} as const;

/**
 * Add to my record (p-add), with only the tiles that work. Upload document,
 * Scan or photograph, Record a vaccination, Family history and Upload a
 * receipt are hidden (PLAN.md section 11). "Add a condition" is new.
 */
function AddScreen() {
  return (
    <TabScreen header={<ScreenHeader title="Add to my record" />}>
      <div className="flex flex-col gap-5 px-4 pb-8 pt-2">
        <p className="text-body-lg text-text-tertiary">What would you like to add?</p>
        <ul className="grid grid-cols-2 gap-3">
          <Tile href="/add/appointment" tone="peach" icon={<CalendarDays />} title="Log appointment">
            Record a past or upcoming visit
          </Tile>
          <Tile href="/add/medication" tone="neutral" icon={<Pill />} title="Add a medication">
            Prescription or supplement
          </Tile>
          <Tile href="/add/note" tone="neutral" icon={<FileText />} title="Write a note">
            Symptoms, questions, observations
          </Tile>
          <Tile href="/record/conditions/new" tone="teal" icon={<HeartPulse />} title="Add a condition">
            A diagnosis or ongoing health issue
          </Tile>
        </ul>
      </div>
    </TabScreen>
  );
}

function Tile({
  href,
  tone,
  icon,
  title,
  children,
}: {
  href: string;
  tone: keyof typeof tileTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-3 rounded-card border border-border-default bg-surface-card p-4 shadow-sm transition-colors duration-150 hovered:bg-neutral-50"
      >
        <span
          aria-hidden="true"
          className={cn("flex size-12 items-center justify-center rounded-md [&_svg]:size-6", tileTone[tone])}
        >
          {icon}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-h4 font-bold text-text-primary">{title}</span>
          <span className="text-body-sm text-text-tertiary">{children}</span>
        </span>
      </Link>
    </li>
  );
}

export default function AddPage() {
  return (
    <SessionReady>
      <AddScreen />
    </SessionReady>
  );
}
