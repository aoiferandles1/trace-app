import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * A shortcut tile: a bare accent icon over a short label, in a surface card
 * with a border-card edge. No tinted icon square. The whole tile is one link.
 */
export function QuickActionTile({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  label: string;
  icon: IconName;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-22 min-w-0 flex-col justify-between rounded-tile border border-border-card bg-surface p-3 text-ink transition-colors duration-150 ease-out hovered:border-border-control",
        className,
      )}
    >
      <Icon name={icon} className="text-accent" />
      <span className="text-caption font-medium">{label}</span>
    </Link>
  );
}
