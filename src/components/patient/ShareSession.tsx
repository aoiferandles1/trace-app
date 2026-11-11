"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { clinicianName, isLive, msUntil, normaliseSession, type ShareSession } from "@/lib/patient/share";
import { useNow } from "@/lib/useNow";
import { AccessRequestSheet } from "./AccessRequestSheet";

/**
 * The patient's current share, for every signed-in screen (PLAN.md section 6,
 * "How the patient app talks to the database").
 *
 * - Starts from the session the gate read with my_share_session() (in
 *   parallel with the profile, so Home does not wait for a second round trip).
 * - Listens to Realtime on the user's own share_sessions rows. When one
 *   becomes `requested`, the access request sheet opens over whatever screen
 *   is showing.
 * - While anything is live it also calls my_share_session() every 3 seconds.
 *   That is the fallback if Realtime drops, and it is what moves time-based
 *   states on (a code or request expiring, Time's up): the database only
 *   applies them when someone calls a function.
 * - Announces the moments that matter in one polite live region (PLAN.md
 *   section 10): sharing started, 5 minutes left, 1 minute left, Time's up,
 *   ended. Never the ticking time.
 */

export type ShareContextValue = {
  /** The live session, or else the most recent one, or null if the user never shared. */
  session: ShareSession | null;
  /** False until the first read has finished. */
  loaded: boolean;
  /** True when the latest read failed (offline, or Supabase did not answer). */
  failed: boolean;
  /** Re-reads my_share_session() (which applies time-based changes first). */
  refresh: () => Promise<ShareSession | null>;
  /** Replace the session after a function returned a newer one. */
  setSession: (session: ShareSession | null) => void;
  /** Says something in the polite live region. */
  announce: (text: string) => void;
};

const noop = async () => null;
const FALLBACK: ShareContextValue = {
  session: null,
  loaded: false,
  failed: false,
  refresh: noop,
  setSession: () => {},
  announce: () => {},
};

const Ctx = createContext<ShareContextValue>(FALLBACK);

export function useShareSession(): ShareContextValue {
  return useContext(Ctx);
}

const POLL_MS = 3000;

/**
 * The newer of two rows: the same session by updated_at, else the later-created one.
 *
 * Ending a session writes its row twice in one transaction (ended, then the
 * notes entry's id), and both versions carry the same updated_at. Realtime,
 * the function result and a poll can arrive in any order, so on a tie the
 * version with the notes entry wins: within one transaction that id only
 * ever goes from null to set.
 */
function pick(cur: ShareSession | null, next: ShareSession | null): ShareSession | null {
  if (!next) return cur;
  if (!cur) return next;
  if (cur.id === next.id) {
    const a = Date.parse(cur.updated_at);
    const b = Date.parse(next.updated_at);
    if (b !== a) return b > a ? next : cur;
    return cur.notes_entry_id && !next.notes_entry_id ? cur : next;
  }
  // A live session always wins over a finished one.
  if (isLive(cur) && !isLive(next)) return cur;
  if (isLive(next) && !isLive(cur)) return next;
  return Date.parse(next.created_at) >= Date.parse(cur.created_at) ? next : cur;
}

export function ShareSessionProvider({
  userId,
  initial,
  children,
}: {
  /** Null until the gate knows who is signed in; nothing runs before then. */
  userId: string | null;
  initial: ShareSession | null | undefined;
  children: ReactNode;
}) {
  const [session, setSessionState] = useState<ShareSession | null>(initial ?? null);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");

  // The gate hands over its first read once it has it (adjusted during
  // render, React's pattern for state that follows a prop).
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    if (initial !== undefined) {
      setSessionState((cur) => pick(cur, initial));
      setLoaded(true);
    }
  }

  const announce = useCallback((text: string) => {
    // Clear first, so the same words twice are still read out.
    setMessage("");
    window.setTimeout(() => setMessage(text), 60);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc("my_share_session");
    setFailed(Boolean(error));
    if (error) return null;
    const next = normaliseSession(data);
    // my_share_session is the source of truth: take it as it is.
    setSessionState((cur) => (next ? (cur && cur.id === next.id ? pick(cur, next) : next) : null));
    setLoaded(true);
    return next;
  }, []);

  const setSession = useCallback((s: ShareSession | null) => {
    const next = normaliseSession(s);
    setSessionState((cur) => (next ? pick(cur, next) : null));
  }, []);

  // Realtime on the user's own rows (RLS limits what arrives).
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`my-share-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "share_sessions", filter: `patient_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            // "Reset demo" deletes every share: read again.
            void refresh();
            return;
          }
          const next = normaliseSession(payload.new);
          if (next) setSessionState((cur) => pick(cur, next));
        },
      )
      .subscribe((status) => {
        // After a reconnect, catch up on anything missed.
        if (status === "SUBSCRIBED") void refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Polling fallback while anything is live (or until the first read has
  // worked: the gate's read may have failed), and a re-read when the tab comes back.
  const live = isLive(session) || !loaded;
  useEffect(() => {
    if (!userId || !live) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [userId, live, refresh]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, refresh]);

  const value = useMemo<ShareContextValue>(
    () => ({ session, loaded, failed, refresh, setSession, announce }),
    [session, loaded, failed, refresh, setSession, announce],
  );

  return (
    <Ctx value={value}>
      {children}
      {userId && (
        <>
          <StatusAnnouncer session={session} announce={announce} />
          <CountdownAnnouncer session={session} announce={announce} />
          <AccessRequestSheet />
        </>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </Ctx>
  );
}

/** Announces changes of state, but not the state found on first load. */
function StatusAnnouncer({ session, announce }: { session: ShareSession | null; announce: (t: string) => void }) {
  const prev = useRef<{ id: string; status: string } | null | undefined>(undefined);
  useEffect(() => {
    const before = prev.current;
    prev.current = session ? { id: session.id, status: session.status } : null;
    if (before === undefined || !session) return;
    const sameSession = before?.id === session.id;
    if (sameSession && before.status === session.status) return;
    const name = clinicianName(session);
    const was = sameSession ? before.status : null;
    switch (session.status) {
      case "active":
        announce(
          was === "paused" ? `${name} can see your record again.` : `Sharing started. ${name} can see your record.`,
        );
        break;
      case "paused":
        announce(`Time's up. ${name}'s access is paused until you decide.`);
        break;
      case "ended":
        announce(`Sharing ended. ${name} no longer has access to your record.`);
        break;
      case "expired":
        announce(was === "requested" ? `The request from ${name} timed out.` : "Your share code expired.");
        break;
      case "code_issued":
        if (was === "requested") announce("The doctor cancelled their request. Your code still works.");
        break;
      default:
        break;
    }
  }, [session, announce]);
  return null;
}

/** "5 minutes of sharing left." and "1 minute of sharing left.", once each. */
function CountdownAnnouncer({ session, announce }: { session: ShareSession | null; announce: (t: string) => void }) {
  const ticking = session?.status === "active" && Boolean(session.expires_at) && session.duration_kind !== "manual";
  const now = useNow(ticking);
  const last = useRef<{ key: string; ms: number } | null>(null);
  useEffect(() => {
    if (!ticking || !session?.expires_at) {
      last.current = null;
      return;
    }
    const key = `${session.id}:${session.expires_at}`;
    const ms = msUntil(session.expires_at, now);
    const before = last.current?.key === key ? last.current.ms : null;
    last.current = { key, ms };
    if (before === null) return;
    if (before > 5 * 60_000 && ms <= 5 * 60_000 && ms > 60_000) announce("5 minutes of sharing left.");
    if (before > 60_000 && ms <= 60_000 && ms > 0) announce("1 minute of sharing left.");
  }, [ticking, session, now, announce]);
  return null;
}
