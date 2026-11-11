"use client";

import { useEffect, useState } from "react";

/**
 * The current time, re-read every `intervalMs` while `running` is true.
 * Countdowns use it to redraw; they never decide on their own that something
 * has expired (the database does).
 */
export function useNow(running = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running, intervalMs]);
  return now;
}
