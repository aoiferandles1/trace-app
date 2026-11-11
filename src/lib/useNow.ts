"use client";

import { useEffect, useState } from "react";
import { serverNow } from "@/lib/serverClock";

/**
 * The current time, re-read every `intervalMs` while `running` is true.
 * Countdowns use it to redraw; they never decide on their own that something
 * has expired (the database does). It is the database's time, measured from
 * Supabase responses (src/lib/serverClock.ts), so a phone with a wrong clock
 * still counts down correctly.
 */
export function useNow(running = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!running) return;
    const first = window.setTimeout(() => setNow(serverNow()), 0);
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running, intervalMs]);
  return now;
}
