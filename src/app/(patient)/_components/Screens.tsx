"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { LiveShareBanner } from "@/components/patient/LiveShareBanner";
import { usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession, type ShareNotice } from "@/components/patient/ShareSession";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/patient/PageHeader";
import { PatientRail } from "@/components/patient/PatientRail";
import { TabBar } from "@/components/patient/TabBar";
import { DemoStrip } from "@/components/ui/DemoStrip";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatCountdown } from "@/lib/format";
import { clinicianName, isOpen, msUntil } from "@/lib/patient/share";
import { useDesktop } from "@/lib/useDesktop";
import { useNow } from "@/lib/useNow";

/**
 * Frames for the signed-in patient screens.
 *
 * - TabScreen: the five main screens (Home, Record, Add, Medications,
 *   Profile), with the tab bar.
 * - SubScreen: details and forms, with a back link. Forms and focused flows
 *   have no tab bar; detail screens the boards draw with one (MedDetailA2,
 *   TimelineA2, FamilyA2, InsuranceA2) pass `tabBar`.
 *
 * Both render <DemoMarker /> (demo accounts only, at the very top) and
 * <LiveBannerSlot /> (the strip while a doctor has access).
 *
 * From 1024px they take the desktop layout (PatientShell): the rail in place
 * of the tab bar, and `aside` (a detail screen's list) or `detail` (what a
 * list screen shows beside it) for two panes, mounted only at desktop
 * widths. A screen with a pinned primary action (`footer`: every form, the
 * upload, Your details) is a focused task, as the brief's upload is: no
 * rail, the centred column, as the sharing screens and sign-up.
 */

/**
 * The live share banner (p-home-live), on every screen while a session is
 * active or paused; in its last 5 minutes it says access ends soon. Once a
 * share or a request is over, the same place holds the one line saying how
 * it ended (ShareSession's `notice`), until it is dismissed.
 */
export function LiveBannerSlot(): ReactNode {
  const { session, notice, dismissNotice } = useShareSession();
  const open = isOpen(session);
  const ticking = open && session.status === "active" && session.duration_kind !== "manual";
  const now = useNow(ticking);
  if (!open) return notice ? <ShareNoticeStrip notice={notice} onDismiss={dismissNotice} /> : null;
  const left = ticking ? msUntil(session.expires_at, now) : 0;
  return (
    <LiveShareBanner
      clinicianName={clinicianName(session)}
      paused={session.status === "paused"}
      endingSoon={ticking && left <= 5 * 60_000}
      timeLeft={ticking ? formatCountdown(left) : undefined}
    />
  );
}

/** "Dr Hennessy no longer has access to your record. View summary", with a close button. */
export function ShareNoticeStrip({ notice, onDismiss }: { notice: ShareNotice; onDismiss: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-border-tabbar bg-surface pl-5 pr-1.5">
      <p className="min-w-0 flex-1 py-2 text-caption">
        {notice.text}
        {notice.link && (
          <>
            {" "}
            <Link
              href={notice.link.href}
              onClick={onDismiss}
              className="font-semibold text-accent underline underline-offset-2 hovered:text-accent-alt"
            >
              {notice.link.label}
            </Link>
          </>
        )}
      </p>
      <IconButton icon="close" label="Dismiss" size={36} tone="muted" onClick={onDismiss} />
    </div>
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
  detail,
  children,
}: {
  header: ReactNode;
  /** Replaces the live banner; `null` hides it (Home shows the share in its own card). */
  banner?: ReactNode;
  /** Desktop only: the right-hand pane beside this list. */
  detail?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useDesktop();
  return (
    <PatientShell
      demo={<DemoMarker />}
      banner={banner === undefined ? <LiveBannerSlot /> : banner}
      header={header}
      tabBar={desktop ? undefined : <TabBar />}
      rail={desktop ? <PatientRail /> : undefined}
      detail={desktop ? detail : undefined}
    >
      {children}
    </PatientShell>
  );
}

export function SubScreen({
  title,
  backHref,
  backLabel = "Back",
  titleSize = "lg",
  subtitle,
  action,
  footer,
  tabBar = false,
  aside,
  detail,
  children,
}: {
  title: string;
  backHref: string;
  backLabel?: string;
  /** "md" (24/30) for FamilyA2's and InsuranceA2's titles. */
  titleSize?: "lg" | "md";
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  /** The tab bar, for detail screens the boards draw with it. Never on forms. */
  tabBar?: boolean;
  /** Desktop only: the list to the left of this detail. */
  aside?: ReactNode;
  /** Desktop only: the right-hand pane beside this list. */
  detail?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useDesktop();
  const rail = desktop && !footer;
  return (
    <PatientShell
      demo={<DemoMarker />}
      banner={<LiveBannerSlot />}
      header={
        <PageHeader title={title} size={titleSize} subtitle={subtitle} action={action} backHref={backHref} backLabel={backLabel} />
      }
      footer={footer}
      tabBar={tabBar && !desktop ? <TabBar /> : undefined}
      rail={rail ? <PatientRail /> : undefined}
      aside={rail ? aside : undefined}
      detail={rail ? detail : undefined}
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
    // Quiet placeholders in the shape of a list (no shimmer, no gradient); the word is for screen readers.
    const block = tone === "session" ? "bg-on-session-border" : "bg-border-row";
    return (
      <div role="status" className="flex flex-col gap-3 px-5 pb-6 pt-5">
        <span className="sr-only">Loading</span>
        <span aria-hidden="true" className={`h-5 w-2/5 rounded-full ${block}`} />
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden="true" className={`h-16 rounded-tile ${block}`} />
        ))}
      </div>
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
