"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { pathForStep, stepIndex, STEPS } from "@/lib/patient/auth";
import type { Profile } from "@/lib/patient/types";

/**
 * Who is signed in, and their profile, for the signed-in patient screens.
 *
 * Two gates use it (PLAN.md section 6, "Auth"):
 * - `gate="record"` (the (patient) layout: /home, /record, /meds, /add,
 *   /profile): signed-out visitors go to `/`, and anyone who has not finished
 *   sign-up goes back to their step. Demo users arrive with
 *   onboarding_step "done" (seed_demo_record sets it), so they skip sign-up.
 * - `gate="onboarding"` (sign-up steps 3 to 7): signed-out visitors go to
 *   `/signup`, finished accounts go to /home, and nobody can jump ahead of
 *   the step they have reached (going back is fine).
 *
 * The check runs in the browser: every read goes through row-level security
 * anyway, so the gate is about routing, not protection.
 *
 * Phase 5 seam: the realtime subscription to share_sessions and the access
 * request sheet belong here, inside `record`, so the sheet can open over
 * whatever screen is showing.
 */

export type PatientSessionValue = {
  userId: string;
  email: string | null;
  isAnonymous: boolean;
  profile: Profile;
  /** Re-reads the profile (after an edit). */
  reloadProfile: () => Promise<Profile | null>;
  /** Replace the profile in memory after a successful update. */
  setProfile: (profile: Profile) => void;
};

const Ctx = createContext<PatientSessionValue | null>(null);

export function usePatientSession(): PatientSessionValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePatientSession must be used inside <PatientSessionGate>");
  return value;
}

type State =
  | { status: "checking" }
  | { status: "error" }
  | { status: "ready"; userId: string; email: string | null; isAnonymous: boolean; profile: Profile };

export function PatientSessionGate({
  gate,
  children,
}: {
  gate: "record" | "onboarding";
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [state, setState] = useState<State>({ status: "checking" });

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function check() {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (!user || error) {
        router.replace(gate === "record" ? "/" : "/signup");
        return;
      }
      const profile = await loadProfile(user.id);
      if (cancelled) return;
      if (!profile) {
        setState({ status: "error" });
        return;
      }
      const reached = profile.onboarding_step;
      if (gate === "record" && reached !== "done") {
        router.replace(pathForStep(reached));
        return;
      }
      if (gate === "onboarding") {
        if (reached === "done") {
          router.replace("/home");
          return;
        }
        const here = STEPS.findIndex((s) => pathname.startsWith(s.path));
        if (here > stepIndex(reached)) {
          router.replace(pathForStep(reached));
          return;
        }
      }
      setState({
        status: "ready",
        userId: user.id,
        email: user.email ?? null,
        isAnonymous: Boolean(user.is_anonymous),
        profile,
      });
    }

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // The record area checks once, on mount. Sign-up checks again on every
    // step, since a redirect between steps stays inside this layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, gate === "onboarding" ? pathname : null]);

  const value = useMemo<PatientSessionValue | null>(() => {
    if (state.status !== "ready") return null;
    return {
      userId: state.userId,
      email: state.email,
      isAnonymous: state.isAnonymous,
      profile: state.profile,
      setProfile: (profile) => setState((s) => (s.status === "ready" ? { ...s, profile } : s)),
      reloadProfile: async () => {
        const profile = await loadProfile(state.userId);
        if (profile) setState((s) => (s.status === "ready" ? { ...s, profile } : s));
        return profile;
      },
    };
  }, [state, loadProfile]);

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page px-6 text-center">
        <p role="alert" className="text-body-lg text-text-primary">
          Trace couldn&apos;t load your record. Check your connection and reload the page.
        </p>
      </div>
    );
  }
  // Children always render (each page wraps its content in <SessionReady>),
  // so Next.js can validate the page segments; they show the loading state
  // until the check above has finished.
  return <Ctx value={value}>{children}</Ctx>;
}

/** Renders its children once the session is checked, and the loading state until then. */
export function SessionReady({ children }: { children: ReactNode }) {
  return useContext(Ctx) ? children : <CheckingScreen />;
}

/** Shown for a moment while the session is checked. */
export function CheckingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-page">
      <p role="status" className="text-body-sm text-text-tertiary">
        Loading&hellip;
      </p>
    </div>
  );
}
