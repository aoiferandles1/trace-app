"use client";

import { ArrowRight, ChevronLeft, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { ChoiceCardGroup } from "@/components/ui/ChoiceCardGroup";
import { CodeInput } from "@/components/ui/CodeInput";
import { FilterTabs, tabPanelProps } from "@/components/ui/FilterTabs";
import { IconButton } from "@/components/ui/IconButton";
import { SelectField } from "@/components/ui/SelectField";
import { LockedRow, Switch, SwitchGroup, SwitchRow } from "@/components/ui/Switch";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { KitSection, Specimen, StateLabel } from "./Specimen";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const STATES = ["default", "hover", "press", "focus", "disabled", "loading"] as const;

function ButtonStates({ variant, size }: { variant: ButtonVariant; size: ButtonSize }) {
  return (
    <>
      {STATES.map((state) => (
        <div key={state} className="flex flex-col items-start gap-1.5">
          <Button
            variant={variant}
            size={size}
            data-force={state === "hover" || state === "press" || state === "focus" ? state : undefined}
            disabled={state === "disabled"}
            loading={state === "loading"}
          >
            Share record
          </Button>
          <StateLabel>{state}</StateLabel>
        </div>
      ))}
    </>
  );
}

const COUNTRIES = [
  { value: "ie", label: "Ireland" },
  { value: "gb", label: "United Kingdom" },
  { value: "other", label: "Somewhere else" },
];

export function ActionsSection() {
  return (
    <KitSection
      id="actions"
      title="Buttons"
      description="Primary, secondary, tertiary and ghost in three sizes. Hover, press and focus are pinned here with data-force; on screens they come from the pointer and keyboard."
    >
      {VARIANTS.map((variant) => (
        <Specimen key={variant} title={`${variant[0].toUpperCase()}${variant.slice(1)}`}>
          <div className="flex flex-col gap-6">
            {SIZES.map((size) => (
              <div key={size} className="flex flex-col gap-2">
                <StateLabel>size {size}</StateLabel>
                <div className="flex flex-wrap items-start gap-4">
                  <ButtonStates variant={variant} size={size} />
                </div>
              </div>
            ))}
          </div>
        </Specimen>
      ))}
      <Specimen title="Tertiary" note="White button for indigo surfaces (Share your record now, End sharing now)." surface="indigo">
        <div className="flex flex-col gap-6">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-start gap-4">
              <ButtonStates variant="tertiary" size={size} />
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen title="With icons, full width, as a link">
        <div className="flex max-w-sm flex-col gap-3">
          <Button iconLeft={<Plus aria-hidden="true" className="size-4" />}>Add medication</Button>
          <Button variant="secondary" iconRight={<ArrowRight aria-hidden="true" className="size-4" />}>
            Continue
          </Button>
          <ButtonLink href="#forms" size="lg" fullWidth>
            Generate share code (link)
          </ButtonLink>
        </div>
      </Specimen>
      <Specimen title="Icon buttons" note="44 x 44 target, label required.">
        <div className="flex gap-3">
          <IconButton label="Back" icon={<ChevronLeft />} />
          <IconButton label="Search" icon={<Search />} tone="muted" />
          <IconButton label="Close" icon={<X />} data-force="focus" />
        </div>
      </Specimen>
    </KitSection>
  );
}

export function FormsSection() {
  const [name, setName] = useState("Jane");
  const [country, setCountry] = useState("");
  const [code4, setCode4] = useState("");
  const [code6, setCode6] = useState("");
  const [conditions, setConditions] = useState(true);
  const [mental, setMental] = useState(false);
  const [notesOn, setNotesOn] = useState(true);
  const [duration, setDuration] = useState<"30m" | "1h" | "all_day" | "manual">("30m");
  const [tab, setTab] = useState<"current" | "expired">("current");
  const [filter, setFilter] = useState<"all" | "letters" | "results" | "imaging" | "vitals">("all");

  return (
    <KitSection
      id="forms"
      title="Form controls"
      description="Every field has a visible label, hints and errors tied to it with aria-describedby, and errors in words. Field outlines use Border/Control (3:1) instead of Border/Default."
    >
      <Specimen title="Text field" surface="page">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField label="First name" placeholder="Jane" hint="As it appears on your medical records" />
          <TextField label="First name (focused)" defaultValue="Jane" data-force="focus" hint="As it appears on your medical records" />
          <TextField
            label="First name (filled)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="As it appears on your medical records"
          />
          <TextField
            label="Email"
            type="email"
            defaultValue="jane@example"
            error="Enter an email address like name@example.ie"
            hint="We'll send a code to this address."
          />
          <TextField label="Email (disabled)" defaultValue="jane@example.ie" disabled hint="We'll send a code to this address." />
          <TextField label="Phone" optional type="tel" placeholder="+353 86 123 4567" />
        </div>
      </Specimen>

      <Specimen title="Text area">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextArea label="Note" placeholder="How are you feeling?" hint="Personal notes are never shared with a doctor." />
          <TextArea label="Note (error)" error="Write something before saving" />
          <TextArea label="Chief complaint" labelStyle="eyebrow" density="compact" placeholder="Type notes here..." />
          <TextArea label="Note (disabled)" disabled defaultValue="Fatigue symptoms after starting Warfarin." />
        </div>
      </Specimen>

      <Specimen title="Select">
        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField
            label="Country"
            placeholder="Select a country"
            options={COUNTRIES}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            hint="Used to verify your identity with healthcare providers"
          />
          <SelectField label="Country (focused)" options={COUNTRIES} defaultValue="ie" data-force="focus" />
          <SelectField label="Sex" placeholder="Select" options={[{ value: "f", label: "Female" }]} error="Choose an option" />
          <SelectField label="Country (disabled)" options={COUNTRIES} defaultValue="ie" disabled />
        </div>
      </Specimen>

      <Specimen title="Code input" note="One real input over the boxes: paste, numeric keyboard and one-time-code autofill work.">
        <div className="flex max-w-[420px] flex-col gap-8">
          <CodeInput length={4} label="Patient's share code" value={code4} onChange={setCode4} hint="Type it, or paste it" />
          <CodeInput length={4} label="Share code (focused, partly typed)" value="72" onChange={() => {}} forceFocus />
          <CodeInput length={4} label="Share code (filled)" value="7294" onChange={() => {}} />
          <CodeInput
            length={4}
            label="Share code (error)"
            value="7295"
            onChange={() => {}}
            error="That code doesn't match. Check it with your patient and try again."
          />
          <CodeInput length={4} label="Share code (locked)" value="" onChange={() => {}} disabled hint="Too many attempts. Try again in 15 minutes." />
          <CodeInput length={6} label="Code from your email" value={code6} onChange={setCode6} />
        </div>
      </Specimen>

      <Specimen title="Switch">
        <div className="flex flex-wrap items-center gap-8">
          {(
            [
              ["Off", false, "default"],
              ["On", true, "default"],
              ["Off, critical", false, "critical"],
              ["On, critical", true, "critical"],
            ] as const
          ).map(([label, checked, tone]) => (
            <div key={label} className="flex flex-col items-start gap-1.5">
              <Switch checked={checked} tone={tone} aria-label={`Example switch, ${label}`} />
              <StateLabel>{label}</StateLabel>
            </div>
          ))}
          <div className="flex flex-col items-start gap-1.5">
            <Switch checked aria-label="Example switch, focused" data-force="focus" />
            <StateLabel>Focus</StateLabel>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <Switch checked={false} disabled aria-label="Example switch, disabled" />
            <StateLabel>Disabled</StateLabel>
          </div>
        </div>
      </Specimen>

      <Specimen title="Switch rows (Confirm preferences)">
        <div className="flex max-w-[400px] flex-col gap-4">
          <SwitchGroup aria-label="What your doctor will see">
            <LockedRow title="Critical safety" tone="critical" />
            <LockedRow title="Medications" />
            <SwitchRow title="Active conditions" checked={conditions} onCheckedChange={setConditions} />
            <SwitchRow title="Full timeline" checked={false} />
          </SwitchGroup>
          <SwitchRow
            surface="sunken"
            title="Mental health history"
            description="Off by default · tap to include"
            checked={mental}
            onCheckedChange={setMental}
          />
          <SwitchRow
            surface="sunken"
            title="Doctor can add session notes"
            description="Notes are added to your record when the session ends"
            checked={notesOn}
            onCheckedChange={setNotesOn}
          />
        </div>
      </Specimen>

      <Specimen title="Choice cards">
        <ChoiceCardGroup
          legend="Share for"
          className="max-w-[400px]"
          value={duration}
          onChange={setDuration}
          options={[
            { value: "30m", label: "30 min", description: "Standard GP" },
            { value: "1h", label: "1 hour", description: "Longer visit" },
            { value: "all_day", label: "All day", description: "Hospital stay" },
            { value: "manual", label: "Manual", description: "I'll stop it" },
          ]}
        />
      </Specimen>

      <Specimen title="Filter tabs" note="Tablist with arrow keys. Equal width (p-meds) or scrolling chips.">
        <div className="flex max-w-[400px] flex-col gap-6">
          <FilterTabs
            idBase="kit-meds"
            label="Medication status"
            fill
            value={tab}
            onChange={setTab}
            items={[
              { value: "current", label: "Current" },
              { value: "expired", label: "Expired" },
            ]}
          />
          <div {...tabPanelProps("kit-meds", tab)} className="text-body-sm text-text-tertiary">
            Showing {tab} medications.
          </div>
          <FilterTabs
            idBase="kit-filter"
            label="Record type"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: "All" },
              { value: "letters", label: "Letters" },
              { value: "results", label: "Results" },
              { value: "imaging", label: "Imaging" },
              { value: "vitals", label: "Vitals" },
            ]}
          />
          <div {...tabPanelProps("kit-filter", filter)} className="text-body-sm text-text-tertiary">
            Filter: {filter}
          </div>
          <FilterTabs
            idBase="kit-hover"
            label="Hover state example"
            value="a"
            onChange={() => {}}
            forceState="hover"
            items={[
              { value: "a", label: "Active" },
              { value: "b", label: "Hovered" },
            ]}
          />
          <div {...tabPanelProps("kit-hover", "a")} className="sr-only">
            Hover example panel
          </div>
        </div>
      </Specimen>
    </KitSection>
  );
}
