"use client";

import { useSyncExternalStore } from "react";
import { PENDING_EMAIL_KEY } from "./auth";

/**
 * The email typed on the email step, kept in sessionStorage (not the URL, so
 * it stays out of history and logs) until the code step has used it.
 */

export function setPendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Storage blocked: the code step sends the person back to the email step.
  }
}

function read(): string | null {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

const noop = () => () => {};

/** The pending email, `undefined` during the server render, `null` if there is none. */
export function usePendingEmail(): string | null | undefined {
  return useSyncExternalStore(noop, read, () => undefined);
}
