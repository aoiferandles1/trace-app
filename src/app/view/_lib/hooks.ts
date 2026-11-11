"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The doctor's typed details, remembered in this browser (PLAN.md section 8,
 * item 12). Not verified by anyone: the screens must never say otherwise.
 */
export type Clinician = { name: string; role: string; practice: string };

const KEY = "trace.portal.clinician";
const EVENT = "trace-portal-clinician";

export const DEMO_CLINICIAN: Clinician = {
  name: "Dr Hennessy",
  role: "GP",
  practice: "Rathmines Medical Centre",
};

let cachedRaw: string | null | undefined;
let cachedValue: Clinician | null = null;

export function readClinician(): Clinician | null {
  return read();
}

function read(): Clinician | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Clinician>) : null;
    cachedValue = v && typeof v.name === "string" && v.name.trim()
      ? { name: v.name, role: v.role ?? "", practice: v.practice ?? "" }
      : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function saveClinician(c: Clinician) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Private mode: the details just are not remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** `undefined` during server render and the first client render. */
export function useStoredClinician(): Clinician | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** Current time in ms, ticking every `interval` ms, shifted by the server clock offset. */
export function useNow(offset: number, interval = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now() + offset), interval);
    return () => window.clearInterval(id);
  }, [offset, interval, enabled]);
  return now;
}

/**
 * Calls `fn` every `ms` while `enabled`, waiting for each call to finish
 * before scheduling the next, so slow responses never pile up.
 */
export function usePolling(fn: () => Promise<unknown>, ms: number, enabled: boolean) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        await ref.current();
      } catch {
        // A failed poll is retried on the next tick.
      }
      if (!stopped) timer = window.setTimeout(tick, ms);
    };
    timer = window.setTimeout(tick, ms);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [ms, enabled]);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
