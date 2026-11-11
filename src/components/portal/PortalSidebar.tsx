import { Activity, FileText, Lock, Menu, Pill, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Clinician portal sidebar, from c-overview's "Sidebar" (Doctor Sidebar,
 * 52:2045): Indigo/Surface-Dark, the patient's initials, name and details,
 * then the record sections. Documents and Insurance are never shared in the
 * MVP, so they show locked with "Not shared" (not links).
 *
 * From 1024px it is the 256px left column. Below 1024px (PortalShell puts it
 * above the record) the patient block shrinks to one line and the sections
 * become a horizontal, scrollable row of tabs.
 *
 * Use real patient data: Figma's "Patient Name / Age · Sex · DOB" and "MO"
 * placeholders are known mistakes (PLAN.md section 11).
 */

export type PortalSection = "overview" | "timeline" | "medications" | "documents" | "care-team" | "insurance";

export type PortalNavItem = {
  key: PortalSection;
  label: string;
  href: string;
  icon: ReactNode;
  /** Not part of this share. Rendered as text with a lock, not a link. */
  locked?: boolean;
};

/** The default section list. Pass `locked` overrides from the share's scope (care team may be off). */
export function portalNavItems(lockedKeys: PortalSection[] = ["documents", "insurance"]): PortalNavItem[] {
  const items: PortalNavItem[] = [
    { key: "overview", label: "Overview", href: "/view/session", icon: <Menu /> },
    { key: "timeline", label: "Timeline", href: "/view/session/timeline", icon: <Activity /> },
    { key: "medications", label: "Medications", href: "/view/session/medications", icon: <Pill /> },
    { key: "documents", label: "Documents", href: "#", icon: <FileText /> },
    { key: "care-team", label: "Care team", href: "/view/session/care-team", icon: <UserRound /> },
    { key: "insurance", label: "Insurance", href: "#", icon: <FileText /> },
  ];
  return items.map((i) => ({ ...i, locked: lockedKeys.includes(i.key) }));
}

export function PortalSidebar({
  patient,
  items,
  active,
  className,
}: {
  patient: { name: string; initials: string; details: string };
  items: PortalNavItem[];
  active: PortalSection;
  className?: string;
}) {
  return (
    <aside
      aria-label="Patient record"
      className={cn(
        "on-dark flex min-w-0 flex-col bg-indigo-surface-dark px-4 text-white lg:pb-6 lg:pt-8",
        className,
      )}
    >
      <div className="flex items-center gap-3 py-3 lg:flex-col lg:gap-2.5 lg:pb-7 lg:pt-2">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-accessible text-body-sm font-bold lg:size-16 lg:text-[18px]"
        >
          {patient.initials}
        </span>
        <div className="min-w-0 lg:text-center">
          <p className="truncate text-h4 font-bold">{patient.name}</p>
          <p className="truncate text-body-tiny">{patient.details}</p>
        </div>
      </div>
      <div aria-hidden="true" className="hidden h-px bg-indigo-divider-dark lg:block" />
      <nav aria-label="Record sections" className="lg:py-4">
        {/* Below 1024px a scrolling row, which clips: pt-1 and pb-2 leave room for the focus ring. */}
        <ul className="-mx-4 flex scroll-px-4 gap-0.5 overflow-x-auto px-4 pb-2 pt-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0">
          {items.map((item) => {
            const isActive = item.key === active && !item.locked;
            const content = (
              <>
                <span aria-hidden="true" className="[&_svg]:size-4">
                  {item.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("text-body-sm", isActive && "font-medium")}>{item.label}</span>
                  {item.locked && <span className="text-body-tiny leading-none">Not shared</span>}
                </span>
                {item.locked && <Lock aria-hidden="true" className="size-4 shrink-0" />}
              </>
            );
            const classes = cn(
              "flex min-h-11 items-center gap-3 whitespace-nowrap rounded-sm px-3.5 py-2.5",
              isActive && "bg-indigo-accessible",
            );
            return (
              <li key={item.key} className="shrink-0">
                {item.locked ? (
                  <div className={cn(classes, "cursor-default")}>{content}</div>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(classes, !isActive && "hovered:bg-white/10")}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
