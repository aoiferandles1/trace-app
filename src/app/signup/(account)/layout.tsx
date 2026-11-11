import { PatientSessionGate } from "@/components/patient/PatientSession";

/** Sign-up steps 3 to 7: signed in, not finished (see PatientSessionGate). */
export default function SignupAccountLayout({ children }: { children: React.ReactNode }) {
  return <PatientSessionGate gate="onboarding">{children}</PatientSessionGate>;
}
