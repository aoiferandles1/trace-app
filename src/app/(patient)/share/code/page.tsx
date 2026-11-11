"use client";

import { Clock, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { useShareSession } from "@/components/patient/ShareSession";
import { SharedSummaryCard } from "@/components/patient/SharedSummaryCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { siteUrl } from "@/lib/env";
import { formatCountdown, formatCountdownSpoken } from "@/lib/format";
import {
  clinicianName,
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
import { DemoMarker, LoadStatus } from "../../_components/Screens";

/** "trace-app.vercel.app/view": the portal's address, from NEXT_PUBLIC_SITE_URL (PLAN.md Phase 9). */
function portalAddress(): string {
  let host = "";
  try {
    host = new URL(siteUrl()).host;
  } catch {
    host = typeof window === "undefined" ? "" : window.location.host;
  }
  return `${host}/view`;
}

/**
 * The code (p-code): four digits on indigo, the 5-minute countdown, and
 * Regenerate. The countdown runs from code_expires_at; the database decides
 * when the code has actually expired (my_share_session, polled every 3
 * seconds by ShareSessionProvider). When the doctor types it, the access
 * request sheet opens over this screen; after Allow the sheet goes to
 * /session.
 */
function CodeScreen() {
  const router = useRouter();
  const { profile } = usePatientSession();
  const { session, loaded, failed, setSession, refresh, announce } = useShareSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where this screen is not the right one any more.
  useEffect(() => {
    if (!loaded) return;
    if (!session) router.replace("/share");
    else if (session.status === "active" || session.status === "paused") router.replace("/session");
    else if (session.status === "ended") router.replace(`/session/ended?id=${session.id}`);
  }, [loaded, session, router]);

  const prefs = session ? prefsOf(session) : null;
  const rows = useShareSummary(prefs, profile, "items");

  async function regenerate(current: ShareSession) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("create_share_code", {
      ...prefsOf(current),
      ...(current.appointment_entry_id ? { appointment_entry_id: current.appointment_entry_id } : {}),
    });
    setBusy(false);
    if (rpcError || !data) {
      setError(shareErrorMessage(rpcError?.message));
      return;
    }
    const next = normaliseSession(data);
    setSession(next);
    if (next) announce(`New code ready: ${next.code.split("").join(" ")}.`);
  }

  const showable = session && ["code_issued", "requested", "expired", "cancelled", "denied"].includes(session.status);

  return (
    <PatientShell
      tone="indigo"
      header={
        <>
          <DemoMarker tone="indigo" />
          <ScreenHeader
            title="Share your record"
            tone="onDark"
            backHref={
              session?.appointment_entry_id ? `/share?appointment=${session.appointment_entry_id}` : "/share"
            }
            backLabel="Back to Confirm preferences"
          />
        </>
      }
    >
      {!showable ? (
        <LoadStatus tone="indigo" status={!loaded && failed ? "error" : "loading"} onRetry={() => void refresh()} />
      ) : (
        <CodeBody
          session={session}
          rows={rows}
          busy={busy}
          error={error}
          onRegenerate={() => regenerate(session)}
          onExpire={refresh}
        />
      )}
    </PatientShell>
  );
}

function CodeBody({
  session,
  rows,
  busy,
  error,
  onRegenerate,
  onExpire,
}: {
  session: ShareSession;
  rows: { label: string; detail: string }[] | null;
  busy: boolean;
  error: string | null;
  onRegenerate: () => void;
  onExpire: () => unknown;
}) {
  const usable = session.status === "code_issued" || session.status === "requested";
  const counting = session.status === "code_issued";
  const now = useNow(counting);
  const left = msUntil(session.code_expires_at, now);

  // At zero, ask the database (it decides whether the code has expired).
  useEffect(() => {
    if (counting && left === 0) onExpire();
  }, [counting, left, onExpire]);

  const finished =
    session.status === "expired"
      ? "This code has expired."
      : session.status === "cancelled"
        ? "This code was cancelled."
        : session.status === "denied"
          ? "You denied this request."
          : null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-2">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-[36px] font-light leading-[1.15] tracking-[-0.02em]">
          {finished ?? "Your code is ready."}
        </h2>
        <p className="text-body-lg">
          {finished
            ? "Make a new code when your doctor is ready."
            : `Show this to your doctor to enter it at ${portalAddress()}`}
        </p>
      </div>

      <div>
        <p className="sr-only">Your code: {session.code.split("").join(" ")}</p>
        <div aria-hidden="true" className={finished ? "grid grid-cols-4 gap-2.5 opacity-50" : "grid grid-cols-4 gap-2.5"}>
          {session.code.split("").map((d, i) => (
            <span
              key={i}
              className="flex aspect-[82/96] items-center justify-center rounded-card-tight bg-white font-display text-[56px] font-light text-indigo-700"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-[62px] items-center gap-3 rounded-md bg-indigo-accessible px-4 py-3">
        <Clock aria-hidden="true" className="size-6 shrink-0" />
        <p className="flex min-w-0 flex-1 flex-col text-body-tiny">
          {session.status === "requested" ? (
            <>
              <span>Code entered</span>
              <span className="font-bold">{clinicianName(session)} is asking</span>
            </>
          ) : usable ? (
            <>
              <span>Expires in</span>
              <span aria-hidden="true" className="font-bold">
                {formatCountdown(left)}
              </span>
              <span className="sr-only">{formatCountdownSpoken(left)}</span>
            </>
          ) : (
            <span className="font-bold">No longer works</span>
          )}
        </p>
        {finished ? null : (
          <Button
            variant="ghostOnDark"
            size="sm"
            onClick={onRegenerate}
            loading={busy}
          >
            Regenerate
          </Button>
        )}
      </div>

      {finished && (
        <Button variant="tertiary" size="lg" fullWidth onClick={onRegenerate} loading={busy} iconLeft={<RefreshCw aria-hidden="true" className="size-4" />}>
          Make a new code
        </Button>
      )}

      {error && (
        <HintStrip tone="danger" live="assertive">
          {error}
        </HintStrip>
      )}

      <SharedSummaryCard
        heading="Sharing preferences"
        rows={rows}
        notIncluded={notIncludedList(prefsOf(session)).join(" · ")}
      />

      {finished && (
        <ButtonLink href="/home" variant="ghostOnDark" size="md" className="self-center">
          Back to home
        </ButtonLink>
      )}
    </div>
  );
}

export default function ShareCodePage() {
  return (
    <SessionReady>
      <CodeScreen />
    </SessionReady>
  );
}
