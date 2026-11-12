"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The browser tab's title for each patient screen ("Medications · Trace").
 * The words come from the address, never from the record: a title is shown
 * in the tab bar, history and the screen reader's route announcement, so it
 * never holds a name, a condition or a medicine.
 */
const TITLES: [RegExp, string][] = [
  [/^\/home$/, "Home"],
  [/^\/record$/, "Record"],
  [/^\/record\/timeline$/, "Timeline"],
  [/^\/record\/timeline\/new$/, "Add to your timeline"],
  [/^\/record\/timeline\/[^/]+\/edit$/, "Edit event"],
  [/^\/record\/family$/, "Family history"],
  [/^\/record\/family\/new$/, "Add a relative"],
  [/^\/record\/family\/[^/]+\/edit$/, "Edit relative"],
  [/^\/record\/conditions\/new$/, "Add a condition"],
  [/^\/record\/conditions\/[^/]+\/edit$/, "Edit condition"],
  [/^\/record\/conditions\/[^/]+$/, "Condition"],
  [/^\/record\/[^/]+\/edit$/, "Edit entry"],
  [/^\/record\/[^/]+$/, "Entry"],
  [/^\/meds$/, "Medications"],
  [/^\/meds\/[^/]+\/edit$/, "Edit medication"],
  [/^\/meds\/[^/]+\/change$/, "Log a strength change"],
  [/^\/meds\/[^/]+\/notes\/[^/]+$/, "Medication note"],
  [/^\/meds\/[^/]+$/, "Medication"],
  [/^\/add$/, "Add to your record"],
  [/^\/add\/appointment$/, "Add a visit"],
  [/^\/add\/medication$/, "Add a medication"],
  [/^\/add\/note$/, "Log a note"],
  [/^\/add\/vitals$/, "Add vitals"],
  [/^\/record\/vitals$/, "Vitals"],
  [/^\/profile$/, "Profile"],
  [/^\/profile\/details$/, "Your details"],
  [/^\/profile\/edit$/, "Edit details"],
  [/^\/profile\/email$/, "Change email"],
  [/^\/profile\/insurance$/, "Insurance"],
  [/^\/profile\/insurance\/manual$/, "Policy details"],
  [/^\/profile\/documents$/, "Documents"],
  [/^\/profile\/documents\/upload$/, "Upload a document"],
  [/^\/profile\/documents\/[^/]+$/, "Document"],
  [/^\/profile\/care-team$/, "Care team"],
  [/^\/profile\/care-team\/new$/, "Add to your care team"],
  [/^\/profile\/care-team\/[^/]+$/, "Edit care team"],
  [/^\/profile\/privacy$/, "Privacy and data"],
  [/^\/access-log$/, "Share history"],
  [/^\/share$/, "Share your record"],
  [/^\/share\/code$/, "Share code"],
  [/^\/session$/, "Sharing"],
  [/^\/session\/ended$/, "Sharing ended"],
  [/^\/signup\/about$/, "About you"],
  [/^\/signup\/medical$/, "Medical basics"],
  [/^\/signup\/privacy$/, "Privacy and consent"],
  [/^\/signup\/profiles$/, "Share profiles"],
  [/^\/signup\/welcome$/, "Welcome"],
];

export function titleFor(pathname: string): string | null {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? null;
}

/** Sets the tab's title from the address. Rendered once by the patient and sign-up layouts. */
export function RouteTitle() {
  const pathname = usePathname();
  useEffect(() => {
    const title = titleFor(pathname);
    document.title = title ? `${title} · Trace` : "Trace";
  }, [pathname]);
  return null;
}
