import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI kit",
  robots: { index: false, follow: false },
};

/**
 * /kit is a development-only page: every component in every state. It is the
 * acceptance check for the UI kit and runs axe in tests/e2e/kit.spec.ts.
 * In a production build it does not exist, except in the end-to-end tests'
 * own build (TRACE_E2E=1, set only by playwright.config.ts).
 */
export default function KitLayout({ children }: LayoutProps<"/kit">) {
  if (process.env.NODE_ENV === "production" && process.env.TRACE_E2E !== "1") notFound();
  // The tab bar and the Add sheet read the address (their `?back=`), which needs a Suspense
  // boundary above it. The real screens get theirs from the session gate's layout.
  return <Suspense>{children}</Suspense>;
}
