"use client";

import { Activity, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { createClient } from "@/lib/supabase/client";
import { demoErrorMessage, pathForStep } from "@/lib/patient/auth";
import { cn } from "@/lib/cn";

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
        <p className="text-[40px] font-bold leading-none tracking-[-0.03em] text-brand-indigo">trace</p>
        <h1 className="text-h3 font-medium">Your health record, owned by you.</h1>
        <p className="text-body-sm text-text-tertiary">
          Trace puts your medical history in one place and keeps you in control.
        </p>
        <ul className="flex flex-col">
          <Feature tone="indigo" icon={<UserRound />} title="You decide who sees what">
            Share with any doctor, anywhere. Choose exactly what they can access.
          </Feature>
          <Feature tone="teal" icon={<Activity />} title="Your complete history in one place">
            Upload documents, log visits, track medications, all in one record.
          </Feature>
          <Feature tone="neutral" icon={<ShieldCheck />} title="Private and GDPR compliant">
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
        <div className="flex flex-col items-center gap-2 border-t border-border-default pt-5">
          <p className="text-center text-body-sm text-text-tertiary">Just looking? Try Trace with sample data.</p>
          <Button variant="ghost" size="md" onClick={startDemo} loading={demoBusy}>
            Try the demo
          </Button>
          {demoError && (
            <HintStrip tone="danger" live="assertive" className="w-full">
              {demoError}
            </HintStrip>
          )}
        </div>
        <p className="mt-auto text-center text-body-tiny text-text-tertiary">
          Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
          <a href="https://aoiferandles.com/trace/" className="text-indigo-text underline underline-offset-2">
            Read the case study
          </a>{" "}
          ·{" "}
          <Link href="/terms" className="text-indigo-text underline underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </PatientShell>
  );
}

const tileTone = {
  indigo: "bg-brand-indigo-tint text-indigo-text",
  teal: "bg-brand-teal-tint text-teal-700",
  neutral: "bg-surface-sunken text-text-tertiary",
} as const;

function Feature({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof tileTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5 py-2 [&+&]:mt-3">
      <span
        aria-hidden="true"
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-4", tileTone[tone])}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-body-tiny">
        <span className="font-bold text-text-primary">{title}</span>
        <span className="text-text-tertiary">{children}</span>
      </span>
    </li>
  );
}

/** p-splash: the wordmark on indigo, while the session is checked. */
function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-indigo-surface-dark">
      <p className="text-[64px] font-bold leading-none tracking-[-0.03em] text-white">
        trace<span className="sr-only">. Loading</span>
      </p>
    </div>
  );
}
