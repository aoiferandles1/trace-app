"use client";

import { PageHeader } from "@/components/patient/PageHeader";
import { QuickActionTile } from "@/components/patient/QuickActionTile";
import { StatTile } from "@/components/patient/StatTile";
import { ENTRY_KINDS } from "@/components/patient/TimelineItem";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ShareTodayCard } from "@/components/patient/ShareTodayCard";
import { useShareSession } from "@/components/patient/ShareSession";
import { BannerCard } from "@/components/ui/BannerCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import {
  dayKey,
  daysUntil,
  formatHeaderDate,
  formatShortDate,
  formatTime,
  formatWeekdayDate,
  greetingFor,
} from "@/lib/dates";
import { isCurrentMedication, medicationName, type Entry, type Medication } from "@/lib/patient/types";
import { formatCountdown, formatCountdownSpoken } from "@/lib/format";
import { clinicianName, isOpen, msUntil, type ShareSession } from "@/lib/patient/share";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { useNow } from "@/lib/useNow";
import { LoadStatus, TabScreen } from "../_components/Screens";

type HomeData = {
  entries: Entry[];
  medications: Medication[];
  conditionCount: number;
  /** Visits that already had a share end: their appointment-day card is done. */
  sharedVisitIds: string[];
};

async function loadHome(): Promise<HomeData> {
  const supabase = createClient();
  const [entries, medications, conditions, ended] = await Promise.all([
    supabase.from("entries").select("*").order("occurs_at", { ascending: false }),
    supabase.from("medications").select("*"),
    supabase.from("conditions").select("id", { count: "exact", head: true }),
    supabase
      .from("share_sessions")
      .select("appointment_entry_id")
      .eq("status", "ended")
      .not("appointment_entry_id", "is", null),
  ]);
  if (conditions.error) throw conditions.error;
  return {
    entries: must(entries) as Entry[],
    medications: must(medications),
    conditionCount: conditions.count ?? 0,
    sharedVisitIds: must(ended).map((r) => r.appointment_entry_id!),
  };
}

/** "8 days", "1 day", "Today". */
function daysText(days: number): string {
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Home, three states (PLAN.md section 7):
 * - normal (p-home): the Upcoming card for the next visit;
 * - appointment day (p-apptday): a visit falls today (Irish time) and no
 *   share for it has ended, so <ShareTodayCard> sits at the top instead;
 * - live (p-home-live): while a doctor has access (active, or paused at
 *   Time's up), the "Sharing in progress" card sits at the top, and the
 *   banner comes from LiveBannerSlot.
 * Nothing here offers a share button on other days: that is Profile's
 * "Share my record".
 */
function HomeScreen() {
  const { profile } = usePatientSession();
  const share = useShareSession();
  // Re-read when a session ends, so a finished visit's card goes away.
  const endedId = share.session?.status === "ended" ? share.session.id : null;
  const data = useLoad(loadHome, [endedId]);
  const now = new Date();
  const today = dayKey(now);
  const greeting = `${greetingFor(now)}${profile.first_name ? `, ${profile.first_name}` : ""}`;

  return (
    <TabScreen header={<PageHeader variant="greeting" title={greeting} subtitle={formatHeaderDate(now)} />}>
      {data.status !== "ready" || !share.loaded ? (
        <LoadStatus status={data.status === "ready" ? "loading" : data.status} onRetry={data.reload} />
      ) : (
        <HomeBody data={data.data} today={today} now={now} share={share.session} />
      )}
    </TabScreen>
  );
}

function HomeBody({
  data,
  today,
  now,
  share,
}: {
  data: HomeData;
  today: string;
  now: Date;
  share: ShareSession | null;
}) {
  const monthPrefix = today.slice(0, 7);
  const addedThisMonth = data.entries.filter((e) => dayKey(e.created_at).startsWith(monthPrefix)).length;
  const current = data.medications.filter((m) => isCurrentMedication(m, today));
  const refill = current
    .filter((m) => m.refill_due_on && m.refill_due_on >= today)
    .sort((a, b) => (a.refill_due_on! < b.refill_due_on! ? -1 : 1))[0];
  const refillDays = refill ? daysUntil(refill.refill_due_on!) : null;

  const nowIso = now.toISOString();
  const nextVisit = data.entries
    .filter((e) => e.kind === "visit" && e.occurs_at > nowIso)
    .sort((a, b) => (a.occurs_at < b.occurs_at ? -1 : 1))[0];
  const done = new Set(data.sharedVisitIds);
  if (share?.status === "ended" && share.appointment_entry_id) done.add(share.appointment_entry_id);
  const todaysVisit = data.entries
    .filter((e) => e.kind === "visit" && dayKey(e.occurs_at) === today && !done.has(e.id))
    .sort((a, b) => (a.occurs_at < b.occurs_at ? -1 : 1))[0];
  const live = isOpen(share) ? share : null;
  const recent = data.entries.filter((e) => e.occurs_at <= nowIso).slice(0, 3);
  const isEmpty = data.entries.length === 0 && data.medications.length === 0 && data.conditionCount === 0;

  const upcomingCard = nextVisit ? (
    <BannerCard
      icon="calendar"
      eyebrow="Upcoming"
      title={[nextVisit.title, nextVisit.clinician].filter(Boolean).join(" · ")}
      meta={[formatWeekdayDate(nextVisit.occurs_at), formatTime(nextVisit.occurs_at), nextVisit.place]
        .filter(Boolean)
        .join(" · ")}
      badge={(() => {
        const d = daysUntil(dayKey(nextVisit.occurs_at));
        return d === 0 ? "Today" : `${d}d`;
      })()}
      badgeLabel={(() => {
        const d = daysUntil(dayKey(nextVisit.occurs_at));
        return d === 0 ? "today" : `in ${daysText(d).toLowerCase()}`;
      })()}
      href={`/record/${nextVisit.id}`}
    />
  ) : null;

  const topCard = live ? (
    <LiveCard session={live} />
  ) : todaysVisit ? (
    <ShareTodayCard
      time={formatTime(todaysVisit.occurs_at)}
      title={[todaysVisit.title, todaysVisit.clinician].filter(Boolean).join(" · ")}
      place={todaysVisit.place ?? undefined}
      href={`/share?appointment=${todaysVisit.id}`}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
      {topCard}
      <section aria-label="Your record at a glance" className={refill ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
        <StatTile value={addedThisMonth} label="added this month" />
        <StatTile value={current.length} label={current.length === 1 ? "medication" : "medications"} />
        {refill && refillDays !== null && (
          <StatTile value={daysText(refillDays)} label="until refill" urgent />
        )}
      </section>

      {isEmpty && (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col gap-3 rounded-card border border-border-card bg-surface p-5"
        >
          <h2 id="empty-title" className="font-display text-heading font-light">
            Your record is empty
          </h2>
          <p className="text-caption text-ink-2">
            Start with what you know: a medication you take, your next appointment, or a note for yourself.
          </p>
          <ButtonLink href="/add" className="w-fit">
            Add to my record
          </ButtonLink>
        </section>
      )}

      {!topCard && upcomingCard}

      <section aria-labelledby="quick-label" className="flex flex-col gap-3">
        <SectionHeading id="quick-label">Quick actions</SectionHeading>
        <ul className="grid grid-cols-2 gap-3">
          <li>
            <QuickActionTile href="/add/note" label="Add note" icon="pencil" />
          </li>
          <li>
            <QuickActionTile href="/add/appointment" label="Log appt" icon="calendar" />
          </li>
          <li>
            <QuickActionTile href="/meds" label="Prescriptions" icon="pill" />
          </li>
          <li>
            <QuickActionTile href="/record" label="My record" icon="record" />
          </li>
        </ul>
      </section>

      {refill && refillDays !== null && (
        <section aria-labelledby="upcoming-label" className="flex flex-col gap-3">
          <SectionHeading id="upcoming-label">Upcoming</SectionHeading>
          <BannerCard
            tone="urgent"
            icon="pill"
            eyebrow="Refill due soon"
            title={`${medicationName(refill)} · ${refillDays === 0 ? "due today" : `${daysText(refillDays)} left`}`}
            meta={[refill.prescriber, refill.prescriber_org].filter(Boolean).join(" · ") || undefined}
            badge={refillDays === 0 ? "Today" : `${refillDays}d`}
            badgeLabel={refillDays === 0 ? "due today" : `in ${daysText(refillDays)}`}
            href="/meds"
          />
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-label" className="flex flex-col gap-3">
          <SectionHeading id="recent-label">Recently added</SectionHeading>
          <Card as="ul">
            {recent.map((e) => {
              const k = ENTRY_KINDS[e.kind];
              const detail = e.kind === "note" ? e.body?.split("\n")[0] : e.place ?? e.clinician;
              return (
                <li key={e.id}>
                  <ListRow
                    icon={k.icon}
                    title={e.title}
                    caption={[k.label, detail].filter(Boolean).join(", ")}
                    value={formatShortDate(e.occurs_at)}
                    href={`/record/${e.id}`}
                  />
                </li>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}

/** "Sharing in progress" (p-home-live): leads to /session, with the time left. */
function LiveCard({ session }: { session: ShareSession }) {
  const paused = session.status === "paused";
  const manual = session.duration_kind === "manual";
  const ticking = !paused && !manual;
  const now = useNow(ticking);
  const left = msUntil(session.expires_at, now);
  const name = clinicianName(session);
  return (
    <BannerCard
      icon="share"
      eyebrow={paused ? "Time's up" : "Sharing in progress"}
      title={`${name} · GP visit`}
      meta={
        paused
          ? "Access paused · Decide now"
          : manual
            ? "No timer · View session"
            : `Ends at ${formatTime(session.expires_at!)} · View session`
      }
      badge={ticking ? formatCountdown(left) : undefined}
      badgeLabel={ticking ? `${formatCountdownSpoken(left)} left` : undefined}
      href="/session"
    />
  );
}

export default function HomePage() {
  return (
    <SessionReady>
      <HomeScreen />
    </SessionReady>
  );
}
