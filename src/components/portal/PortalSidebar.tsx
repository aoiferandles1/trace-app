import type { IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { RailDivider, RailItem, RailNotShared } from "./Rail";

/**
 * The live record's left rail (BRIEF.md 6.3, board PortalRecordE): session
 * indigo, full height, 232px. The "trace" wordmark, the views the patient
 * granted as links (the current one a white pill, aria-current="page"), a
 * hairline, then the views this share leaves out as dimmed "Not shared"
 * rows that are not links, and at the foot the doctor's name and practice
 * as they typed them.
 *
 * Built from the share's scope by the caller: pass every view with
 * `shared` set. Below 1024px the rail becomes a bar above the record: the
 * wordmark, then one row of the views that scrolls sideways inside itself.
 */

export type RailView = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  shared: boolean;
};

export function PortalSidebar({
  views,
  active,
  clinician,
  className,
}: {
  views: RailView[];
  active: string | null;
  clinician?: { name: string; practice?: string | null };
  className?: string;
}) {
  const shared = views.filter((v) => v.shared);
  const notShared = views.filter((v) => !v.shared);
  return (
    <nav
      aria-label="Patient record"
      className={cn(
        "on-session flex min-w-0 flex-col bg-session px-3.5 pt-4 text-white lg:h-full lg:w-58 lg:shrink-0 lg:overflow-y-auto lg:pb-6 lg:pt-7",
        className,
      )}
    >
      <p className="px-3.5 font-display text-wordmark font-light lg:pb-7">trace</p>
      {/* Below 1024px a scrolling row, which clips: pt-2 and pb-3 leave room for the focus ring. */}
      <ul className="-mx-3.5 flex scroll-px-3.5 gap-1 overflow-x-auto px-3.5 pb-3 pt-2 [scrollbar-width:thin] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0">
        {shared.map((v) => (
          <li key={v.key} className="shrink-0">
            <RailItem icon={v.icon} label={v.label} href={v.href} current={v.key === active} />
          </li>
        ))}
        {notShared.length > 0 && (
          <li aria-hidden="true" className="hidden lg:block">
            <RailDivider />
          </li>
        )}
        {notShared.map((v) => (
          <li key={v.key} className="shrink-0">
            <RailNotShared icon={v.icon} label={v.label} />
          </li>
        ))}
      </ul>
      {clinician && (
        <div className="hidden flex-col gap-0.5 border-t border-on-session-border px-3.5 pt-4 lg:mt-auto lg:flex">
          <p className="text-caption font-semibold">{clinician.name}</p>
          {clinician.practice && <p className="text-meta text-on-session-2">{clinician.practice}</p>}
        </div>
      )}
    </nav>
  );
}

