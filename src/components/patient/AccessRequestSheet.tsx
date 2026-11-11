"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { createClient } from "@/lib/supabase/client";
import {
  clinicianName,
  durationLabel,
  joinAnd,
  normaliseSession,
  notIncludedList,
  prefsOf,
  shareContext,
  shareErrorMessage,
  sharedList,
} from "@/lib/patient/share";
import { AccessRequestDetails } from "./AccessRequestDetails";
import { useShareSession } from "./ShareSession";

/**
 * The access request (p-request): a modal bottom sheet over whatever screen
 * is open when a doctor types the code. It opens whenever the share session
 * is `requested` and closes by itself when that stops being true (the doctor
 * cancelled, or 5 minutes passed).
 *
 * Nothing opens until the patient taps Allow; Deny sits under it with equal
 * weight (PLAN.md section 2). Escape and the backdrop do nothing: the patient
 * answers with a button. Focus starts on the request itself, not on Allow, so
 * a stray Enter cannot grant access.
 */
export function AccessRequestSheet() {
  const router = useRouter();
  const { session, setSession, refresh, announce } = useShareSession();
  const [busyState, setBusyState] = useState<{ id: string; what: "allow" | "deny" } | null>(null);
  const [errorState, setErrorState] = useState<{ id: string; text: string } | null>(null);
  const open = session?.status === "requested";
  if (!session) return null;
  // Both belong to one request; a new request starts clean.
  const busy = busyState?.id === session.id ? busyState.what : null;
  const error = errorState?.id === session.id ? errorState.text : null;
  const id = session.id;
  const setBusy = (what: "allow" | "deny" | null) => setBusyState(what ? { id, what } : null);
  const setError = (text: string | null) => setErrorState(text ? { id, text } : null);

  async function respond(allow: boolean) {
    if (!session) return;
    setBusy(allow ? "allow" : "deny");
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("respond_to_request", {
      session_id: session.id,
      allow,
    });
    setBusy(null);
    if (rpcError) {
      if (rpcError.message === "not_requested" || rpcError.message === "not_found") {
        announce(shareErrorMessage("not_requested"));
        await refresh();
        return;
      }
      setError(shareErrorMessage(rpcError.message));
      return;
    }
    const next = normaliseSession(data);
    setSession(next);
    if (allow) router.push("/session");
    else {
      announce(`You denied access. ${clinicianName(session)} cannot see your record.`);
      router.push("/home");
    }
  }

  const prefs = prefsOf(session);
  const name = clinicianName(session);

  return (
    <BottomSheet
      open={open}
      onClose={() => {}}
      dismissible={false}
      eyebrow="Access request"
      title={`${name} wants access`}
      initialFocusId="access-request-body"
      actions={
        <>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => respond(true)}
            loading={busy === "allow"}
            disabled={busy === "deny"}
          >
            Allow access
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => respond(false)}
            loading={busy === "deny"}
            disabled={busy === "allow"}
          >
            Deny access
          </Button>
        </>
      }
    >
      <div id="access-request-body" tabIndex={-1} className="flex flex-col gap-3.5 outline-none">
        <AccessRequestDetails
          clinician={{
            name,
            role: session.clinician_role ?? undefined,
            practice: session.clinician_practice ?? undefined,
          }}
          duration={durationLabel(session.duration_kind)}
          context={shareContext(session)}
          shared={sharedList(prefs)}
          notIncluded={joinAnd(notIncludedList(prefs))}
        />
        <p className="text-body-tiny text-text-tertiary">
          The name and practice are as they typed them. Trace does not check them.
        </p>
        {error && (
          <HintStrip tone="danger" live="assertive">
            {error}
          </HintStrip>
        )}
      </div>
    </BottomSheet>
  );
}
