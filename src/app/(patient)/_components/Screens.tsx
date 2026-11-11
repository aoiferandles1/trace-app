"use client";

import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { LiveShareBanner } from "@/components/patient/LiveShareBanner";
import { usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { PageHeader } from "@/components/patient/PageHeader";
import { TabBar } from "@/components/patient/TabBar";
import { DemoStrip } from "@/components/ui/DemoStrip";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatCountdown } from "@/lib/format";
import { clinicianName, isOpen, msUntil } from "@/lib/patient/share";
import { useNow } from "@/lib/useNow";

/**
 * Frames for the signed-in patient screens.
 *
 * - TabScreen: the five main screens (Home, Record, Add, Medications,
 *   Profile), with the tab bar.
 * - SubScreen: details and forms, with a back link and no tab bar.
 *
 * Both render <DemoMarker /> (demo accounts only, at the very top) and
 * <LiveBannerSlot /> (the strip while a doctor has access).
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
 * "Demo with sample data" (BRIEF.md section 3.2): the strip at the top of
 * every signed-in screen of a demo (anonymous) account. Real accounts never
 * see it.
 */
export function DemoMarker({ tone = "ground" }: { tone?: "ground" | "session" }): ReactNode {
  const { isAnonymous } = usePatientSession();
  if (!isAnonymous) return null;
  return <DemoStrip tone={tone === "session" ? "session" : "default"} />;
}

export function TabScreen({
  header,
  banner,
  children,
}: {
  header: ReactNode;
  /** Replaces the live banner; `null` hides it (Home shows the share in its own card). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PatientShell
      demo={<DemoMarker />}
      banner={banner === undefined ? <LiveBannerSlot /> : banner}
      header={header}
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
      demo={<DemoMarker />}
      banner={<LiveBannerSlot />}
      header={<PageHeader title={title} backHref={backHref} backLabel={backLabel} />}
      footer={footer}
    >
      {children}
    </PatientShell>
  );
}

/** Loading and failed states for a screen's data. `tone="session"` on the session-indigo screens. */
export function LoadStatus({
  status,
  onRetry,
  tone = "ground",
}: {
  status: "loading" | "error";
  onRetry: () => void;
  tone?: "ground" | "session";
}) {
  if (status === "loading") {
    return (
      <p role="status" className={tone === "session" ? "px-5 py-10 text-center text-caption text-on-session-2" : "px-5 py-10 text-center text-caption text-ink-2"}>
        Loading&hellip;
      </p>
    );
  }
  return (
    <StateMessage
      tone="error"
      align="center"
      surface={tone === "session" ? "session" : "default"}
      className="px-5 py-10"
      message="This couldn't load. Check your connection and try again."
      action={{ label: "Try again", onClick: onRetry }}
    />
  );
}
