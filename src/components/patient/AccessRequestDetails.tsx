import { Avatar } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { initialsOf } from "@/lib/format";

/**
 * The body of the access request sheet (board ApproveA2), to put inside
 * <BottomSheet>: who is asking (as they typed it, not verified) and for how
 * long, a line about the profile, "They will see" with an accent tick per
 * item, and one "Not shared: ..." line.
 *
 * `context` is "Sharing your GP visit profile for this appointment." when the
 * share came from an appointment.
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
  context?: string;
  shared: string[];
  /** "Documents, family history and mental health" */
  notIncluded?: string;
}) {
  const subline = [clinician.role, clinician.practice].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 py-1">
        <Avatar initials={initialsOf(clinician.name)} size={44} tone="tint" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-row font-medium">{clinician.name}</p>
          {subline && <p className="text-caption text-ink-2">{subline}</p>}
        </div>
        <p className="shrink-0 text-caption text-ink-2">
          <span className="sr-only">For </span>
          {duration}
        </p>
      </div>
      {context && <p className="text-caption text-ink-2">{context}</p>}
      <div>
        <h3 className="mb-0.5 text-caption font-semibold text-ink-2">They will see</h3>
        <ul className="divide-y divide-border-row">
          {shared.map((item) => (
            // ApproveA2: 36px rows plus their 1px divider.
            <li key={item} className="flex h-9.25 items-center gap-3 text-body">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <Icon name="tick" size={12} strokeWidth={3.5} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      {notIncluded && <p className="text-caption text-ink-2">Not shared: {notIncluded}.</p>}
    </div>
  );
}
