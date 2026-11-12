"use client";

import { PageHeader } from "@/components/patient/PageHeader";
import { useBack } from "@/lib/back";

/** Terms' header. Back returns to the screen that opened Terms (`?back=`), else Welcome. */
export function TermsHeader() {
  const back = useBack("/");
  return <PageHeader title="Terms" backHref={back} backLabel={back === "/" ? "Back to Trace" : "Back"} />;
}
