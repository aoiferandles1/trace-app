"use client";

import { Icon } from "@/components/ui/Icon";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { PageHeader } from "@/components/patient/PageHeader";
import { useShareSession } from "@/components/patient/ShareSession";
import { SharedSummaryCard } from "@/components/patient/SharedSummaryCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CodeDisplay } from "@/components/ui/CodeDisplay";
import { Notice } from "@/components/ui/Notice";
import { ThemeColor } from "@/components/ui/ThemeColor";
import { siteUrl } from "@/lib/env";
import { formatCountdown, formatCountdownSpoken } from "@/lib/format";
import {
  clinicianName,
  createCodeArgs,
  msUntil,
  normaliseSession,
  notSharedScopes,
  prefsOf,
  shareErrorMessage,
  type ShareSession,
} from "@/lib/patient/share";
import { useShareSummary, type SummaryRow } from "@/lib/patient/useShareSummary";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
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
  useLayoutEffect(() => () => setBusy(false), []);
  const doctor = useVisitClinician(session?.appointment_entry_id ?? null);

  // Where this screen is not the right one any more.
  useEffect(() => {
    if (!loaded) return;
    if (!session) router.replace("/share");
    else if (session.status === "active" || session.status === "paused") router.replace("/session");
    else if (session.status === "ended") router.replace(`/home?ended=${session.id}`);
  }, [loaded, session, router]);

  const prefs = session ? prefsOf(session) : null;
  const rows = useShareSummary(prefs, profile);

  async function regenerate(current: ShareSession) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc(
      "create_share_code",
      createCodeArgs(prefsOf(current), current.appointment_entry_id),
    );
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
      tone="session"
      demo={<DemoMarker tone="session" />}
      header={
        <>
          <ThemeColor tone="session" />
          <PageHeader
            title={doctor ? `Share with ${doctor}` : "Share your record"}
            size="md"
            tone="session"
            backHref={session?.appointment_entry_id ? `/share?appointment=${session.appointment_entry_id}` : "/share"}
            backLabel="Back to what you share"
          />
        </>
      }
    >
      {!showable ? (
        <LoadStatus tone="session" status={!loaded && failed ? "error" : "loading"} onRetry={() => void refresh()} />
      ) : (
        <CodeBody session={session} rows={rows} busy={busy} error={error} onRegenerate={() => regenerate(session)} onExpire={refresh} />
      )}
    </PatientShell>
  );
}

/** The doctor of the visit the share was started from, to name them in the title. */
function useVisitClinician(id: string | null): string | null {
  const data = useLoad(async () => {
    if (!id) return null;
    const { data } = await createClient().from("entries").select("clinician").eq("id", id).maybeSingle();
    return data?.clinician?.trim() || null;
  }, [id]);
  return data.status === "ready" ? data.data : null;
}

/** Copies text; false when the browser refuses. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
  rows: SummaryRow[] | null;
  busy: boolean;
  error: string | null;
  onRegenerate: () => void;
  onExpire: () => unknown;
}) {
  const usable = session.status === "code_issued" || session.status === "requested";
  const counting = session.status === "code_issued";
  const now = useNow(counting);
  const left = msUntil(session.code_expires_at, now);
  const [copied, setCopied] = useState<"code" | "address" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copyCode() {
    if (await copy(session.code)) setCopied("code");
  }

  async function sendAddress() {
    const url = `https://${portalAddress()}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Trace Portal", url });
        return;
      } catch {
        // Cancelled, or not allowed here: copy it instead.
      }
    }
    if (await copy(url)) setCopied("address");
  }

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
    // CodeA2: 18px between the header and the code, as between every group below it.
    <div className="flex flex-col gap-4.5 px-5 pb-8 pt-4.5">
      <div className="flex flex-col gap-3.5">
        {finished ? (
          <h2 className="font-display text-heading font-light">{finished}</h2>
        ) : (
          <p className="text-caption text-on-session-2">
            Your doctor enters this code at{" "}
            <button type="button" onClick={sendAddress} className="font-semibold text-white underline underline-offset-2 hit-area">
              {portalAddress()}
              <span className="sr-only">. Send the address</span>
            </button>
          </p>
        )}

        {finished ? (
          <CodeDisplay code={session.code} className="opacity-50" />
        ) : (
          <CodeDisplay code={session.code} onCopy={copyCode} />
        )}
        <p role="status" className="sr-only">
          {copied === "code" ? "Code copied." : copied === "address" ? "Address copied." : ""}
        </p>

        {!finished && (
          <div className="flex min-h-11 items-center justify-between gap-3 border-y border-on-session-border">
            <p className="text-label font-normal">
              {session.status === "requested" ? (
                <>
                  Code entered. <span className="font-semibold">{clinicianName(session)} is asking</span>
                </>
              ) : usable ? (
                <>
                  Expires in{" "}
                  <b aria-hidden="true" className="font-semibold tabular-nums">
                    {formatCountdown(left)}
                  </b>
                  <span className="sr-only">{formatCountdownSpoken(left)}</span>
                </>
              ) : null}
            </p>
            {copied ? (
              <span aria-hidden="true" className="text-label font-semibold">
                {copied === "code" ? "Copied" : "Address copied"}
              </span>
            ) : (
              <Button variant="text" tone="session" size="md" onClick={onRegenerate} loading={busy}>
                Regenerate
              </Button>
            )}
          </div>
        )}
      </div>

      {finished && (
        <Button
          variant="primary"
          tone="session"
          size="lg"
          fullWidth
          onClick={onRegenerate}
          loading={busy}
          iconLeft={<Icon name="refresh" size={18} />}
        >
          Make a new code
        </Button>
      )}

      {error && (
        <Notice tone="critical" live="assertive" surface="session">
          {error}
        </Notice>
      )}

      <SharedSummaryCard
        heading="Sharing"
        headingStyle="heading"
        rows={rows}
        notIncluded={notSharedScopes(prefsOf(session)).map((s) => s.label)}
      />

      {finished && (
        <ButtonLink href="/home" variant="text" tone="session" size="md" className="self-center">
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
