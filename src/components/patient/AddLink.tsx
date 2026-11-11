import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * "Add a condition", "Add a medication", "Log a strength change": accent 600
 * text after a plus (RecordA2, MedsA2, MedDetailA2). 48px tall on RecordA2,
 * 44px on MedsA2 and MedDetailA2 (`height={44}`). With `onClick` it is a
 * button.
 */
export function AddLink({
  href,
  onClick,
  children,
  height = 48,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: string;
  height?: 44 | 48;
  className?: string;
}) {
  const classes = cn(
    "flex w-fit items-center gap-2 text-label font-semibold text-accent transition-colors duration-150 ease-out hovered:text-accent-alt",
    height === 44 ? "min-h-11" : "min-h-12",
    className,
  );
  const body = (
    <>
      <Icon name="plus" size={20} strokeWidth={2.25} />
      {children}
    </>
  );
  if (href)
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}
