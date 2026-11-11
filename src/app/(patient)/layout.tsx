import { Suspense } from "react";
import { CheckingScreen, PatientSessionGate } from "@/components/patient/PatientSession";

/**
 * Every signed-in patient route (/home, /record, /meds, /add, /profile).
 * Signed-out visitors go to `/`; unfinished sign-ups go back to their step.
 * The screens read the session in the browser, so the server sends the
 * loading state as the static shell.
 */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CheckingScreen />}>
      <PatientSessionGate gate="record">{children}</PatientSessionGate>
    </Suspense>
  );
}
