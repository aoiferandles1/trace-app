"use client";

import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { RangeBar, ResultRow } from "@/components/ui/RangeBar";
import { StepChart, type StepPeriod } from "@/components/ui/StepChart";
import { KitSection, Specimen } from "./Specimen";

const CONCERTA: StepPeriod[] = [
  { value: 18, from: "Jan 2024", to: "Mar 2024" },
  { value: 27, from: "Mar 2024", to: "Jun 2024" },
  { value: 36, from: "Jun 2024", to: "Oct 2024" },
  { value: 45, from: "Oct 2024", to: "Feb 2025" },
  { value: 36, from: "Feb 2025", to: "now" },
];

const LEVO: StepPeriod[] = [
  { value: 25, from: "Mar 2022", to: "Sep 2022" },
  { value: 50, from: "Sep 2022", to: "now" },
];

const SALBUTAMOL: StepPeriod[] = [{ value: 100, from: "2015", to: "now" }];

const LONG: StepPeriod[] = [100, 125, 150, 125, 175, 200, 150, 100].map((v, i) => ({
  value: v,
  from: `${2017 + i}`,
  to: i === 7 ? "now" : `${2018 + i}`,
}));

/** Steps down as well as up, in a narrow box: every label must still clear the line. */
const DROPS: StepPeriod[] = [20, 60, 40, 80, 10, 50, 45].map((v, i) => ({
  value: v,
  from: `${2018 + i}`,
  to: i === 6 ? "now" : `${2019 + i}`,
}));

const RESULTS: Array<[string, number, string, number, number]> = [
  ["Haemoglobin", 128, "g/L", 115, 160],
  ["White cells", 6.2, "x10⁹/L", 4, 11],
  ["Platelets", 245, "x10⁹/L", 150, 400],
  ["INR", 2.4, "", 2, 3],
  ["Ferritin", 18, "µg/L", 30, 300],
  ["TSH (example high)", 6.8, "mU/L", 0.4, 4],
];

/** A box of an exact width, to prove the chart fits it. */
function Box({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-micro text-ink-2">{width}px wide</p>
      <div style={{ width }}>{children}</div>
    </div>
  );
}

export function DataSection() {
  return (
    <KitSection
      id="data"
      title="Charts, ranges and countdowns"
      description="Computed from data. The step chart fills whatever width it gets and never scrolls; screen readers get a table of the same periods. Ranges say low or high in words."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Step chart in a phone card (318px inner, MedDetailA2)" width="phone">
          <Card padding="none" className="px-4 pb-1.5 pt-4">
            <StepChart periods={CONCERTA} unit="mg" caption="Concerta strength over time" />
          </Card>
        </Specimen>
        <Specimen title="Step chart at portal and narrow widths" surface="surface" desk>
          <div className="flex flex-wrap gap-8">
            <Box width={270}>
              <StepChart periods={CONCERTA} unit="mg" caption="Concerta strength, 270px" />
            </Box>
            <Box width={220}>
              <StepChart periods={LEVO} unit="mcg" caption="Levothyroxine strength, 220px" />
            </Box>
            <Box width={270}>
              <StepChart periods={SALBUTAMOL} unit="mcg" caption="Salbutamol strength, one period" />
            </Box>
            <Box width={270}>
              <StepChart periods={LONG} unit="mcg" caption="Eight periods, the last label pulled inside" />
            </Box>
            <Box width={220}>
              <StepChart periods={DROPS} unit="mg" caption="Seven periods up and down, 220px" />
            </Box>
          </div>
        </Specimen>
        <Specimen title="Result rows (PortalRecordE)" surface="surface" desk>
          <div className="flex max-w-[520px] flex-col gap-4">
            {RESULTS.map(([n, v, u, lo, hi]) => (
              <ResultRow key={n} name={n} value={v} unit={u} low={lo} high={hi} />
            ))}
            <p className="text-meta text-ink-2">The shaded part of each bar is the normal range.</p>
          </div>
        </Specimen>
        <Specimen title="Range bar alone" width="phone">
          <div className="flex flex-col gap-4">
            <RangeBar name="INR" value={2.4} low={2} high={3} />
            <RangeBar name="Ferritin" value={18} unit="µg/L" low={30} high={300} />
          </div>
        </Specimen>
        <Specimen title="Countdown on session indigo (SessionA2)" surface="session" width="phone">
          <Countdown msLeft={29 * 60_000 + 58_000} msTotal={30 * 60_000} tone="session" />
        </Specimen>
        <Specimen title="Countdown on a light surface" width="phone">
          <Countdown msLeft={4 * 60_000 + 12_000} msTotal={30 * 60_000} label="Time left (example)" />
        </Specimen>
        <Specimen title="Inline bar (the portal header)" surface="surface" desk>
          <div className="flex max-w-[640px] flex-col gap-4.5">
            <p className="text-row-lg font-semibold">29:54 left</p>
            <Countdown layout="inline" msLeft={29 * 60_000 + 54_000} msTotal={30 * 60_000} label="Shared for 30 min (example)" />
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}
