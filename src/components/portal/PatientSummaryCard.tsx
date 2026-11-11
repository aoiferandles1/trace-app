import { cn } from "@/lib/cn";

/**
 * The patient band at the top of the portal overview, from c-overview
 * "Patient Header" (Patient Card Header 163:7142): initials, name, details,
 * then a row of figures ("A+ Blood", "3 Conditions", "3 Medications").
 *
 * Figures are a <dl> so each number is read with its label.
 */
export function PatientSummaryCard({
  name,
  initials,
  details,
  figures,
  className,
}: {
  name: string;
  initials: string;
  /** "34 · Female · DOB 12 Mar 1991 · Dublin" */
  details: string;
  figures: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <section
      aria-label="Patient"
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-pill-tight border border-border-default bg-surface-card px-[22px] py-4 shadow-strip",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-info-tint font-display text-[15px] font-bold text-indigo-text"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-h3 font-medium">{name}</p>
        <p className="text-body-tiny text-indigo-text">{details}</p>
      </div>
      <dl className="flex divide-x divide-brand-indigo">
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col-reverse items-center px-[18px]">
            <dt className="text-body-tiny font-bold uppercase tracking-[0.045em] text-text-tertiary">{f.label}</dt>
            <dd className="font-display text-[17px] font-bold text-text-tertiary">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
