import type { Tone } from "@/components/ui/Pill";
import { ListItemCard } from "./ListItemCard";

/**
 * A condition on the record ("Atrial fibrillation · managed"), as on p-record
 * and the portal overview. Maps the database status to the tag.
 *
 * `colour` is the dot and tag tone. Figma gives each condition its own colour
 * (indigo, peach, teal) rather than one per status, so it is a prop; use
 * `conditionTone(index)` to cycle through them in list order.
 */

export type ConditionStatus = "managed" | "ongoing" | "resolved";

const CYCLE: Tone[] = ["indigo", "peach", "teal"];

export function conditionTone(index: number): Tone {
  return CYCLE[index % CYCLE.length];
}

export function ConditionCard({
  name,
  status,
  meta,
  href,
  colour = "indigo",
  className,
}: {
  name: string;
  status: ConditionStatus;
  /** "Dr O'Mahony · Cardiology · Dx 2019" */
  meta?: string;
  href?: string;
  colour?: Tone;
  className?: string;
}) {
  return (
    <ListItemCard
      title={name}
      meta={meta}
      tone={colour}
      tag={{ label: status, tone: status === "resolved" ? "neutral" : colour }}
      href={href}
      className={className}
    />
  );
}
