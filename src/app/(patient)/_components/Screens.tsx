"use client";

import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { TabBar } from "@/components/patient/TabBar";
import { Button } from "@/components/ui/Button";

/**
 * Frames for the signed-in patient screens.
 *
 * - TabScreen: the five main screens (Home, Timeline, Add, Meds, Profile),
 *   with the tab bar.
 * - SubScreen: details and forms, with a back link and no tab bar.
 *
 * Both render <LiveBannerSlot />, the seam for the share flow (Phase 5): it
 * renders nothing today; while a session is live it should render
 * <LiveShareBanner> on every screen.
 */

export function LiveBannerSlot(): ReactNode {
  // Phase 5: read the live share session (realtime, from PatientSessionGate)
  // and return <LiveShareBanner clinicianName=... timeLeft=... /> while it is
  // active or paused.
  return null;
}

export function TabScreen({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <PatientShell banner={<LiveBannerSlot />} header={header} tabBar={<TabBar />}>
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
      header={<ScreenHeader title={title} backHref={backHref} backLabel={backLabel} />}
      footer={footer}
    >
      {children}
    </PatientShell>
  );
}

/** Loading and failed states for a screen's data. */
export function LoadStatus({ status, onRetry }: { status: "loading" | "error"; onRetry: () => void }) {
  if (status === "loading") {
    return (
      <p role="status" className="px-5 py-10 text-center text-body-sm text-text-tertiary">
        Loading&hellip;
      </p>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <p className="text-body-sm text-text-primary">This couldn&apos;t load. Check your connection and try again.</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
