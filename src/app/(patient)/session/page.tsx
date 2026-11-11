"use client";

import { Icon } from "@/components/ui/Icon";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { SharedSummaryCard } from "@/components/patient/SharedSummaryCard";
import { IconLink } from "@/components/ui/IconButton";
import { Avatar } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Notice } from "@/components/ui/Notice";
import { ThemeColor } from "@/components/ui/ThemeColor";
import { formatTime } from "@/lib/dates";
import { initialsOf } from "@/lib/format";
import {
  clinicianName,
  hardEndOf,
  hasNotes,
  minutesBetween,
  msUntil,
  normaliseSession,
  prefsOf,
  shareErrorMessage,
  sharedScopes,
  type ShareSession,
} from "@/lib/patient/share";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { useNow } from "@/lib/useNow";
import { DemoMarker, LoadStatus } from "../_components/Screens";

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
  const { session, loaded, failed, setSession, refresh } = useShareSession();
  const [busy, setBusy] = useState<"end" | 15 | 30 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    // Back to the bright app, with one line saying the share ended (BRIEF.md section 5.5).
    if (session?.status === "ended") router.replace(`/home?ended=${session.id}`);
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
    <PatientShell tone="session" demo={<DemoMarker tone="session" />}>
      <ThemeColor tone="session" />
      {!open ? (
        <LoadStatus tone="session" status={!loaded && failed ? "error" : "loading"} onRetry={() => void refresh()} />
      ) : open.status === "active" ? (
        <Active session={open} busy={busy === "end"} error={error} onEnd={end} onExpire={refresh} />
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
  onExpire: () => unknown;
}) {
  const name = clinicianName(session);
  const manual = session.duration_kind === "manual";
  const now = useNow(!manual);
  const left = msUntil(session.expires_at, now);
  const total = Math.max(1, Date.parse(session.expires_at ?? "") - Date.parse(session.approved_at ?? ""));
  const endsAt = manual ? hardEndOf(session) : session.expires_at;
  const visit = useAppointmentTitle(session.appointment_entry_id);

  useEffect(() => {
    if (!manual && left === 0) onExpire();
  }, [manual, left, onExpire]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
      <BackToHome />
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Avatar initials={initialsOf(name)} size={88} tone="session" display />
        <h1 className="font-display text-title font-light">
          {name}
          <br />
          has access
        </h1>
        <p className="text-caption text-on-session-2">
          {[session.clinician_practice, visit].filter(Boolean).join(", ")}
        </p>
      </div>

      {manual ? (
        <p className="flex items-baseline justify-between text-caption">
          <span className="text-on-session-2">Time left</span>
          <span className="font-semibold">Until you end it</span>
        </p>
      ) : (
        <Countdown msLeft={left} msTotal={total} tone="session" label="Time left" />
      )}

      <SharedSummaryCard
        heading={`${name} can see`}
        rows={sharedScopes(prefsOf(session)).map((s) => ({ label: s.label }))}
      />
      {error && (
        <Notice tone="critical" live="assertive" surface="session">
          {error}
        </Notice>
      )}
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-2">
        <Button variant="primary" tone="session" size="lg" fullWidth onClick={onEnd} loading={busy}>
          End sharing now
        </Button>
        {endsAt && <p className="text-center text-caption text-on-session-2">Access ends at {formatTime(endsAt)}</p>}
      </div>
    </div>
  );
}

/**
 * The way back to the app while a share runs: a 32px chevron in the board's
 * 24px top gap (SessionA2 draws none; the tab bar is hidden here, so without
 * it the only way out would be the browser's Back).
 */
function BackToHome() {
  return (
    <div className="flex h-11 items-center">
      <IconLink href="/home" icon="chevron-down" label="Back to Home" size={32} tone="session" className="-ml-1.5" />
    </div>
  );
}

/** "GP visit": the title of the visit the share was started from, if any. */
function useAppointmentTitle(id: string | null): string | null {
  const data = useLoad(async () => {
    if (!id) return null;
    const { data } = await createClient().from("entries").select("title").eq("id", id).maybeSingle();
    return data?.title ?? null;
  }, [id]);
  return data.status === "ready" ? data.data : null;
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
    <div className="flex flex-1 flex-col gap-5 px-5 pb-10 pt-1">
      <BackToHome />
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <Icon name="clock" size={40} strokeWidth={1.5} />
        <h1 className="font-display text-title font-light">Time&apos;s up</h1>
        <p className="text-body-lg text-on-session-2">
          {name}&apos;s access has been paused. Your record is no longer visible until you decide.
        </p>
      </div>

      <p className="flex items-baseline justify-between border-y border-on-session-border py-3 text-caption">
        <span className="text-on-session-2">Time used</span>
        <span className="font-semibold">
          {used} of {used} min
        </span>
      </p>

      <section aria-labelledby="extend-title" className="flex flex-col gap-1">
        <h2 id="extend-title" className="font-display text-heading font-light">
          Extend access
        </h2>
        <p className="text-caption text-on-session-2">Give {name} more time</p>
        <div className="mt-2 flex gap-2">
          <Button
            variant="primary"
            tone="session"
            size="md"
            className="flex-1"
            onClick={() => onExtend(15)}
            loading={busy === 15}
            disabled={busy !== null && busy !== 15}
          >
            Add 15 min
          </Button>
          <Button
            variant="primary"
            tone="session"
            size="md"
            className="flex-1"
            onClick={() => onExtend(30)}
            loading={busy === 30}
            disabled={busy !== null && busy !== 30}
          >
            Add 30 min
          </Button>
        </div>
      </section>

      <button
        type="button"
        onClick={onEnd}
        aria-busy={busy === "end" || undefined}
        disabled={busy !== null}
        className="flex min-h-16 items-center gap-3.5 border-y border-on-session-border py-2 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-row font-medium">Save and end</span>
          <span className="text-caption text-on-session-2">{notes ? "Session notes saved · access closed" : "Access closed"}</span>
        </span>
        <Icon name="chevron-right" size={20} />
      </button>

      {session.closes_at && (
        <p className="text-center text-caption text-on-session-2">
          If you don&apos;t decide, the session closes at {formatTime(session.closes_at)}.
        </p>
      )}
      {error && (
        <Notice tone="critical" live="assertive" surface="session">
          {error}
        </Notice>
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
