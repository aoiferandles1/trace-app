import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

/**
 * Sign-up progress (BRIEF.md section 7): a thin 3px accent bar at the top,
 * not dots, then "Step 3 of 7". The step line links back to the previous
 * step; step 1 has no back link.
 */
export function ProgressHeader({
  step,
  total = 7,
  backHref,
  className,
}: {
  step: number;
  total?: number;
  /** Previous step's URL. Omit on the first step. */
  backHref?: string;
  className?: string;
}) {
  const label = `Step ${step} of ${total}`;
  return (
    <div className={cn("flex flex-col gap-1 px-5 pt-3", className)}>
      <ProgressBar value={step} max={total} label="Sign-up progress" valueText={label} />
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-1.5 flex h-11 w-fit items-center gap-1 rounded-full pr-2 text-caption text-ink-2 hovered:text-ink"
        >
          <Icon name="chevron-left" size={20} />
          <span>
            {label}
            <span className="sr-only">. Back to the previous step</span>
          </span>
        </Link>
      ) : (
        <p className="flex h-11 items-center text-caption text-ink-2">{label}</p>
      )}
    </div>
  );
}
