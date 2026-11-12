import { notFound } from "next/navigation";

/** Any other address under /view shows the portal's own not-found page. */
export default function MissingPortalPage() {
  notFound();
}
