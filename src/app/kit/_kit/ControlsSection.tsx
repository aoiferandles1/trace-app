"use client";

import { useState } from "react";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl, tabPanelProps } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { LockedRow, Switch, SwitchGroup, SwitchRow } from "@/components/ui/Switch";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ScopeTile, TickIndicator, TickToggle, ToggleRow } from "@/components/ui/Toggle";
import { KitSection, Specimen, States } from "./Specimen";

const FORCE = [
  ["Default", undefined],
  ["Hover", "hover"],
  ["Pressed", "press"],
  ["Focus", "focus"],
] as const;

function ButtonStates({ variant, size, tone }: { variant: ButtonVariant; size: ButtonSize; tone?: "session" | "onAccent" }) {
  const label = variant === "destructive" ? "Delete" : variant === "text" ? "Add a condition" : "Continue";
  return (
    <States
      items={[
        ...FORCE.map(
          ([name, f]) =>
            [name, <Button key={name} variant={variant} size={size} tone={tone} data-force={f}>{label}</Button>] as [string, React.ReactNode],
        ),
        ["Disabled", <Button key="d" variant={variant} size={size} tone={tone} disabled>{label}</Button>],
        ["Loading", <Button key="l" variant={variant} size={size} tone={tone} loading>{label}</Button>],
      ]}
    />
  );
}

export function ButtonsSection() {
  return (
    <KitSection
      id="buttons"
      title="Buttons"
      description="Primary (accent fill), secondary (border-control outline), text (accent 600, 44px tall), destructive (critical text). A 52px pill on the phone; 12px radius and 40px md height inside .desk."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Primary, lg (phone)">
          <ButtonStates variant="primary" size="lg" />
        </Specimen>
        <Specimen title="Primary, lg (portal)" desk>
          <ButtonStates variant="primary" size="lg" />
        </Specimen>
        <Specimen title="Secondary, md" surface="surface">
          <ButtonStates variant="secondary" size="md" />
        </Specimen>
        <Specimen title="Secondary, sm (portal End session)" surface="surface" desk>
          <ButtonStates variant="secondary" size="sm" />
        </Specimen>
        <Specimen title="Text">
          <ButtonStates variant="text" size="md" />
        </Specimen>
        <Specimen title="Destructive (text)">
          <ButtonStates variant="destructive" size="md" />
        </Specimen>
        <Specimen title="Danger (the confirm in a delete sheet)" surface="surface">
          <ButtonStates variant="danger" size="lg" />
        </Specimen>
        <Specimen title="On session indigo: primary is white with ink text" surface="session">
          <ButtonStates variant="primary" size="lg" tone="session" />
        </Specimen>
        <Specimen title="On session indigo: secondary is a white text link" surface="session">
          <ButtonStates variant="text" size="md" tone="session" />
        </Specimen>
        <Specimen title="On an accent card (Home's Share record)" surface="accent">
          <div className="flex flex-wrap gap-4">
            <ButtonLink href="#buttons" variant="primary" tone="onAccent" size="md" iconLeft={<Icon name="share" size={18} />}>
              Share record
            </ButtonLink>
          </div>
        </Specimen>
        <Specimen title="Icon buttons" note="Visible box 32, 36, 40 or 44; always a 44px tap target." surface="surface">
          <States
            items={[
              ["Back, 32", <IconButton key="a" label="Back" icon="chevron-left" size={32} />],
              ["Close, 36", <IconButton key="b" label="Close" icon="close" iconSize={22} size={36} tone="muted" />],
              ["Framed, 40", <IconButton key="c" label="Open session notes" icon="pencil" size={40} tone="framed" />],
              ["Focus", <IconButton key="d" label="Back" icon="chevron-left" size={32} data-force="focus" />],
            ]}
          />
        </Specimen>
      </div>
    </KitSection>
  );
}

export function TogglesSection() {
  const [tick, setTick] = useState(false);
  const [row, setRow] = useState(true);
  const [mental, setMental] = useState(false);
  const [notes, setNotes] = useState(true);
  const [tiles, setTiles] = useState({ cond: true, visits: true, timeline: false, care: true, mental: false });
  const flip = (k: keyof typeof tiles) => (v: boolean) => setTiles((t) => ({ ...t, [k]: v }));
  return (
    <KitSection
      id="toggles"
      title="Toggles"
      description="The tick-in-circle (BRIEF.md 3.5): no On or Off words. Off is a ring in ring-off, on is an accent disc with a white tick. Every one is role=switch with a name and a 44px target."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Tick indicator" surface="surface">
          <States
            items={[
              ["Off, 24", <TickIndicator key="a" checked={false} />],
              ["On, 24", <TickIndicator key="b" checked />],
              ["Off, 28", <TickIndicator key="c" checked={false} size={28} />],
              ["On, 28", <TickIndicator key="d" checked size={28} />],
              ["TickToggle", <TickToggle key="e" checked={tick} onCheckedChange={setTick} label="Include in shares" />],
            ]}
          />
        </Specimen>
        <Specimen title="On session indigo" surface="session">
          <States
            items={[
              ["Off", <TickIndicator key="a" checked={false} tone="session" />],
              ["On", <TickIndicator key="b" checked tone="session" />],
              ["TickToggle", <TickToggle key="c" checked={tick} onCheckedChange={setTick} label="Shared" tone="session" />],
            ]}
          />
        </Specimen>
        <Specimen title="ToggleRow, card (InsuranceA2)" width="phone">
          <ToggleRow surface="card" title="Include in shares" caption="Helpful for hospital stays" checked={row} onCheckedChange={setRow} />
        </Specimen>
        <Specimen title="SwitchRow in a SwitchGroup, LockedRow" width="phone">
          <SwitchGroup aria-label="What your doctor can see">
            <LockedRow title="Safety info" />
            <SwitchRow title="Mental health history" description="Off by default" checked={mental} onCheckedChange={setMental} />
          </SwitchGroup>
        </Specimen>
        <Specimen title="SwitchRow, tile with the track switch (ShareA2)" width="phone">
          <SwitchRow surface="tile" control="track" title="Doctor can add notes" checked={notes} onCheckedChange={setNotes} />
        </Specimen>
        <Specimen title="Bare track switch" surface="surface">
          <States
            items={[
              ["Off", <Switch key="a" checked={false} aria-label="Off example" />],
              ["On", <Switch key="b" checked aria-label="On example" />],
              ["Focus", <Switch key="c" checked aria-label="Focus example" data-force="focus" />],
            ]}
          />
        </Specimen>
        <Specimen title="Scope tiles (ShareA2)" note="Locked, on, off, off and private (dashed), wide." width="phone">
          <div className="grid grid-cols-2 gap-3">
            <ScopeTile locked icon="shield-alert" label="Safety info" />
            <ScopeTile locked icon="pill" label="Medications" />
            <ScopeTile icon="heart-pulse" label="Conditions" checked={tiles.cond} onCheckedChange={flip("cond")} />
            <ScopeTile icon="calendar" label="Recent visits" checked={tiles.visits} onCheckedChange={flip("visits")} />
            <ScopeTile icon="clock" label="Full timeline" checked={tiles.timeline} onCheckedChange={flip("timeline")} />
            <ScopeTile icon="people" label="Care team" checked={tiles.care} onCheckedChange={flip("care")} />
            <ScopeTile
              wide
              privateByDefault
              icon="smile"
              label="Mental health"
              caption="Private by default"
              checked={tiles.mental}
              onCheckedChange={flip("mental")}
            />
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}

export function SegmentedSection() {
  const [meds, setMeds] = useState<"current" | "past">("current");
  const [tl, setTl] = useState<"all" | "infection" | "condition">("all");
  const [dur, setDur] = useState("30m");
  const [tab, setTab] = useState<"timeline" | "conditions" | "family">("timeline");
  const [many, setMany] = useState("all");
  return (
    <KitSection
      id="segmented"
      title="Segmented control"
      description="A radiogroup that filters, or a tablist that switches panels. 40px segments on the phone, 44px for the share durations, 34px in the portal."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Radio, two options" width="phone">
          <SegmentedControl
            label="Medication list"
            value={meds}
            onChange={setMeds}
            options={[
              { value: "current", label: "Current" },
              { value: "past", label: "Past" },
            ]}
          />
        </Specimen>
        <Specimen title="Hover and focus pinned" width="phone">
          <SegmentedControl
            label="Show (pinned states)"
            value={tl}
            onChange={setTl}
            forceState="hover"
            options={[
              { value: "all", label: "All" },
              { value: "infection", label: "Infections" },
              { value: "condition", label: "Conditions" },
            ]}
          />
        </Specimen>
        <Specimen title="Radio, lg (For how long)" width="phone">
          <SegmentedControl
            label="For how long"
            size="lg"
            value={dur}
            onChange={setDur}
            options={[
              { value: "30m", label: "30 min" },
              { value: "1h", label: "1 hour" },
              { value: "all_day", label: "All day" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </Specimen>
        <Specimen title="Tabs, with a panel" width="phone">
          <div className="flex flex-col gap-3">
            <SegmentedControl
              mode="tabs"
              idBase="kit-record"
              label="Record sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: "timeline", label: "Timeline" },
                { value: "conditions", label: "Conditions" },
                { value: "family", label: "Family" },
              ]}
            />
            <div {...tabPanelProps("kit-record", tab)} className="text-body text-ink-2">
              The {tab} panel.
            </div>
          </div>
        </Specimen>
        <Specimen title="Portal (34px, radius 12 / 8)" desk surface="surface">
          <SegmentedControl
            label="Show (portal)"
            className="max-w-[292px]"
            value={tl}
            onChange={setTl}
            options={[
              { value: "all", label: "All" },
              { value: "infection", label: "Infections" },
              { value: "condition", label: "Conditions" },
            ]}
          />
        </Specimen>
        <Specimen title="Not filled: scrolls inside itself" desk surface="surface" className="max-w-[320px]">
          <SegmentedControl
            label="Filter the timeline (example)"
            fill={false}
            value={many}
            onChange={setMany}
            options={["all", "visit", "result", "prescription", "note", "letter"].map((v) => ({
              value: v,
              label: v === "all" ? "All" : `${v[0].toUpperCase()}${v.slice(1)}s`,
            }))}
          />
        </Specimen>
      </div>
    </KitSection>
  );
}

export function FormsSection() {
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  return (
    <KitSection
      id="forms"
      title="Inputs"
      description="BRIEF.md section 7: white, 1px border-control, radius 16 and 56px tall on the phone (12 and 44px in the portal), visible labels, errors in words in the critical colour with an icon."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Text field states" width="phone">
          <div className="flex flex-col gap-5">
            <TextField label="First name" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jane" />
            <TextField label="Email address" hint="We send a code, never a password." value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Focused" data-force="focus" defaultValue="Rathmines" />
            <TextField label="Date of birth" error="Enter a date like 12/03/1991" defaultValue="31/02" />
            <TextField label="Disabled" disabled defaultValue="Dublin" />
            <TextField label="Practice" optional />
          </div>
        </Specimen>
        <Specimen title="Select and text area" width="phone">
          <div className="flex flex-col gap-5">
            <SelectField
              label="Country"
              placeholder="Select a country"
              options={[
                { value: "IE", label: "Ireland" },
                { value: "UK", label: "United Kingdom" },
              ]}
            />
            <TextArea label="Note" placeholder="Symptoms, questions, observations" />
          </div>
        </Specimen>
        <Specimen title="Portal fields" desk surface="ground" className="max-w-[340px]">
          <div className="flex flex-col gap-3">
            <TextArea label="Chief complaint" density="compact" rows={3} />
            <TextField label="Your name" />
          </div>
        </Specimen>
        <Specimen title="Code input, portal (112px boxes)" desk surface="ground">
          <div className="flex flex-col gap-6">
            <CodeInput length={4} size="lg" label="Patient's share code" labelHidden value={code} onChange={setCode} />
            <CodeInput length={4} size="lg" label="Focused code (example)" labelHidden value="72" onChange={() => {}} forceFocus />
            <CodeInput length={4} size="lg" label="Wrong code (example)" labelHidden value="7294" onChange={() => {}} error="Wrong code. 2 tries left before a 15 minute pause." />
            <CodeInput length={4} size="lg" label="Wrong code, focused (example)" labelHidden value="" onChange={() => {}} forceFocus error="That code doesn't match. 3 tries left before a 15 minute pause." />
            <CodeInput length={4} size="lg" label="Locked code (example)" labelHidden value="" onChange={() => {}} disabled />
          </div>
        </Specimen>
        <Specimen title="Code input, phone (email code)" width="phone">
          <CodeInput length={6} label="6-digit code (example)" value="4821" onChange={() => {}} hint="Or open the link in the email on this device." />
        </Specimen>
      </div>
    </KitSection>
  );
}
