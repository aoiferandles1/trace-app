"use client";

import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { LiveShareBanner } from "@/components/patient/LiveShareBanner";
import { usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { TabBar } from "@/components/patient/TabBar";
import { Button } from "@/components/ui/Button";
import { formatCountdown } from "@/lib/format";
import { clinicianName, isOpen, msUntil } from "@/lib/patient/share";
import { useNow } from "@/lib/useNow";

/**
 * Frames for the signed-in patient screens.
 *
 * - TabScreen: the five main screens (Home, Timeline, Add, Meds, Profile),
 *   with the tab bar.
 * - SubScreen: details and forms, with a back link and no tab bar.
 *
 * Both render <LiveBannerSlot /> (the banner across the top while a doctor
 * has access) and <DemoMarker /> (demo accounts only).
 */

/** The live share banner (p-home-live), on every screen while a session is active or paused. */
export function LiveBannerSlot(): ReactNode {
  const { session } = useShareSession();
  const open = isOpen(session);
  const ticking = open && session.status === "active" && session.duration_kind !== "manual";
  const now = useNow(ticking);
  if (!open) return null;
  return (
    <LiveShareBanner
      clinicianName={clinicianName(session)}
      paused={session.status === "paused"}
      timeLeft={ticking ? formatCountdown(msUntil(session.expires_at, now)) : undefined}
    />
  );
}

/**
 * "Demo · sample data" (PLAN.md section 9): a slim strip at the top of every
 * signed-in screen of a demo (anonymous) account. Real accounts never see it.
 */
export function DemoMarker({ tone = "page" }: { tone?: "page" | "indigo" }): ReactNode {
  const { isAnonymous } = usePatientSession();
  if (!isAnonymous) return null;
  return (
    <p
      className={
        tone === "indigo"
          ? "bg-indigo-700 py-1 text-center text-label font-medium text-white"
          : "bg-brand-peach-tint py-1 text-center text-label font-medium text-peach-700"
      }
    >
      Demo · sample data
    </p>
  );
}

export function TabScreen({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <PatientShell
      banner={<LiveBannerSlot />}
      header={
        <>
          <DemoMarker />
          {header}
        </>
      }
      tabBar={<TabBar />}
    >
      {children}
    </PatientShell>
  );
}

export function SubScreen({
  title,
  backHref,
  backLabel = "Back",
  footer,
  children,
}: {
  title: string;
  backHref: string;
  backLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PatientShell
      banner={<LiveBannerSlot />}
      header={
        <>
          <DemoMarker />
          <ScreenHeader title={title} backHref={backHref} backLabel={backLabel} />
        </>
      }
      footer={footer}
    >
      {children}
    </PatientShell>
  );
}

/** Loading and failed states for a screen's data. `tone="indigo"` on the full-bleed indigo screens. */
export function LoadStatus({
  status,
  onRetry,
  tone = "page",
}: {
  status: "loading" | "error";
  onRetry: () => void;
  tone?: "page" | "indigo";
}) {
  if (status === "loading") {
    return (
      <p
        role="status"
        className={tone === "indigo" ? "px-5 py-10 text-center text-body-sm" : "px-5 py-10 text-center text-body-sm text-text-tertiary"}
      >
        Loading&hellip;
      </p>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <p className={tone === "indigo" ? "text-body-sm" : "text-body-sm text-text-primary"}>
        This couldn&apos;t load. Check your connection and try again.
      </p>
      <Button variant={tone === "indigo" ? "tertiary" : "secondary"} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
