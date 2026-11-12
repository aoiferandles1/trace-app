import { notFound } from "next/navigation";

/** Nothing to navigate to instantly: this page only ever says "not found". */
export const instant = false;

/** Any other address under /view shows the portal's own not-found page. */
export default function MissingPortalPage() {
  notFound();
}
