"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, type TabKey } from "@/components/patient/TabBar";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * The patient app's left rail at desktop widths (BRIEF.md section 7,
 * "Patient web"; no board). It replaces the phone's tab bar from 1024px:
 * the same five items in the same order, as the portal's rail is built
 * (232px, the "trace" wordmark, 44px items with radius 12, a 22px bare icon
 * and the label), but white with a hairline on its right, since session
 * indigo is kept for sharing. The current item is filled accent with white
 * text and aria-current="page"; the others are ink on white.
 *
 * Add is a plain item here (it opens /add, the rows as a screen), not the
 * phone's filled disc.
 */
export function PatientRail({ active, className }: { active?: TabKey; className?: string }) {
  const pathname = usePathname() ?? "";
  const activeKey = active ?? TABS.find((t) => t.match(pathname))?.key;
  return (
    <nav
      aria-label="Main"
      className={cn("flex w-58 shrink-0 flex-col overflow-y-auto border-r border-border-tabbar bg-surface px-3.5 pb-6 pt-7", className)}
    >
      <p className="px-3.5 pb-7 font-display text-wordmark font-light">trace</p>
      <ul className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const current = tab.key === activeKey;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-11 min-w-0 items-center gap-3 whitespace-nowrap rounded-rail px-3.5 text-label font-medium transition-colors duration-150 ease-out",
                  current ? "bg-accent text-white" : "text-ink hovered:bg-ground pressed:bg-border-row",
                )}
              >
                <Icon name={tab.icon} size={22} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
