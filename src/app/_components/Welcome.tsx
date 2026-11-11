"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
 * "Try the demo" is new (PLAN.md section 9): it signs in anonymously, fills
 * the visitor's own sandbox with Jane Doe's record and opens Home.
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
    const seeded = await supabase.rpc("seed_demo_record");
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
          Trace puts your medical history in one place and keeps you in control.
        </p>
        <ul className="flex flex-col">
          <Feature icon="person" title="You decide who sees what">
            Share with any doctor, anywhere. Choose exactly what they can access.
          </Feature>
          <Feature icon="record" title="Your complete history in one place">
            Log visits, track medications and keep notes, all in one record.
          </Feature>
          <Feature icon="shield" title="Private by design">
            Your data is yours. No advertising. No data sales. Ever.
          </Feature>
        </ul>
        <div className="mt-2 flex flex-col gap-5">
          <ButtonLink href="/signup" size="lg" fullWidth>
            Create your record
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg" fullWidth>
            I already have an account
          </ButtonLink>
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-border-card pt-5">
          <p className="text-center text-caption text-ink-2">Just looking? Try Trace with sample data.</p>
          <Button variant="text" size="md" onClick={startDemo} loading={demoBusy}>
            Try the demo
          </Button>
          {demoError && (
            <Notice tone="critical" live="assertive" className="w-full">
              {demoError}
            </Notice>
          )}
        </div>
        <p className="mt-auto text-center text-caption text-ink-2">
          Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
          <a href="https://aoiferandles.com/trace/" className="text-accent underline underline-offset-2">
            Read the case study
          </a>{" "}
          ·{" "}
          <Link href="/terms" className="text-accent underline underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </PatientShell>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5 py-2">
      <Icon name={icon} className="text-accent" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-row font-medium text-ink">{title}</span>
        <span className="text-caption text-ink-2">{children}</span>
      </span>
    </li>
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
