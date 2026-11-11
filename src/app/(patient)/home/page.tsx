"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patient/PageHeader";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { TodayCard } from "@/components/patient/TodayCard";
import { Avatar, Card, SectionHeading } from "@/components/ui/Card";
import { DateTile, DateTileRow } from "@/components/ui/DateTile";
import type { IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { StateMessage } from "@/components/ui/StateMessage";
import { dayKey, daysUntil, formatShortDate, formatTime, greetingFor } from "@/lib/dates";
import { formatCountdown, formatCountdownSpoken, initialsOf } from "@/lib/format";
import {
  ENTRY_KIND_LABEL,
  entryIcon,
  loadSections,
  URGENT_REFILL_DAYS,
  type RecordEntry,
  type RecordMedication,
} from "@/lib/patient/record";
import { clinicianName, isOpen, msUntil, type ShareSession } from "@/lib/patient/share";
import { fullName, isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { useNow } from "@/lib/useNow";
import { LoadStatus, TabScreen } from "../_components/Screens";

type HomeData = {
  /** Every entry later than now, soonest first. */
  upcoming: RecordEntry[];
  /** Every entry at or before now, newest first. */
  past: RecordEntry[];
  current: RecordMedication[];
  hasConditions: boolean;
  /** Visits that already had a share end: their today card is done. */
  sharedVisitIds: string[];
};

async function loadHome(): Promise<HomeData> {
  const [record, ended] = await Promise.all([
    loadSections("overview", "full_timeline"),
    createClient()
      .from("share_sessions")
      .select("appointment_entry_id")
      .eq("status", "ended")
      .not("appointment_entry_id", "is", null),
  ]);
  return {
    upcoming: record.overview.recent_visits?.upcoming ?? [],
    past: record.full_timeline.visits,
    current: record.overview.medications,
    hasConditions: (record.overview.conditions?.length ?? 0) > 0,
    sharedVisitIds: must(ended).map((r) => r.appointment_entry_id!),
  };
}

/** Coming up's icon for a visit (MainA2): a drop for a blood test, a heart for cardiology, else a calendar. */
function upcomingIcon(e: RecordEntry): IconName {
  if (e.kind !== "visit") return entryIcon(e);
  if (/\b(blood|inr)\b/i.test(e.title)) return "drop";
  if (/cardio|heart/i.test(e.title)) return "heart";
  return "calendar";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8 days", "1 day", "Today". */
function daysText(days: number): string {
  if (days <= 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}


/**
 * Home (board MainA2), three states (PLAN.md section 7):
 * - normal day: the greeting, Coming up and Recent;
 * - appointment day: a visit falls today (Irish time) and no share for it has
 *   ended, so the today card with "Share record" sits at the top;
 * - a share in progress (active, or paused at Time's up): the same card
 *   shows who has access and the time left, and leads to /session. It takes
 *   the live banner's place on this screen, so the two do not repeat.
 * On other days sharing starts from Profile's "Share my record".
 *
 * After a share ends, /session sends the patient here with `?ended=<id>`
 * and one line says so.
 */
function HomeScreen() {
  const { profile } = usePatientSession();
  const share = useShareSession();
  // Re-read when a session ends, so a finished visit's card goes away.
  const endedId = share.session?.status === "ended" ? share.session.id : null;
  const data = useLoad(loadHome, [endedId]);
  const now = new Date();
  const name = fullName(profile);
  const live = isOpen(share.session) ? share.session : null;

  return (
    <TabScreen
      banner={live ? null : undefined}
      header={
        <PageHeader
          variant="greeting"
          subtitle={greetingFor(now)}
          title={profile.first_name || "Welcome"}
          action={name ? <Avatar initials={initialsOf(name)} size={40} tone="outline" /> : undefined}
        />
      }
    >
      {data.status !== "ready" || !share.loaded ? (
        <LoadStatus status={data.status === "ready" ? "loading" : data.status} onRetry={data.reload} />
      ) : (
        <HomeBody data={data.data} now={now} share={share.session} live={live} />
      )}
    </TabScreen>
  );
}

function HomeBody({
  data,
  now,
  share,
  live,
}: {
  data: HomeData;
  now: Date;
  share: ShareSession | null;
  live: ShareSession | null;
}) {
  const today = dayKey(now);
  const done = new Set(data.sharedVisitIds);
  if (share?.status === "ended" && share.appointment_entry_id) done.add(share.appointment_entry_id);
  const todaysVisit = [...data.past, ...data.upcoming]
    .filter((e) => e.kind === "visit" && dayKey(e.occurs_at) === today && !done.has(e.id))
    .sort((a, b) => (a.occurs_at < b.occurs_at ? -1 : 1))[0];
  const featured = live ? null : todaysVisit;

  const comingUp = [
    ...data.current
      .filter((m) => m.refill_due_on && m.refill_due_on >= today)
      .map((m) => ({ kind: "refill" as const, day: m.refill_due_on!, med: m })),
    ...data.upcoming
      .filter((e) => e.id !== featured?.id)
      .map((e) => ({ kind: "entry" as const, day: dayKey(e.occurs_at), entry: e })),
  ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const recent = data.past.filter((e) => e.id !== featured?.id).slice(0, 3);
  const isEmpty = data.past.length === 0 && data.upcoming.length === 0 && data.current.length === 0 && !data.hasConditions;

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-5">
      <EndedLine session={share} />
      {live ? (
        <LiveCard session={live} />
      ) : featured ? (
        <TodayCard
          eyebrow={`${featured.title} today`}
          figure={formatTime(featured.occurs_at)}
          name={featured.clinician ?? undefined}
          place={featured.place ?? undefined}
          initials={featured.clinician ? initialsOf(featured.clinician) : undefined}
          action={{ href: `/share?appointment=${featured.id}`, label: "Share record" }}
        />
      ) : null}

      {isEmpty && (
        <StateMessage
          message="Your record is empty. Start with a medication, an appointment or a note."
          action={{ label: "Add to my record", href: "/add" }}
        />
      )}

      {comingUp.length > 0 && (
        <section aria-labelledby="coming-up" className="flex flex-col gap-2">
          <SectionHeading id="coming-up">Coming up</SectionHeading>
          <DateTileRow label="Coming up">
            {comingUp.map((item) => {
              const [, mm, dd] = item.day.split("-").map(Number);
              if (item.kind === "refill") {
                const days = daysUntil(item.day);
                return (
                  <li key={`refill-${item.med.id}`}>
                    <DateTile
                      icon="pill"
                      day={dd}
                      month={MONTHS[mm - 1]}
                      dateTime={item.day}
                      title={`${item.med.name} refill`}
                      urgent={days <= URGENT_REFILL_DAYS}
                      badge={days <= URGENT_REFILL_DAYS ? daysText(days) : undefined}
                      href={`/meds/${item.med.id}`}
                    />
                  </li>
                );
              }
              return (
                <li key={item.entry.id}>
                  <DateTile
                    icon={upcomingIcon(item.entry)}
                    day={dd}
                    month={MONTHS[mm - 1]}
                    dateTime={item.day}
                    title={item.entry.title}
                    href={`/record/${item.entry.id}`}
                  />
                </li>
              );
            })}
          </DateTileRow>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent" className="flex flex-col gap-2">
          <SectionHeading id="recent">Recent</SectionHeading>
          <Card as="ul">
            {recent.map((e) => (
              <li key={e.id}>
                <ListRow
                  icon={entryIcon(e)}
                  title={e.title}
                  caption={ENTRY_KIND_LABEL[e.kind]}
                  value={<time dateTime={dayKey(e.occurs_at)}>{formatShortDate(e.occurs_at)}</time>}
                  href={`/record/${e.id}`}
                  padY={12}
                />
              </li>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

/** While a doctor has access (or Time's up): the today card's pattern, leading to /session. */
function LiveCard({ session }: { session: ShareSession }) {
  const paused = session.status === "paused";
  const manual = session.duration_kind === "manual";
  const ticking = !paused && !manual;
  const now = useNow(ticking);
  const left = msUntil(session.expires_at, now);
  const name = clinicianName(session);
  return (
    <TodayCard
      eyebrow={paused ? `Time's up for ${name}` : `${name} has access`}
      figure={paused ? "0:00" : manual ? "No timer" : formatCountdown(left)}
      figureLabel={paused ? "No time left" : manual ? "No timer" : `${formatCountdownSpoken(left)} left`}
      name={paused ? "Your record is hidden" : manual ? "Until you end it" : `Ends at ${formatTime(session.expires_at!)}`}
      place={session.clinician_practice ?? undefined}
      initials={initialsOf(name)}
      action={{ href: "/session", label: paused ? "Decide now" : "View session", icon: "clock" }}
    />
  );
}

/** "Dr Hennessy no longer has access to your record." once, after a share ends (`?ended=<id>`). */
function EndedLine({ session }: { session: ShareSession | null }) {
  const params = useSearchParams();
  const id = params.get("ended");
  if (!id || !isUuid(id) || !session || session.id !== id || session.status !== "ended") return null;
  return (
    <Notice tone="neutral" icon="tick">
      {clinicianName(session)} no longer has access to your record.{" "}
      <Link href={`/session/ended?id=${id}`} className="font-semibold text-accent underline underline-offset-2">
        View summary
      </Link>
    </Notice>
  );
}

export default function HomePage() {
  return (
    <SessionReady>
      <HomeScreen />
    </SessionReady>
  );
}
