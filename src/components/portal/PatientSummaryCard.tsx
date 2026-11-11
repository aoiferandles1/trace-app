import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Card";

/**
 * The patient at the top of the portal record (board PortalRecordE's
 * header): a 56px accent avatar with Sora initials, the name in Sora 300 at
 * 30px with the details as a caption, then one row of facts, each a small
 * ink-2 label over a 17px 600 value. No dividers, no pills.
 *
 * Facts are a <dl> so each value is read with its label.
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
  /** "35, female, born 12 Mar 1991, Dublin" */
  details: string;
  figures: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <section aria-label="Patient" className={cn("flex flex-col gap-5.5", className)}>
      <div className="flex items-center gap-4">
        <Avatar initials={initials} size={56} tone="solid" display />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-display text-name font-light">{name}</p>
          <p className="text-caption text-ink-2">{details}</p>
        </div>
      </div>
      {figures.length > 0 && (
        <dl className="flex flex-wrap gap-x-16 gap-y-3">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col-reverse gap-0.5">
              <dd className="text-row-lg font-semibold">{f.value}</dd>
              <dt className="text-meta leading-4 text-ink-2">{f.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
