import type { Metadata } from "next";
import { DocumentsView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentsView />;
}
