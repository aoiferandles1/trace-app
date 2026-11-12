"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { createClient } from "@/lib/supabase/client";
import { demoErrorMessage, pathForStep } from "@/lib/patient/auth";

/**
 * The welcome screen at `/`: p-splash while the browser checks for a session,
 * then p-login. Someone already signed in goes straight to their record (or
 * their sign-up step).
 *
 * "Try the demo" is the main action (most visitors come from the case study,
 * H1): it signs in anonymously, fills the visitor's own sandbox with Jane
 * Doe's record and opens Home, saying what it is doing while it waits (H5).
 * Sign in follows; creating a record is a link, after the line saying Trace
 * is invite-only.
 */
export function Welcome() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_step")
          .eq("id", data.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile) {
          router.replace(pathForStep(profile.onboarding_step));
          return;
        }
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startDemo() {
    setDemoBusy(true);
    setDemoError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setDemoError(demoErrorMessage(error));
      setDemoBusy(false);
      return;
    }
    const seeded = await supabase.rpc("seed_demo_record_v2");
    if (seeded.error) {
      await supabase.auth.signOut({ scope: "local" });
      setDemoError("The demo couldn't start. Try again in a moment.");
      setDemoBusy(false);
      return;
    }
    router.replace("/home");
  }

  if (checking) return <Splash />;

  return (
    <PatientShell>
      <div className="flex flex-1 flex-col gap-5 px-5 pb-8 pt-6">
        <p className="font-display text-display font-light">trace</p>
        <h1 className="font-display text-title font-light">Your health record, owned by you.</h1>
        <p className="text-body text-ink-2">
          Keep your medical history in one place, and share it with a doctor only when you say so.
        </p>
        {/* A visitor's way in is the demo (H1); accounts are by invite, said before the email step. */}
        <div className="mt-2 flex flex-col gap-3">
          <Button size="lg" fullWidth onClick={startDemo} loading={demoBusy}>
            Try the demo
          </Button>
          <p role="status" className="text-center text-caption text-ink-2">
            {demoBusy ? "Setting up a sample record. This takes a few seconds." : "A sample patient's record. Nothing to sign up for."}
          </p>
          {demoError && (
            <Notice tone="critical" live="assertive" className="w-full">
              {demoError}
            </Notice>
          )}
          <ButtonLink href="/login" variant="secondary" size="lg" fullWidth className="mt-2">
            Sign in
          </ButtonLink>
          <p className="text-center text-caption text-ink-2">
            Trace is invite-only for now.{" "}
            <Link href="/signup" className="font-semibold text-accent underline underline-offset-2">
              Create your record
            </Link>{" "}
            if you have an invite.
          </p>
        </div>
        <p className="mt-auto text-center text-caption text-ink-2">
          Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
          <a href="https://aoiferandles.com/trace/" className="text-accent underline underline-offset-2">
            Read the case study
          </a>{" "}
          or the{" "}
          <Link href="/terms" className="text-accent underline underline-offset-2">
            terms
          </Link>
          .
        </p>
      </div>
    </PatientShell>
  );
}

/** The splash: the wordmark on ground, while the session is checked. */
function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground">
      <p className="font-display text-display-xl font-light text-ink">
        trace<span className="sr-only">. Loading</span>
      </p>
    </div>
  );
}
