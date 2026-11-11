import { AccessRequestDetails } from "@/components/patient/AccessRequestDetails";

export function AccessRequestPreview() {
  return (
    <AccessRequestDetails
      clinician={{ name: "Dr Hennessy", role: "GP", practice: "Rathmines Medical Centre" }}
      duration="30 min"
      context="Sharing your GP visit profile for this appointment."
      shared={[
        "Critical safety",
        "Medications",
        "Active conditions",
        "Recent visits (last 3)",
        "Care team",
        "Can add session notes to your record",
      ]}
      notIncluded="Full timeline, documents, insurance and mental health"
    />
  );
}
