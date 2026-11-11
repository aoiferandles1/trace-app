"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { SessionReady } from "@/components/patient/PatientSession";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/patient/PageHeader";
import { TabScreen } from "../_components/Screens";

/**
 * Add to my record (p-add), with only the tiles that work. Upload document,
 * Scan or photograph, Record a vaccination, Family history and Upload a
 * receipt are hidden (PLAN.md section 11). "Add a condition" is new.
 */
function AddScreen() {
  return (
    <TabScreen header={<PageHeader title="Add to my record" />}>
      <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
        <p className="text-body text-ink-2">What would you like to add?</p>
        <ul className="grid grid-cols-2 gap-3">
          <Tile href="/add/appointment" icon="calendar" title="Log appointment">
            Record a past or upcoming visit
          </Tile>
          <Tile href="/add/medication" icon="pill" title="Add a medication">
            Prescription or supplement
          </Tile>
          <Tile href="/add/note" icon="document" title="Write a note">
            Symptoms, questions, observations
          </Tile>
          <Tile href="/record/conditions/new" icon="heart-pulse" title="Add a condition">
            A diagnosis or ongoing health issue
          </Tile>
        </ul>
      </div>
    </TabScreen>
  );
}

function Tile({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-3 rounded-card border border-border-card bg-surface p-4 transition-colors duration-150 ease-out hovered:border-border-control"
      >
        <Icon name={icon} className="text-accent" />
        <span className="flex flex-col gap-0.5">
          <span className="text-row font-medium text-ink">{title}</span>
          <span className="text-caption text-ink-2">{children}</span>
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
