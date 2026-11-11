import type { Metadata } from "next";
import { EndView } from "../_components/EndView";

export const metadata: Metadata = { title: "End session" };

export default function SessionEndPage() {
  return <EndView />;
}
