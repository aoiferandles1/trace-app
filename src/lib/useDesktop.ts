"use client";

import { useSyncExternalStore } from "react";

/** The patient app's desktop layout starts here (BRIEF.md section 7, "Patient web"). Matches `.desk-lg`. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True from 1024px wide. The signed-in screens render after the session
 * check in the browser, so this is the real answer on their first render;
 * on the server (and while hydrating) it is false, the phone layout.
 *
 * Used to mount the desktop-only pieces (the rail, the list beside a
 * detail) only where they show, so the phone never loads or renders them.
 */
export function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
