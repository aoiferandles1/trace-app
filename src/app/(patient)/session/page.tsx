"use client";

import { Check, ChevronRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { SessionStatusRow, SharedSummaryCard } from "@/components/patient/SharedSummaryCard";
import { Avatar } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { formatTime } from "@/lib/dates";
import { formatCountdown, formatCountdownSpoken, initialsOf } from "@/lib/format";
import {
  clinicianName,
  formatRemaining,
  hardEndOf,
  hasNotes,
  minutesBetween,
  msUntil,
  normaliseSession,
  notIncludedList,
  prefsOf,
  shareErrorMessage,
  type ShareSession,
} from "@/lib/patient/share";
import { useShareSummary } from "@/lib/patient/useShareSummary";
import { createClient } from "@/lib/supabase/client";
import { useNow } from "@/lib/useNow";
import { DemoMarker } from "../_components/Screens";

/**
 * The live session (p-active) and Time's up (p-paused), on full-bleed indigo.
 *
 * The countdown runs from expires_at; the database decides when access
 * pauses (ShareSessionProvider polls my_share_session every 3 seconds, and
 * the doctor's portal polls too). When the session ends, by either side or
 * the timer, this screen moves on to /session/ended.
 */
function SessionScreen() {
  const router = useRouter();
  const { session, loaded, setSession, refresh } = useShareSession();
  const [busy, setBusy] = useState<"end" | 15 | 30 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (session?.status === "ended") router.replace(`/session/ended?id=${session.id}`);
    else if (session?.status === "code_issued" || session?.status === "requested") router.replace("/share/code");
    else if (!session || !["active", "paused"].includes(session.status)) router.replace("/home");
  }, [loaded, session, router]);

  async function end() {
    setBusy("end");
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("end_session");
    setBusy(null);
    if (rpcError) {
      setError(shareErrorMessage(rpcError.message));
      return;
    }
    const next = normaliseSession(data);
    if (next) setSession(next);
    else await refresh();
  }

  async function extend(minutes: 15 | 30) {
    setBusy(minutes);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("extend_session", { minutes });
    setBusy(null);
    if (rpcError) {
      setError(shareErrorMessage(rpcError.message));
      if (rpcError.message === "no_live_session") await refresh();
      return;
    }
    setSession(normaliseSession(data));
  }

  const open = session && (session.status === "active" || session.status === "paused") ? session : null;

  return (
    <PatientShell tone="indigo" header={<DemoMarker tone="indigo" />}>
      {!open ? (
        <p role="status" className="px-5 py-10 text-center text-body-sm">
          Loading&hellip;
        </p>
      ) : open.status === "active" ? (
        <Active session={open} busy={busy === "end"} error={error} onEnd={end} onExpire={() => void refresh()} />
      ) : (
        <Paused session={open} busy={busy} error={error} onEnd={end} onExtend={extend} />
      )}
    </PatientShell>
  );
}

function Active({
  session,
  busy,
  error,
  onEnd,
  onExpire,
}: {
  session: ShareSession;
  busy: boolean;
  error: string | null;
  onEnd: () => void;
  onExpire: () => void;
}) {
  const { profile } = usePatientSession();
  const name = clinicianName(session);
  const manual = session.duration_kind === "manual";
  const now = useNow(!manual);
  const left = msUntil(session.expires_at, now);
  const total = Math.max(1, Date.parse(session.expires_at ?? "") - Date.parse(session.approved_at ?? ""));
  const fraction = manual ? 1 : Math.min(1, left / total);
  const rows = useShareSummary(prefsOf(session), profile, "diagnoses");
  const endsAt = manual ? hardEndOf(session) : session.expires_at;

  useEffect(() => {
    if (!manual && left === 0) onExpire();
  }, [manual, left, onExpire]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] px-4 pb-6 pt-2">
        <SessionStatusRow
          label="Session active"
          dot="teal"
          minimiseHref="/home"
          time={manual ? undefined : formatCountdown(left)}
          timeLabel={manual ? undefined : `${formatCountdownSpoken(left)} left`}
        />
        <div className="flex flex-col items-center gap-3.5 pb-2 pt-5 text-center">
          <Avatar initials={initialsOf(name)} size="xl" tone="onDark" />
          <h1 className="font-display text-[30px] font-light leading-9">
            {name}
            <br />
            has access
          </h1>
          <p className="text-body-tiny">{[session.clinician_practice, "GP visit"].filter(Boolean).join(" · ")}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-md bg-indigo-accessible p-3">
          <p className="flex items-center justify-between gap-3 text-body-tiny">
            <span className="font-medium">Time remaining</span>
            {manual ? (
              <span className="font-bold">Until you end it</span>
            ) : (
              <>
                <span aria-hidden="true" className="font-bold">
                  {formatRemaining(left)}
                </span>
                <span className="sr-only">{formatCountdownSpoken(left)}</span>
              </>
            )}
          </p>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-indigo-surface-dark">
            <div className="h-full rounded-full bg-white" style={{ width: `${fraction * 100}%` }} />
          </div>
        </div>

        <SharedSummaryCard
          heading={`${name} can see`}
          rows={rows}
          notIncluded={notIncludedList(prefsOf(session)).join(" · ")}
        />
        {error && (
          <HintStrip tone="danger" live="assertive">
            {error}
          </HintStrip>
        )}
      </div>
      <div className="sticky bottom-0 flex flex-col items-center gap-3 bg-indigo-surface-dark px-4 pb-8 pt-3">
        <Button variant="tertiary" size="lg" fullWidth onClick={onEnd} loading={busy}>
          End sharing now
        </Button>
        {endsAt && <p className="text-center text-body-tiny">Access ends automatically at {formatTime(endsAt)}</p>}
      </div>
    </>
  );
}

function Paused({
  session,
  busy,
  error,
  onEnd,
  onExtend,
}: {
  session: ShareSession;
  busy: "end" | 15 | 30 | null;
  error: string | null;
  onEnd: () => void;
  onExtend: (minutes: 15 | 30) => void;
}) {
  const name = clinicianName(session);
  const used = minutesBetween(session.approved_at, session.paused_at ?? session.expires_at);
  const notes = session.allow_notes && hasNotes(session);
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-10 pt-2">
      <SessionStatusRow label="Session paused" dot="peach" time="00:00" timeLabel="No time left" />
      <div className="flex flex-col items-center gap-5 pt-8 text-center">
        <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-brand-indigo">
          <Clock className="size-8" />
        </span>
        <h1 className="font-display text-[44px] font-light leading-[1.1]">Time&rsquo;s up.</h1>
        <p className="text-body-lg">
          {name}&rsquo;s access has been paused. Your record is no longer visible until you decide.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-indigo-accessible p-3">
        <p className="flex items-center justify-between gap-3 text-body-tiny">
          <span className="font-medium">Time used</span>
          <span className="font-medium">
            {used} of {used} min
          </span>
        </p>
        <div aria-hidden="true" className="h-1.5 rounded-full bg-white" />
      </div>

      <section aria-labelledby="extend-title" className="flex gap-3.5 rounded-card bg-indigo-accessible p-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-indigo-surface-dark">
          <Clock className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="extend-title" className="text-body-sm font-bold">
            Extend access
          </h2>
          <p className="text-body-tiny">Give {name} more time</p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => onExtend(15)}
              loading={busy === 15}
              disabled={busy !== null && busy !== 15}
              aria-label="Add 15 minutes"
            >
              +15m
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => onExtend(30)}
              loading={busy === 30}
              disabled={busy !== null && busy !== 30}
              aria-label="Add 30 minutes"
            >
              +30m
            </Button>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={onEnd}
        aria-busy={busy === "end" || undefined}
        disabled={busy !== null}
        className="flex items-center gap-3.5 rounded-card bg-indigo-accessible p-4 text-left hovered:bg-indigo-600"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-indigo-surface-dark">
          <Check className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-sm font-bold">Save and end</span>
          <span className="text-body-tiny">{notes ? "Session notes saved · access closed" : "Access closed"}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </button>

      {session.closes_at && (
        <p className="text-center text-body-tiny">
          If you don&rsquo;t decide, the session closes at {formatTime(session.closes_at)}.
        </p>
      )}
      {error && (
        <HintStrip tone="danger" live="assertive">
          {error}
        </HintStrip>
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <SessionReady>
      <SessionScreen />
    </SessionReady>
  );
}
