import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI kit",
  robots: { index: false, follow: false },
};

/**
 * /kit is a development-only page: every component in every state. It is the
 * acceptance check for the UI kit and runs axe in tests/e2e/kit.spec.ts.
 * In a production build it does not exist.
 */
export default function KitLayout({ children }: LayoutProps<"/kit">) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
