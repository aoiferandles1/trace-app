"use client";

import { useEffect } from "react";

/**
 * Sets the browser's theme-color while a screen is on show (BRIEF.md section
 * 7): session indigo on the sharing screens, ground everywhere else (the
 * root layout's default). Render <ThemeColor tone="session" /> on a session
 * screen; it puts the default back when the screen goes.
 */
export function ThemeColor({ tone }: { tone: "session" | "ground" }) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.content;
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--${tone}`).trim();
    if (value) meta.content = value;
    return () => {
      meta.content = before;
    };
  }, [tone]);
  return null;
}
