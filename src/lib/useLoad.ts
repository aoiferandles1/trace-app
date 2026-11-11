"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Loaded<T> =
  | { status: "loading"; data?: undefined; reload: () => void }
  | { status: "error"; data?: undefined; reload: () => void }
  | { status: "ready"; data: T; reload: () => void };

/**
 * Runs an async read on mount (and when `deps` change) and keeps its result.
 * The patient screens read their own rows straight from Supabase in the
 * browser (PLAN.md section 6), so this is their one loading pattern.
 * `reload()` runs it again, for after an edit.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): Loaded<T> {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; data?: T }>({
    status: "loading",
  });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  if (state.status === "ready") return { status: "ready", data: state.data as T, reload };
  return { status: state.status as "loading" | "error", reload };
}

/** Throws a Supabase error so useLoad shows its error state. */
export function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}
