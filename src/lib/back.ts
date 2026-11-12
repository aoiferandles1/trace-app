"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * Where a screen's Back goes when it can be opened from more than one place.
 *
 * The opener adds `?back=<its own address>` (withBack); the screen reads it
 * with useBack, falling back to its usual parent. Only addresses inside the
 * app are accepted ("/home", "/record?tab=conditions"), never another site.
 */

/** The address if it is a path inside this app, else the fallback. */
export function safeBack(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** `href` with `back` added to its query. */
export function withBack(href: string, back: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}`;
}

/** This screen's Back: the opener's address, or `fallback`. */
export function useBack(fallback: string): string {
  return safeBack(useSearchParams().get("back"), fallback);
}

/** The current address, path and query, to hand to a screen this one opens. */
export function useHere(): string {
  const path = usePathname();
  const query = useSearchParams().toString();
  return query ? `${path}?${query}` : path;
}
