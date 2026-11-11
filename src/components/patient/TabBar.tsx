"use client";

import { Activity, House, Pill, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Patient bottom navigation, from Figma "Tab Bar" (47:929): Home, Timeline,
 * a raised Add button, Meds, Profile. 78px tall, translucent white, 28px top
 * corners.
 *
 * The active tab comes from the URL (or `active` to override, for /kit).
 * Active tab: Indigo/Text icon and a bold label (so it is not colour alone)
 * plus aria-current="page".
 * Every tab is at least 56 x 48. Render it through PatientShell's `tabBar` slot.
 */

export type TabKey = "home" | "timeline" | "add" | "meds" | "profile";

type Tab = { key: TabKey; label: string; href: string; icon: ReactNode; match: (p: string) => boolean };

const TABS: Tab[] = [
  { key: "home", label: "Home", href: "/home", icon: <House />, match: (p) => p === "/home" },
  {
    key: "timeline",
    label: "Timeline",
    href: "/record",
    icon: <Activity />,
    match: (p) => p.startsWith("/record"),
  },
  { key: "add", label: "Add", href: "/add", icon: <Plus />, match: (p) => p.startsWith("/add") },
  { key: "meds", label: "Meds", href: "/meds", icon: <Pill />, match: (p) => p.startsWith("/meds") },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: <UserRound />,
    match: (p) => p.startsWith("/profile"),
  },
];

export function TabBar({ active, className }: { active?: TabKey | "none"; className?: string }) {
  const pathname = usePathname() ?? "";
  const activeKey = active ?? TABS.find((t) => t.match(pathname))?.key ?? "none";

  return (
    <nav
      aria-label="Main"
      className={cn(
        "rounded-t-sheet bg-white/90 px-2 min-[375px]:px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-1 shadow-tabbar backdrop-blur-md",
        className,
      )}
    >
      <ul className="flex items-end justify-between">
        {TABS.map((tab) => {
          const isActive = tab.key === activeKey;
          if (tab.key === "add") {
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className="group flex flex-col items-center gap-0.5 rounded-card"
                >
                  <span
                    aria-hidden="true"
                    className="-mt-6 flex size-12 items-center justify-center rounded-pill bg-brand-indigo text-white shadow-fab transition-colors duration-150 group-hover:bg-indigo-accessible [&_svg]:size-6"
                  >
                    {tab.icon}
                  </span>
                  <span
                    className={cn(
                      "text-label tracking-normal",
                      isActive ? "font-bold text-indigo-text" : "font-medium text-text-tertiary",
                    )}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-12 w-12 min-[375px]:w-14 flex-col items-center justify-end gap-0.5 rounded-md [&_svg]:size-6",
                  isActive ? "text-indigo-text" : "text-text-tertiary hovered:text-text-primary",
                )}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span className={cn("text-label tracking-normal", isActive ? "font-bold" : "font-medium")}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
