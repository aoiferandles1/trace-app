import { Check, Clock, Heart } from "lucide-react";
import { Avatar } from "@/components/ui/Card";
import { initialsOf } from "@/lib/format";

/**
 * The body of the access request sheet (p-request), to put inside
 * <BottomSheet>: who is asking (as they typed it, not verified), for how long,
 * a line about the profile, the list of what they will see, and what is not
 * included. Build `shared` and `notIncluded` from the session's preferences.
 *
 * `context` is "Sharing your GP visit profile for this appointment." when the
 * share came from an appointment. A share started from Profile needs a
 * stand-in line (PLAN.md section 7, listed in docs/REVIEW.md).
 */
export function AccessRequestDetails({
  clinician,
  duration,
  context,
  shared,
  notIncluded,
}: {
  clinician: { name: string; role?: string; practice?: string };
  /** "30 min", "1 hour", "All day", "Until you stop it" */
  duration: string;
  context: string;
  shared: string[];
  /** "Full timeline, documents, insurance and mental health" */
  notIncluded?: string;
}) {
  const subline = [clinician.role, clinician.practice].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 rounded-card-tight border border-border-default bg-surface-card px-3.5 py-3">
        <Avatar initials={initialsOf(clinician.name)} />
        <div className="min-w-0 flex-1">
          <p className="text-body-tiny font-bold">{clinician.name}</p>
          {subline && <p className="text-body-tiny text-text-tertiary">{subline}</p>}
        </div>
        <p className="flex shrink-0 items-center gap-1 rounded-full bg-brand-indigo-tint px-2.5 py-[5px] text-label font-medium text-indigo-text">
          <Clock aria-hidden="true" className="size-4" />
          <span className="sr-only">Duration: </span>
          {duration}
        </p>
      </div>
      <p className="text-body-lg text-text-tertiary">{context}</p>
      <h3 className="text-label font-medium uppercase text-text-tertiary">What they&rsquo;ll see</h3>
      <ul className="flex flex-col gap-2.5">
        {shared.map((item) => (
          <li key={item} className="flex items-center gap-3 text-body-lg">
            <span
              aria-hidden="true"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-teal-tint text-teal-700"
            >
              <Check className="size-4" />
            </span>
            {item}
          </li>
        ))}
      </ul>
      {notIncluded && (
        <p className="flex items-center gap-2.5 rounded-md bg-surface-sunken px-3.5 py-2.5 text-body-tiny font-medium text-text-tertiary">
          <Heart aria-hidden="true" className="size-4 shrink-0" />
          {notIncluded} not included
        </p>
      )}
    </div>
  );
}
