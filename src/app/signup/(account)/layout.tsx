import { Suspense } from "react";
import { CheckingScreen, PatientSessionGate } from "@/components/patient/PatientSession";

/** Sign-up steps 3 to 7: signed in, not finished (see PatientSessionGate). */
export default function SignupAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CheckingScreen />}>
      <PatientSessionGate gate="onboarding">{children}</PatientSessionGate>
    </Suspense>
  );
}
