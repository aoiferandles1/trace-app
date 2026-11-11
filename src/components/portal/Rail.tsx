import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Pieces of the portal's left rail (board PortalRecordE): session indigo,
 * white text.
 *
 * - RailItem: a nav item, 44px tall, radius 12, a 22px bare icon and the
 *   label (15px 500). The current one is a white pill with session-indigo
 *   text and aria-current="page"; the others are white on indigo.
 * - RailNotShared: a section the patient did not share. Dimmed (white at
 *   78%), "Not shared" under the name, a dashed ring on the right. Not a
 *   link and not focusable; aria-disabled says it is unavailable.
 * - RailDivider: the on-session hairline between the two groups.
 */

export function RailItem({
  icon,
  label,
  href,
  onClick,
  current = false,
  className,
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
  className?: string;
}) {
  const classes = cn(
    "flex h-11 min-w-0 items-center gap-3 whitespace-nowrap rounded-rail px-3.5 text-label font-medium transition-colors duration-150 ease-out",
    current ? "bg-white text-session" : "text-white hovered:bg-on-session-border",
    className,
  );
  const body = (
    <>
      <Icon name={icon} size={22} />
      {label}
    </>
  );
  return href ? (
    <Link href={href} aria-current={current ? "page" : undefined} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" aria-current={current ? "page" : undefined} onClick={onClick} className={classes}>
      {body}
    </button>
  );
}

export function RailNotShared({ icon, label, className }: { icon: IconName; label: string; className?: string }) {
  return (
    <div
      aria-disabled="true"
      className={cn("flex h-12 min-w-0 items-center gap-3 whitespace-nowrap px-3.5 text-on-session-2", className)}
    >
      <Icon name={icon} size={22} className="opacity-70" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label font-medium">{label}</span>
        <span className="text-micro">Not shared</span>
      </span>
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-dashed border-on-session-dash" />
    </div>
  );
}

export function RailDivider({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("mx-0 my-2 h-px bg-on-session-border", className)} />;
}
