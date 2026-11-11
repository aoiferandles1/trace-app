import type { Metadata } from "next";
import { VisitsView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Recent visits" };

export default function VisitsPage() {
  return <VisitsView />;
}
