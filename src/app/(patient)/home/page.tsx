"use client";

import { Activity, CalendarDays, Clock, FileText } from "lucide-react";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { ListItemCard } from "@/components/patient/ListItemCard";
import { QuickActionTile } from "@/components/patient/QuickActionTile";
import { StatTile } from "@/components/patient/StatTile";
import { ENTRY_KINDS } from "@/components/patient/TimelineItem";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { BannerCard } from "@/components/ui/BannerCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
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
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { LoadStatus, TabScreen } from "../_components/Screens";

type HomeData = { entries: Entry[]; medications: Medication[]; conditionCount: number };

async function loadHome(): Promise<HomeData> {
  const supabase = createClient();
  const [entries, medications, conditions] = await Promise.all([
    supabase.from("entries").select("*").order("occurs_at", { ascending: false }),
    supabase.from("medications").select("*"),
    supabase.from("conditions").select("id", { count: "exact", head: true }),
  ]);
  if (conditions.error) throw conditions.error;
  return {
    entries: must(entries) as Entry[],
    medications: must(medications),
    conditionCount: conditions.count ?? 0,
  };
}

/** "8 days", "1 day", "Today". */
function daysText(days: number): string {
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Home (p-home), normal state.
 *
 * Phase 5 adds two more states on this screen (PLAN.md section 7):
 * - appointment day: when `todaysVisit` is set and no share for it has
 *   ended, <ShareTodayCard> replaces the Upcoming card;
 * - live: a "Sharing in progress" BannerCard (and the banner, through
 *   LiveBannerSlot) while a session is active.
 * Both slot in where `upcomingCard` renders below. Nothing here offers a
 * share button on other days.
 */
function HomeScreen() {
  const { profile } = usePatientSession();
  const data = useLoad(loadHome);
  const now = new Date();
  const today = dayKey(now);
  const greeting = `${greetingFor(now)}${profile.first_name ? `, ${profile.first_name}` : ""}`;

  return (
    <TabScreen header={<ScreenHeader variant="greeting" title={greeting} subtitle={formatHeaderDate(now)} />}>
      {data.status !== "ready" ? (
        <LoadStatus status={data.status} onRetry={data.reload} />
      ) : (
        <HomeBody data={data.data} today={today} now={now} />
      )}
    </TabScreen>
  );
}

function HomeBody({ data, today, now }: { data: HomeData; today: string; now: Date }) {
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
  // Phase 5 seam: the visit that drives the appointment-day card.
  // const todaysVisit = data.entries.find((e) => e.kind === "visit" && dayKey(e.occurs_at) === today);
  const recent = data.entries.filter((e) => e.occurs_at <= nowIso).slice(0, 3);
  const isEmpty = data.entries.length === 0 && data.medications.length === 0 && data.conditionCount === 0;

  const upcomingCard = nextVisit ? (
    <BannerCard
      tone="indigo"
      icon={<CalendarDays />}
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
      className="py-6"
    />
  ) : null;

  return (
    <div className="flex flex-col gap-8 px-4 pb-8 pt-4">
      <section aria-label="Your record at a glance" className={refill ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
        <StatTile value={addedThisMonth} label="added this month" />
        <StatTile value={current.length} label={current.length === 1 ? "medication" : "medications"} />
        {refill && refillDays !== null && (
          <StatTile value={daysText(refillDays)} label="until refill" tone="peach" />
        )}
      </section>

      {isEmpty && (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col gap-3 rounded-card border border-border-default bg-surface-card p-5 shadow-sm"
        >
          <h2 id="empty-title" className="text-h4 font-bold">
            Your record is empty
          </h2>
          <p className="text-body-sm text-text-tertiary">
            Start with what you know: a medication you take, your next appointment, or a note for yourself.
          </p>
          <ButtonLink href="/add" className="w-fit">
            Add to my record
          </ButtonLink>
        </section>
      )}

      {upcomingCard}

      <section aria-labelledby="quick-label" className="flex flex-col gap-3">
        <SectionLabel id="quick-label">Quick actions</SectionLabel>
        <ul className="grid grid-cols-4 gap-2">
          <li>
            <QuickActionTile href="/add/note" label="Add note" icon={<FileText />} tone="indigo" />
          </li>
          <li>
            <QuickActionTile href="/add/appointment" label="Log appt" icon={<CalendarDays />} tone="peach" />
          </li>
          <li>
            <QuickActionTile href="/meds" label="Prescriptions" icon={<Clock />} tone="indigo" />
          </li>
          <li>
            <QuickActionTile href="/record" label="My record" icon={<Activity />} tone="neutral" />
          </li>
        </ul>
      </section>

      {refill && refillDays !== null && (
        <section aria-labelledby="upcoming-label" className="flex flex-col gap-3">
          <SectionLabel id="upcoming-label">Upcoming</SectionLabel>
          <BannerCard
            tone="peach"
            icon={<Clock />}
            eyebrow="Refill due soon"
            eyebrowCaps
            title={`${medicationName(refill)} · ${refillDays === 0 ? "due today" : `${daysText(refillDays)} left`}`}
            meta={[refill.prescriber, refill.prescriber_org].filter(Boolean).join(" · ") || undefined}
            badge={refillDays === 0 ? "Today" : `${refillDays}d`}
            badgeLabel={refillDays === 0 ? "due today" : `in ${daysText(refillDays)}`}
            href="/meds"
            className="py-6"
          />
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-label" className="flex flex-col gap-3">
          <SectionLabel id="recent-label">Recently added</SectionLabel>
          <ul className="flex flex-col gap-3">
            {recent.map((e) => {
              const k = ENTRY_KINDS[e.kind];
              const detail = e.kind === "note" ? e.body?.split("\n")[0] : e.place ?? e.clinician;
              return (
                <li key={e.id}>
                  <ListItemCard
                    title={e.title}
                    tone={k.tone}
                    tag={{ label: k.label }}
                    meta={[formatShortDate(e.occurs_at), detail].filter(Boolean).join(" · ")}
                    href={`/record/${e.id}`}
                    chevronTone={k.tone}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <SessionReady>
      <HomeScreen />
    </SessionReady>
  );
}
