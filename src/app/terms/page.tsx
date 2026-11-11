import type { Metadata } from "next";
import { PatientShell } from "@/components/layout/PatientShell";
import { ScreenHeader } from "@/components/patient/ScreenHeader";

export const metadata: Metadata = { title: "Terms" };

/**
 * "Read full terms" (p-privacy) and the footer "Terms" link. No Figma frame:
 * a short plain page (PLAN.md section 11). Every word is a stand-in for Aoife
 * to rewrite (docs/REVIEW.md).
 */
export default function TermsPage() {
  return (
    <PatientShell header={<ScreenHeader title="Terms" backHref="/" backLabel="Back to Trace" />}>
      <div className="flex flex-col gap-6 px-5 pb-10 pt-2 text-body-sm text-text-primary">
        <Section title="What Trace is">
          <p>
            Trace is a portfolio project by Aoife Randles. It is not a medical service and it does not give medical
            advice. Do not rely on it in an emergency.
          </p>
          <p>
            <a href="https://aoiferandles.com/trace/" className="text-indigo-text underline underline-offset-2">
              Read the case study
            </a>{" "}
            to see why it was made.
          </p>
        </Section>
        <Section title="What is stored">
          <p>
            Only what you type in: your profile, critical safety details, conditions, medications, appointments,
            notes and care team. When you share with a doctor, Trace also keeps a log of who looked and when, and any
            notes the doctor adds to your record.
          </p>
          <p>Your data is stored in Ireland, encrypted in transit and at rest. It is never sold or used for advertising.</p>
        </Section>
        <Section title="Who can see it">
          <p>
            You, and a doctor you share with, for as long as you allow. Doctors see only the sections you choose.
            The person who runs the database can technically reach it, as with any hosted service.
          </p>
        </Section>
        <Section title="Your rights">
          <p>
            You can see, correct, export or delete your record at any time from Profile. Deleting your account removes
            everything straight away.
          </p>
        </Section>
        <Section title="The demo">
          <p>The demo uses sample data for a made-up patient. Demo records are deleted after 24 hours.</p>
        </Section>
      </div>
    </PatientShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h4 font-bold">{title}</h2>
      {children}
    </section>
  );
}
