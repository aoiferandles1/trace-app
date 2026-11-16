"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patient/PageHeader";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { TodayCard } from "@/components/patient/TodayCard";
import { Avatar, SectionHeading } from "@/components/ui/Card";
import { DateTile, DateTileRow } from "@/components/ui/DateTile";
import type { IconName } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { dayKey, daysUntil, formatShortDate, formatTime, greetingFor } from "@/lib/dates";
import { formatCountdown, formatCountdownSpoken, initialsOf } from "@/lib/format";
import {
  ENTRY_KIND_LABEL,
  entryIcon,
  entryTitle,
  formatAtPrecision,
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
import {
  doseKey,
  ShareCard,
  SinceLastVisit,
  TodaysMedicines,
  type DoseLog,
  type DoseSlot,
  type SinceItem,
} from "./_components/HomeSections";

type HomeData = {
  /** Every entry later than now, soonest first. */
  upcoming: RecordEntry[];
  /** Every entry at or before now, newest first. */
  past: RecordEntry[];
  current: RecordMedication[];
  hasConditions: boolean;
  /** Visits that already had a share end: their today card is done. */
  sharedVisitIds: string[];
  /** The latest share that ended, for the share card's "Last shared with". */
  lastShare: { name: string; endedAt: string } | null;
  /** The day (Irish time) the doses below are for. */
  today: string;
  /** Doses ticked today; null when the log can't be read (the list then has no ticks). */
  doses: DoseLog | null;
};

async function loadHome(): Promise<HomeData> {
  const db = createClient();
  const today = dayKey(new Date());
  const [record, ended, last, taken] = await Promise.all([
    loadSections("overview", "full_timeline"),
    db.from("share_sessions").select("appointment_entry_id").eq("status", "ended").not("appointment_entry_id", "is", null),
    db
      .from("share_sessions")
      .select("clinician_name, ended_at")
      .eq("status", "ended")
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(1),
    db.from("medication_doses").select("medication_id, slot, taken_at").eq("taken_on", today),
  ]);
  const lastRow = must(last)[0];
  return {
    upcoming: record.overview.recent_visits?.upcoming ?? [],
    past: record.full_timeline.visits,
    current: record.overview.medications,
    hasConditions: (record.overview.conditions?.length ?? 0) > 0,
    sharedVisitIds: must(ended).map((r) => r.appointment_entry_id!),
    lastShare: lastRow ? { name: clinicianName(lastRow), endedAt: lastRow.ended_at! } : null,
    today,
    // A failed read only costs the ticks, never Home.
    doses: taken.error
      ? null
      : Object.fromEntries(taken.data.map((d) => [doseKey(d.medication_id, d.slot as DoseSlot), d.taken_at])),
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

/** "8 days", "1 day", "Today", "Overdue". */
function daysText(days: number): string {
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}


/**
 * Home (board MainA2), three states (PLAN.md section 7):
 * - normal day: the greeting, the white share card ("Share your record",
 *   who it was last shared with), Today's medicines, Coming up, then
 *   "Since your last visit";
 * - appointment day: a visit falls today (Irish time) and no share for it has
 *   ended, so the today card with "Share record" sits at the top, with
 *   "Before you go in" (the same list) right under it;
 * - a share in progress (active, or paused at Time's up): the same card
 *   shows who has access and the time left, and leads to /session. It takes
 *   the live banner's place on this screen, so the two do not repeat.
 * Sharing is on Home every day (owner's choice, Nov 2026: the Home mockups'
 * Ideas 1, 4 and 6 combined).
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
          action={
            name ? (
              <Link href="/profile" className="rounded-full">
                <span aria-hidden="true">
                  <Avatar initials={initialsOf(name)} size={40} tone="outline" />
                </span>
                <span className="sr-only">Profile</span>
              </Link>
            ) : undefined
          }
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
      // An overdue refill stays, first, until it is marked refilled on the medication.
      .filter((m) => m.refill_due_on)
      .map((m) => ({ kind: "refill" as const, day: m.refill_due_on!, med: m })),
    ...data.upcoming
      .filter((e) => e.id !== featured?.id)
      .map((e) => ({ kind: "entry" as const, day: dayKey(e.occurs_at), entry: e })),
  ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const isEmpty = data.past.length === 0 && data.upcoming.length === 0 && data.current.length === 0 && !data.hasConditions;
  // A visit today, or a doctor with access: what changed goes first, ready for the doctor.
  const prep = Boolean(live || featured);
  const since = sinceLastVisit(data, today, featured?.id);

  const sinceSection = since.visit ? (
    <SinceLastVisit
      items={since.items}
      title={prep ? "Before you go in" : "Since your last visit"}
      meta={`${prep ? "Since " : ""}${formatShortDate(since.visit.occurs_at)}`}
    />
  ) : (
    // No past visit yet: the latest few entries, as Recent always showed.
    <SinceLastVisit items={since.items} title="Recent" />
  );

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
      ) : isEmpty ? null : (
        <ShareCard lastShare={data.lastShare} />
      )}

      {isEmpty && <FirstSteps />}

      {prep && sinceSection}

      <TodaysMedicines meds={data.current} today={data.today} doses={data.doses} />

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
                    href={`/record/${item.entry.id}?back=/home`}
                  />
                </li>
              );
            })}
          </DateTileRow>
        </section>
      )}

      {!prep && sinceSection}
    </div>
  );
}

/** At most this many rows in "Since your last visit" (Home stays short; Record has the rest). */
const SINCE_LIMIT = 5;

/**
 * The last visit before today, and what was added on or after its day,
 * newest first: results, notes, prescriptions, a doctor's notes and the
 * like (not visits), and every strength change or new medication. With no
 * past visit, `visit` is null and the items are the latest three entries.
 */
function sinceLastVisit(data: HomeData, today: string, featuredId?: string): { visit: RecordEntry | null; items: SinceItem[] } {
  const entryItem = (e: RecordEntry): SinceItem => ({
    key: e.id,
    day: dayKey(e.occurs_at),
    date: formatShortDate(e.occurs_at),
    icon: entryIcon(e),
    title: entryTitle(e),
    caption: e.kind === "note" ? "Your note" : ENTRY_KIND_LABEL[e.kind],
    href: `/record/${e.id}?back=/home`,
  });
  const visit = data.past.find((e) => e.kind === "visit" && dayKey(e.occurs_at) < today) ?? null;
  if (!visit) {
    return { visit: null, items: data.past.filter((e) => e.id !== featuredId).slice(0, 3).map(entryItem) };
  }
  const from = dayKey(visit.occurs_at);
  const entries = data.past.filter((e) => e.kind !== "visit" && dayKey(e.occurs_at) >= from).map(entryItem);
  const changes = data.current.flatMap((m) =>
    m.periods
      .filter((p) => p.start_date >= from)
      .map((p): SinceItem => {
        const first = p.id === m.periods[m.periods.length - 1]?.id;
        return {
          key: p.id,
          day: p.start_date,
          date: formatAtPrecision(p.start_date, p.date_precision, false),
          icon: "pill",
          title: first ? `Started ${m.name} ${p.strength_label}` : `${m.name} now ${p.strength_label}`,
          caption: first ? "New medication" : "Strength change",
          href: `/meds/${m.id}`,
        };
      }),
  );
  const items = [...entries, ...changes].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, SINCE_LIMIT);
  return { visit, items };
}

/** An empty record: the first things to add, as links (sign-up's last step lists the same). */
function FirstSteps() {
  const { profile } = usePatientSession();
  const noSafety = !profile.blood_type && profile.allergies.length === 0 && profile.implants.length === 0;
  return (
    <section aria-labelledby="first-steps" className="flex flex-col gap-2">
      <SectionHeading id="first-steps">Start your record</SectionHeading>
      <Card as="ul">
        {noSafety && (
          <li>
            <ListRow icon="shield-alert" title="Add your critical safety details" caption="Blood type, allergies and implants" href="/profile/edit" chevron />
          </li>
        )}
        <li>
          <ListRow icon="pill" title="Add a medication" href="/add/medication" chevron />
        </li>
        <li>
          <ListRow icon="calendar" title="Add a visit" href="/add/appointment" chevron />
        </li>
        <li>
          <ListRow icon="pencil" title="Log a note" href="/add/note" chevron />
        </li>
      </Card>
    </section>
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
      action={{ href: "/session", label: paused ? "Decide now" : "Manage sharing", icon: "clock" }}
    />
  );
}

/** "Dr Hennessy no longer has access to your record." once, after a share ends (`?ended=<id>`). */
function EndedLine({ session }: { session: ShareSession | null }) {
  const params = useSearchParams();
  const { notice } = useShareSession();
  const id = params.get("ended");
  // The strip at the top already says it (ShareSession's notice).
  if (notice?.sessionId === id) return null;
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
