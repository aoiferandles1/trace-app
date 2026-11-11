import { KitSection, Specimen } from "./Specimen";

const SEMANTIC: Array<[string, string, string]> = [
  ["Brand/Indigo", "--brand-indigo", "#5B7AE8"],
  ["Indigo/Accessible", "--indigo-accessible", "#5469CF"],
  ["Indigo/Text", "--indigo-text", "#4258CB"],
  ["Indigo/Surface-Dark", "--indigo-surface-dark", "#3A4EBF"],
  ["Brand/Navy", "--brand-navy", "#1A2D4F"],
  ["Brand/Teal", "--brand-teal", "#00A896"],
  ["Brand/Peach", "--brand-peach", "#E8906B"],
  ["Status/Danger", "--status-danger", "#D85A4A"],
  ["Critical pill", "--critical-pill", "#B83C2E"],
  ["Text/Primary", "--text-primary", "#0C1927"],
  ["Text/Tertiary", "--text-tertiary", "#5C677A"],
  ["Text/Secondary (decorative only)", "--text-secondary", "#8A94A3"],
  ["Border/Control (new)", "--border-control", "#7A8495"],
  ["Border/Strong", "--border-strong", "#C8CED8"],
  ["Border/Default", "--border-default", "#E1E4EA"],
  ["Surface/Sunken", "--surface-sunken", "#EFEDF5"],
  ["Surface/Page", "--surface-page", "#F8F7FB"],
  ["Surface/Card", "--surface-card", "#FFFFFF"],
  ["Brand/Indigo Tint", "--brand-indigo-tint", "#F2F5FE"],
  ["Brand/Teal Tint", "--brand-teal-tint", "#E5F5F3"],
  ["Brand/Peach Tint", "--brand-peach-tint", "#FEF0E7"],
  ["Status/Danger Tint", "--status-danger-tint", "#FBEAE7"],
];

const RAMPS = ["neutral", "indigo", "teal", "peach", "red"] as const;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const TYPE: Array<[string, string, string]> = [
  ["Display", "font-display text-display font-light", "Trace"],
  ["H1", "font-display text-h1 font-light", "Read your patient's record."],
  ["Display/SM", "font-display text-display-sm font-light", "Dr Hennessy has access"],
  ["H2", "text-h2 font-bold", "Tell us a little about yourself."],
  ["Heading/LG", "text-heading-lg font-bold", "GP visit · Dr Hennessy"],
  ["H3", "text-h3 font-medium", "Warfarin 5mg"],
  ["H4", "text-h4 font-bold", "Atrial fibrillation"],
  ["Body/Large", "text-body-lg", "Sharing your GP visit profile for this appointment."],
  ["Body/Small", "text-body-sm", "Tablet · once daily · evening"],
  ["Body/Tiny", "text-body-tiny", "34 · Female · DOB 12 Mar 1991"],
  ["Label", "text-label font-medium uppercase", "Quick actions"],
  ["Button/Large · Medium · Small", "text-button-lg font-medium", "Continue"],
  ["Caption (10px, avoid for meaning)", "text-caption", "Caption"],
];

const RADII: Array<[string, string]> = [
  ["XS 6", "rounded-xs"],
  ["SM 10", "rounded-sm"],
  ["MD 12 (new)", "rounded-md"],
  ["Card Tight 14", "rounded-card-tight"],
  ["Card 16", "rounded-card"],
  ["Pill Tight 22", "rounded-pill-tight"],
  ["Pill 24", "rounded-pill"],
  ["Pill Loose 26", "rounded-pill-loose"],
  ["Sheet 28 (new)", "rounded-sheet"],
];

const SHADOWS: Array<[string, string]> = [
  ["Shadow/SM", "shadow-sm"],
  ["Shadow/Card", "shadow-card"],
  ["Shadow/MD", "shadow-md"],
  ["Shadow/LG", "shadow-lg"],
];

export function TokensSection() {
  return (
    <KitSection
      id="tokens"
      title="Tokens"
      description="CSS custom properties in src/app/globals.css, named after the Figma variables. Tailwind utilities use the same names: bg-surface-card, text-text-tertiary, rounded-card, shadow-card."
    >
      <Specimen title="Semantic colours">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SEMANTIC.map(([name, v, hex]) => (
            <li key={v} className="flex flex-col gap-1.5">
              <span
                aria-hidden="true"
                className="h-12 rounded-sm border border-border-default"
                style={{ background: `var(${v})` }}
              />
              <span className="text-body-tiny font-medium">{name}</span>
              <code className="text-body-tiny text-text-tertiary">
                {v} {hex}
              </code>
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen title="Palette ramps" note="indigo-50 … indigo-900 and so on. Prefer the semantic names above in components.">
        <div className="flex flex-col gap-2 overflow-x-auto">
          {RAMPS.map((ramp) => (
            <div key={ramp} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-body-tiny font-medium">{ramp}</span>
              {STEPS.map((s) => (
                <span
                  key={s}
                  title={`--${ramp}-${s}`}
                  aria-hidden="true"
                  className="h-8 min-w-8 flex-1 rounded-xs"
                  style={{ background: `var(--${ramp}-${s})` }}
                />
              ))}
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Type scale" note="Sora for display sizes, DM Sans for everything else.">
        <ul className="flex flex-col gap-4">
          {TYPE.map(([name, cls, sample]) => (
            <li key={name} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-48 shrink-0 text-body-tiny text-text-tertiary">{name}</span>
              <span className={cls}>{sample}</span>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen title="Radius">
          <ul className="flex flex-wrap gap-4">
            {RADII.map(([name, cls]) => (
              <li key={name} className="flex flex-col items-center gap-1.5">
                <span aria-hidden="true" className={`size-16 border border-brand-indigo bg-brand-indigo-tint ${cls}`} />
                <span className="text-body-tiny">{name}</span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen title="Shadows and spacing" note="Spacing uses Tailwind's 4px steps: Figma 8/12/16/24/32/48 = 2/3/4/6/8/12.">
          <ul className="flex flex-wrap gap-6">
            {SHADOWS.map(([name, cls]) => (
              <li key={name} className="flex flex-col items-center gap-2">
                <span aria-hidden="true" className={`size-20 rounded-card bg-surface-card ${cls}`} />
                <span className="text-body-tiny">{name}</span>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>
    </KitSection>
  );
}
