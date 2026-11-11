import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

/**
 * Sign-up progress, from Figma "Step Progress" (85:2628) as on p-verify and
 * p-about: a 2px indigo track, then "< Step 3 of 7". The back link returns to
 * the previous step; step 1 has no back link.
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
    <div className={cn("flex flex-col gap-1.5 px-5 pt-2", className)}>
      <ProgressBar value={step} max={total} label="Sign-up progress" valueText={label} className="mb-2" />
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-2 flex h-11 w-fit items-center gap-1.5 rounded-md px-2 text-body-tiny text-text-tertiary hovered:text-text-primary"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span>
            {label}
            <span className="sr-only">. Back to the previous step</span>
          </span>
        </Link>
      ) : (
        <p className="flex h-11 items-center text-body-tiny text-text-tertiary">{label}</p>
      )}
    </div>
  );
}
