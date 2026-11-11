"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { pathForStep, stepIndex, STEPS } from "@/lib/patient/auth";
import type { Profile } from "@/lib/patient/types";
import { normaliseSession, type ShareSession } from "@/lib/patient/share";
import { ShareSessionProvider } from "./ShareSession";

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
 * Speed: the session is read from the cookie in the browser (no network
 * call unless the token needs refreshing), then three things run at once:
 * `getClaims()` verifies the token's signature locally against the project's
 * published key (one small cached fetch, no Auth server round trip), the
 * profile is read, and, in the record area, my_share_session() is read for
 * <ShareSessionProvider>. Before this, getUser() (a round trip to Auth) ran
 * first and the profile only after it.
 *
 * The record area also wraps everything in <ShareSessionProvider>: Realtime
 * on share_sessions and the access request sheet, so the sheet can open over
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
  | {
      status: "ready";
      userId: string;
      email: string | null;
      isAnonymous: boolean;
      profile: Profile;
      share: ShareSession | null | undefined;
    };

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
      // Local: reads the cookie session (refreshing the token only if it has expired).
      const { data: local } = await supabase.auth.getSession();
      if (cancelled) return;
      const user = local.session?.user;
      if (!user) {
        router.replace(gate === "record" ? "/" : "/signup");
        return;
      }
      const [claims, profile, share] = await Promise.all([
        supabase.auth.getClaims(),
        loadProfile(user.id),
        gate === "record"
          ? supabase.rpc("my_share_session").then(({ data, error }) => (error ? undefined : normaliseSession(data)))
          : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      // Offline is not signed out: say so instead of sending them to the welcome screen.
      if (claims.error && isAuthRetryableFetchError(claims.error)) {
        setState({ status: "error" });
        return;
      }
      if (claims.error || !claims.data || claims.data.claims.sub !== user.id) {
        router.replace(gate === "record" ? "/" : "/signup");
        return;
      }
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
        share,
      });
    }

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") leaveForWelcome();
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
      <div className="flex min-h-dvh items-center justify-center bg-ground px-6 text-center">
        <p role="alert" className="text-body-lg text-ink">
          Trace couldn&apos;t load your record. Check your connection and reload the page.
        </p>
      </div>
    );
  }
  // Children always render (each page wraps its content in <SessionReady>),
  // so Next.js can validate the page segments; they show the loading state
  // until the check above has finished.
  if (gate === "record") {
    return (
      <Ctx value={value}>
        <ShareSessionProvider
          userId={state.status === "ready" ? state.userId : null}
          initial={state.status === "ready" ? state.share : undefined}
        >
          {children}
        </ShareSessionProvider>
      </Ctx>
    );
  }
  return <Ctx value={value}>{children}</Ctx>;
}

/**
 * After signing out or deleting the account: a full page load of the welcome
 * screen, not a client navigation. Next.js keeps visited screens in memory
 * (hidden), and they hold the record that was on them; a full load drops
 * every one of them, the share session state and its Realtime channel, so
 * nothing of this person's is left in the tab for whoever uses it next.
 */
export function leaveForWelcome() {
  window.location.replace("/");
}

/** Renders its children once the session is checked, and the loading state until then. */
export function SessionReady({ children }: { children: ReactNode }) {
  return useContext(Ctx) ? children : <CheckingScreen />;
}

/** Shown for a moment while the session is checked. */
export function CheckingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground">
      <p role="status" className="text-caption text-ink-2">
        Loading&hellip;
      </p>
    </div>
  );
}
