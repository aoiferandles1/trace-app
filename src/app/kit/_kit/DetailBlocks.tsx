import { DetailBlock } from "@/components/ui/DetailBlock";

/** TimelineA2's sheet body, as sample content for the kit. */
export function DetailBlocks() {
  return (
    <>
      <DetailBlock label="Seen by">Dr Hennessy, Rathmines Medical Centre</DetailBlock>
      <DetailBlock label="Outcome">Resolved</DetailBlock>
      <DetailBlock label="Prescribed" items={[{ name: "Doxycycline 100mg", detail: "7 days, from 2 Aug" }]} />
      <DetailBlock label="Doctor's notes">Cough and fever for five days. Chest clear at follow-up.</DetailBlock>
    </>
  );
}
