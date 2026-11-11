import type { Metadata } from "next";
import { EndView } from "../_components/EndView";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "End session" };

export default function SessionEndPage() {
  return <EndView />;
}
