"use client";

import { useEffect, useState } from "react";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { KitSection, Specimen } from "./Specimen";

/**
 * Tokens as the browser computes them. Values and contrast ratios are read
 * from the live CSS variables, so this page can never disagree with
 * globals.css.
 */

const COLOURS: Array<[string, string]> = [
  ["ground", "App background"],
  ["surface", "Cards, sheets, inputs, tab bar"],
  ["ink", "Primary text"],
  ["ink-2", "Secondary text, captions, inactive tab"],
  ["segment-text", "Unselected segment label"],
  ["accent", "Primary actions, active states, links, charts, ticks"],
  ["accent-alt", "Pressed accent"],
  ["session", "Sharing sessions only"],
  ["session-deep", "Approve-access backdrop"],
  ["locked-tint", "Locked or not shared"],
  ["urgent-tint", "Urgent, not an error"],
  ["urgent", "Urgent text, out-of-range dot"],
  ["critical-tint", "Allergy, critical safety"],
  ["critical", "Critical text, errors"],
  ["border-card", "Card outline"],
  ["border-row", "Row dividers, bar tracks"],
  ["border-control", "Inputs, segmented outline"],
  ["border-tabbar", "Top and bottom bar hairlines"],
  ["ring-off", "Empty tick ring (darkened for 3:1)"],
  ["switch-off", "Track switch, off"],
  ["tree-line", "Family tree connectors"],
  ["tree-node", "Family tree node rings"],
  ["tree-faint", "Small tree drawing"],
  ["range-band", "Normal range band"],
  ["on-session-border", "Hairlines on session indigo"],
  ["on-session-2", "Secondary text on session indigo"],
  ["on-session-ring", "Empty rings on session indigo"],
  ["on-session-dash", "Dashed rail rings"],
  ["scrim", "Behind sheets and dialogs"],
];

/** Text and icon pairings checked against WCAG AA: [foreground, background, needed]. */
const PAIRS: Array<[string, string, number]> = [
  ["ink", "ground", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "locked-tint", 4.5],
  ["ink", "urgent-tint", 4.5],
  ["ink", "critical-tint", 4.5],
  ["ink-2", "ground", 4.5],
  ["ink-2", "surface", 4.5],
  ["ink-2", "locked-tint", 4.5],
  ["ink-2", "urgent-tint", 4.5],
  ["ink-2", "critical-tint", 4.5],
  ["segment-text", "surface", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "ground", 4.5],
  ["accent-alt", "surface", 4.5],
  ["surface", "accent", 4.5],
  ["surface", "accent-alt", 4.5],
  ["surface", "session", 4.5],
  ["session", "surface", 4.5],
  ["session", "locked-tint", 3],
  ["on-session-2", "session", 4.5],
  ["urgent", "urgent-tint", 4.5],
  ["urgent", "surface", 4.5],
  ["critical", "critical-tint", 4.5],
  ["critical", "surface", 4.5],
  ["critical", "ground", 4.5],
  ["ring-off", "surface", 3],
  ["ring-off", "ground", 3],
  ["switch-off", "ground", 3],
  ["on-session-ring", "session", 3],
  ["accent", "range-band", 3],
  ["accent", "locked-tint", 3],
  ["ink", "accent", 3],
];

type RGBA = [number, number, number, number];

function parse(value: string): RGBA | null {
  const v = value.trim();
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).concat(1) as RGBA;
  }
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
}

function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg: RGBA, bg: RGBA) {
  const a = luminance(over(fg, bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function useTokens() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const read = () => setValues(Object.fromEntries(COLOURS.map(([n]) => [n, css.getPropertyValue(`--${n}`).trim()])));
    read();
  }, []);
  return values;
}

const TYPE: Array<[string, string, string, string]> = [
  ["display-xl", "font-display text-display-xl font-light", "72/80", "4:59"],
  ["hero", "font-display text-hero font-light", "56/60", "9:30"],
  ["display", "font-display text-display font-light", "44/52", "Enter the patient's code"],
  ["countdown", "font-display text-countdown font-light", "40/44", "29:58"],
  ["code", "font-display text-code font-light", "44 phone / 48 portal", "9070"],
  ["numeral-lg", "font-display text-numeral-lg font-light", "32/36", "19"],
  ["name", "font-display text-name font-light", "30/36", "Jane Doe"],
  ["title", "font-display text-title font-light", "28/34 phone / 26/32 portal", "Medications"],
  ["title-md", "font-display text-title-md font-light", "26/32", "Dr Hennessy wants access"],
  ["title-sm", "font-display text-title-sm font-light", "24/30", "Family history"],
  ["heading", "font-display text-heading font-light", "20/26 phone / 22/28 portal", "Coming up"],
  ["numeral", "font-display text-numeral font-light", "22/28 phone / 20/26 portal", "36mg"],
  ["year", "font-display text-year font-light", "20/26", "2026"],
  ["unit", "text-unit font-medium", "18/24 Inter 500", "am"],
  ["row-lg", "text-row-lg font-medium", "17/24 Inter 500", "Atrial fibrillation"],
  ["body-lg", "text-body-lg", "16/24 Inter 400", "Cough and fever for five days."],
  ["row", "text-row font-medium", "16/22 Inter 500", "Blood count and INR"],
  ["body", "text-body", "15/22 Inter 400", "Now 36mg, since Feb 2025"],
  ["label", "text-label font-semibold", "15/20 Inter 600", "Safety info"],
  ["caption", "text-caption text-ink-2", "14/20 Inter 400, ink-2", "Dr O'Mahony, since 2019"],
  ["meta", "text-meta text-ink-2", "13/18 Inter 400, ink-2", "Seen by"],
  ["micro", "text-micro text-ink-2", "12/16 Inter, the smallest size", "Demo with sample data"],
];

const RADII: Array<[string, string, string]> = [
  ["card", "rounded-card", "24 / 12"],
  ["tile", "rounded-tile", "20 / 12"],
  ["tile-lg", "rounded-tile-lg", "22"],
  ["feature", "rounded-feature", "28"],
  ["strip", "rounded-strip", "16"],
  ["button", "rounded-button", "26 / 12"],
  ["control", "rounded-control", "18 / 12"],
  ["segment", "rounded-segment", "14 / 8"],
  ["input", "rounded-input", "16 / 12"],
  ["code", "rounded-code", "18 / 12"],
  ["rail", "rounded-rail", "12"],
  ["sheet", "rounded-t-sheet", "28 (top)"],
];

export function TokensSection() {
  const values = useTokens();
  return (
    <KitSection
      id="tokens"
      title="Tokens"
      description="BRIEF.md section 2. Colours are utilities (bg-ground, text-ink-2, border-border-card). Values and ratios below are read live from the CSS."
    >
      <Specimen title="Colour" surface="surface">
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {COLOURS.map(([name, use]) => (
            <li key={name} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-10 shrink-0 rounded-tile border border-border-card"
                style={{ background: `var(--${name})` }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-caption font-semibold">{name}</span>
                <span className="text-meta text-ink-2">
                  {values?.[name] ?? ""} {use}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen
        title="Contrast, WCAG 2.2 AA"
        note="Text needs 4.5:1, icons and control edges 3:1. Translucent tokens are blended over their background first."
        surface="surface"
      >
        <table className="w-full max-w-3xl text-left text-caption">
          <thead>
            <tr className="border-b border-border-row text-ink-2">
              <th scope="col" className="py-2 font-medium">Pair</th>
              <th scope="col" className="py-2 font-medium">Sample</th>
              <th scope="col" className="py-2 font-medium">Ratio</th>
              <th scope="col" className="py-2 font-medium">Needs</th>
            </tr>
          </thead>
          <tbody>
            {PAIRS.map(([fg, bg, need]) => {
              const f = values && parse(values[fg]);
              const b = values && parse(values[bg]);
              const r = f && b ? ratio(f, over(b, [255, 255, 255, 1])) : null;
              return (
                <tr key={`${fg}-${bg}`} className="border-b border-border-row">
                  <td className="py-2">
                    {fg} on {bg}
                  </td>
                  <td className="py-2">
                    <span
                      className="inline-flex h-7 items-center rounded-tile px-2 font-semibold"
                      style={{ color: `var(--${fg})`, background: `var(--${bg})` }}
                    >
                      {/* 3:1 pairs are for icons and edges: sampled with an icon, not text. */}
                      {need === 3 ? <Icon name="tick" size={18} strokeWidth={2.5} /> : "Aa"}
                    </span>
                  </td>
                  <td className={cn("py-2 font-semibold", r !== null && r < need && "text-critical")}>
                    {r === null ? "" : `${r.toFixed(2)}:1`}
                  </td>
                  <td className="py-2 text-ink-2">{need}:1</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Specimen>

      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Type, phone" surface="surface">
          <TypeList />
        </Specimen>
        <Specimen title="Type, portal" surface="surface" desk>
          <TypeList />
        </Specimen>
      </div>

      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Radius, phone" note="Shown on border-control boxes. No shadows exist." surface="surface">
          <Radii />
        </Specimen>
        <Specimen title="Radius, portal" surface="surface" desk>
          <Radii />
        </Specimen>
      </div>

      <Specimen
        title="Icons"
        note="24px grid, 1.75px stroke (2px for chevrons, arrows, close, warning), round caps and joins, currentColor. The boards' own paths."
        surface="surface"
      >
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6 xl:grid-cols-9">
          {ICON_NAMES.map((n) => (
            <li key={n} className="flex flex-col items-center gap-1.5 text-center">
              <Icon name={n} />
              <span className="text-micro text-ink-2">{n}</span>
            </li>
          ))}
        </ul>
      </Specimen>
    </KitSection>
  );
}

function TypeList() {
  return (
    <ul className="flex flex-col gap-4">
      {TYPE.map(([name, cls, spec, sample]) => (
        <li key={name} className="flex min-w-0 flex-col">
          <span className="text-micro text-ink-2">
            {name}, {spec}
          </span>
          <span className={cn("min-w-0 truncate", cls)}>{sample}</span>
        </li>
      ))}
    </ul>
  );
}

function Radii() {
  return (
    <ul className="flex flex-wrap gap-4">
      {RADII.map(([name, cls, px]) => (
        <li key={name} className="flex flex-col items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-16 border border-border-control bg-ground", cls)} />
          <span className="text-micro text-ink-2">
            {name} {px}
          </span>
        </li>
      ))}
    </ul>
  );
}
