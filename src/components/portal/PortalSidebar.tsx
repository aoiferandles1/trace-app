import type { IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { RailDivider, RailItem, RailNotShared } from "./Rail";

/**
 * The portal's left rail (board PortalRecordE): session indigo, the "trace"
 * wordmark, the shared sections as RailItems, a hairline, then the sections
 * this share leaves out as dimmed "Not shared" rows (not links), built from
 * the share's scope.
 *
 * From 1024px it is the 232px left column. Below 1024px (PortalShell puts it
 * above the record) it becomes a horizontal, scrollable row of the shared
 * sections; the not-shared rows follow in the same row.
 *
 * Until Phase 7 moves the patient into the record's header, the patient's
 * name and details sit under the wordmark. The doctor's name and practice
 * (as typed) sit at the foot of the rail.
 */

export type PortalSection = "overview" | "timeline" | "medications" | "documents" | "care-team" | "insurance";

export type PortalNavItem = {
  key: PortalSection;
  label: string;
  href: string;
  icon: IconName;
  /** Not part of this share: drawn as a "Not shared" row, not a link. */
  locked?: boolean;
};

/** The default section list. Pass the keys this share leaves out. */
export function portalNavItems(lockedKeys: PortalSection[] = ["documents", "insurance"]): PortalNavItem[] {
  const items: PortalNavItem[] = [
    { key: "overview", label: "Overview", href: "/view/session", icon: "grid" },
    { key: "timeline", label: "Timeline", href: "/view/session/timeline", icon: "clock" },
    { key: "medications", label: "Medications", href: "/view/session/medications", icon: "pill" },
    { key: "documents", label: "Documents", href: "#", icon: "document" },
    { key: "care-team", label: "Care team", href: "/view/session/care-team", icon: "person" },
    { key: "insurance", label: "Insurance", href: "#", icon: "shield" },
  ];
  return items.map((i) => ({ ...i, locked: lockedKeys.includes(i.key) }));
}

export function PortalSidebar({
  patient,
  items,
  active,
  clinician,
  className,
}: {
  patient: { name: string; initials: string; details: string };
  items: PortalNavItem[];
  active: PortalSection;
  clinician?: { name: string; role?: string; practice?: string };
  className?: string;
}) {
  const shared = items.filter((i) => !i.locked);
  const notShared = items.filter((i) => i.locked);
  return (
    <aside
      aria-label="Patient record"
      className={cn("on-session flex min-w-0 flex-col bg-session px-3.5 text-white lg:min-h-dvh lg:pb-6 lg:pt-7", className)}
    >
      <p className="px-3.5 pt-4 font-display text-wordmark font-light lg:pb-7 lg:pt-0">trace</p>
      <div className="flex min-w-0 flex-col px-3.5 py-3 lg:pb-5 lg:pt-0">
        <p className="truncate text-row font-medium">{patient.name}</p>
        <p className="truncate text-meta text-on-session-2">{patient.details}</p>
      </div>
      <nav aria-label="Record sections">
        {/* Below 1024px a scrolling row, which clips: pt-1 and pb-2 leave room for the focus ring. */}
        <ul className="-mx-3.5 flex scroll-px-3.5 gap-1 overflow-x-auto px-3.5 pb-2 pt-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0">
          {shared.map((item) => (
            <li key={item.key} className="shrink-0">
              <RailItem icon={item.icon} label={item.label} href={item.href} current={item.key === active} />
            </li>
          ))}
          {notShared.length > 0 && (
            <li aria-hidden="true" className="hidden lg:block">
              <RailDivider />
            </li>
          )}
          {notShared.map((item) => (
            <li key={item.key} className="shrink-0">
              <RailNotShared icon={item.icon} label={item.label} />
            </li>
          ))}
        </ul>
      </nav>
      {clinician && (
        <div className="hidden flex-col gap-0.5 border-t border-on-session-border px-3.5 pt-4 lg:mt-auto lg:flex">
          <p className="text-caption font-semibold">{clinician.name}</p>
          {(clinician.role || clinician.practice) && (
            <p className="text-meta text-on-session-2">{[clinician.role, clinician.practice].filter(Boolean).join(", ")}</p>
          )}
        </div>
      )}
    </aside>
  );
}
