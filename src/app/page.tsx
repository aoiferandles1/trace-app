import { PatientShell } from "@/components/layout/PatientShell";

/**
 * Placeholder welcome screen. Phase 3 replaces it with p-splash / p-login.
 */
export default function Home() {
  return (
    <PatientShell>
      <main className="flex flex-1 flex-col justify-center gap-4 px-5 py-12">
        <p className="text-h3 font-medium text-indigo-text">trace</p>
        <h1 className="font-display text-display-sm font-light">
          Your health record, shared only when you say so.
        </h1>
        <p className="text-body-sm text-text-tertiary">
          Trace is a portfolio project by Aoife Randles, not a medical service.
        </p>
      </main>
    </PatientShell>
  );
}
