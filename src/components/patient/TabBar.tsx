"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Phone tab bar (BRIEF.md section 3.8, every phone board): 68px, white, a
 * border-tabbar hairline on top. Five slots: Home, Record, the centre Add
 * (a 48px accent disc with a white plus, the one filled circle besides
 * avatars), Medications, Profile.
 *
 * The active tab comes from the URL (or `active`, for /kit): accent 600,
 * with aria-current="page"; the others ink-2 500. Hide the bar during focused
 * flows (share code, approve, session, forms): render it through
 * PatientShell's `tabBar` slot only on the main screens.
 */

export type TabKey = "home" | "record" | "add" | "meds" | "profile";

type Tab = { key: TabKey; label: string; href: string; icon: IconName; match: (p: string) => boolean };

const TABS: Tab[] = [
  { key: "home", label: "Home", href: "/home", icon: "home", match: (p) => p === "/home" },
  { key: "record", label: "Record", href: "/record", icon: "record", match: (p) => p.startsWith("/record") },
  { key: "add", label: "Add", href: "/add", icon: "plus", match: (p) => p.startsWith("/add") },
  { key: "meds", label: "Medications", href: "/meds", icon: "pill", match: (p) => p.startsWith("/meds") },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: "person",
    match: (p) => p.startsWith("/profile") || p.startsWith("/access-log"),
  },
];

export function TabBar({ active, className }: { active?: TabKey | "none"; className?: string }) {
  const pathname = usePathname() ?? "";
  const activeKey = active ?? TABS.find((t) => t.match(pathname))?.key ?? "none";

  return (
    <nav
      aria-label="Main"
      className={cn("border-t border-border-tabbar bg-surface pb-[env(safe-area-inset-bottom)]", className)}
    >
      <ul className="flex h-17">
        {TABS.map((tab) => {
          const isActive = tab.key === activeKey;
          if (tab.key === "add") {
            return (
              <li key={tab.key} className="flex flex-1 items-center justify-center">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                  className="flex size-12 items-center justify-center rounded-full bg-accent text-white transition-colors duration-150 ease-out hovered:bg-accent-alt"
                >
                  <Icon name="plus" strokeWidth={2} />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.key} className="flex min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-micro transition-colors duration-150 ease-out",
                  isActive ? "font-semibold text-accent" : "font-medium text-ink-2 hovered:text-ink",
                )}
              >
                <Icon name={tab.icon} />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
