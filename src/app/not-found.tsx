import type { Metadata } from "next";
import { StatePage } from "@/components/layout/StatePage";

export const metadata: Metadata = { title: "Page not found" };

/** Any address that is not part of Trace (BRIEF.md section 7). */
export default function NotFound() {
  return (
    <StatePage
      title="Page not found"
      message="There's nothing at this address. Check it, or start again from Trace."
      action={{ label: "Go to Trace", href: "/" }}
    />
  );
}
