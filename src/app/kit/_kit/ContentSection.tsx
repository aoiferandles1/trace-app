"use client";

import { useState } from "react";
import { PageHeader } from "@/components/patient/PageHeader";
import { ProgressHeader } from "@/components/patient/ProgressHeader";
import { PatientRail } from "@/components/patient/PatientRail";
import { TabBar, type TabKey } from "@/components/patient/TabBar";
import { Avatar, Card, SectionHeading, SectionLabel } from "@/components/ui/Card";
import { CodeDisplay } from "@/components/ui/CodeDisplay";
import { DateTile, DateTileRow } from "@/components/ui/DateTile";
import { DemoStrip } from "@/components/ui/DemoStrip";
import { DayMonth, ListRow, SelectableRow, YearRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { PageState, StateMessage } from "@/components/ui/StateMessage";
import { KitSection, Specimen, States } from "./Specimen";

const TAB_STATES: Array<TabKey | "none"> = ["home", "record", "add", "meds", "profile"];

export function ListsSection() {
  const [sel, setSel] = useState(1);
  const [year, setYear] = useState("e1");
  return (
    <KitSection
      id="lists"
      title="Cards and rows"
      description="A card is surface with a 1px border-card edge, radius 24 (12 in the portal). Rows inside are divided by border-row, none after the last. Icons are bare: never in a tinted circle."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Card of ListRows (MainA2 Recent)" width="phone">
          <Card as="ul">
            <li>
              <ListRow icon="drop" title="Blood count and INR" caption="Result" value="2 Nov" href="#lists" />
            </li>
            <li>
              <ListRow icon="pencil" title="Fatigue symptoms" caption="Note" value="31 Oct" href="#lists" />
            </li>
            <li>
              <ListRow icon="pill" title="Warfarin renewed" caption="Prescription" value="30 Oct" href="#lists" />
            </li>
          </Card>
        </Specimen>
        <Specimen title="Values: numeral, accent, chevron, urgent caption (MedsA2, RecordA2)" width="phone">
          <Card as="ul">
            <li>
              <ListRow title="Concerta" caption="Morning, 5 strength changes" value="36mg" valueStyle="numeral" chevron href="#lists" />
            </li>
            <li>
              <ListRow title="Warfarin" caption="Evening, 8 days left" captionTone="urgent" value="5mg" valueStyle="numeral" />
            </li>
            <li>
              <ListRow icon="calendar" title="Cardiology follow-up" caption="Visit" value="29 Dec" valueStyle="accent" />
            </li>
            <li>
              <ListRow title="Atrial fibrillation" caption="Dr O'Mahony, since 2019" value="Managed" />
            </li>
          </Card>
        </Specimen>
        <Specimen title="Year-grouped rows (TimelineA2)" width="phone">
          <Card as="ul">
            {[
              ["2026", true, "Chest infection", "Aug, Infection"],
              ["2026", false, "Asthma flare", "Feb, Condition"],
              ["2025", true, "Urinary tract infection", "Sep, Infection"],
            ].map(([y, show, t, c]) => (
              <li key={t as string}>
                <YearRow year={y as string} showYear={show as boolean} current={y === "2026"} title={t} caption={c} onClick={() => {}} />
              </li>
            ))}
          </Card>
        </Specimen>
        <Specimen title="Two-pane list rows with the 3px bar (PortalRecordE)" desk surface="surface" className="max-w-[340px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              {[
                ["11", "Nov", "GP visit", "Visit"],
                ["2", "Nov", "Blood count and INR", "Result"],
                ["30", "Oct", "Warfarin renewed", "Prescription"],
              ].map(([d, m, t, k], i) => (
                <SelectableRow
                  key={t}
                  selected={sel === i}
                  onClick={() => setSel(i)}
                  leading={<DayMonth day={d} month={m} />}
                  title={t}
                  caption={k}
                />
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              {[
                ["e1", "2026", "Chest infection", "Aug, Infection"],
                ["e2", "", "Asthma flare", "Feb, Condition"],
              ].map(([id, y, t, c]) => (
                <SelectableRow
                  key={id}
                  selected={year === id}
                  onClick={() => setYear(id)}
                  leadingWidth={56}
                  leading={<span className="font-display text-year font-light text-accent">{y}</span>}
                  title={t}
                  caption={c}
                />
              ))}
              <SelectableRow selected={false} onClick={() => {}} title="Levothyroxine" caption="Morning" value="50mcg" />
            </div>
          </div>
        </Specimen>
        <Specimen title="Coming up date tiles (MainA2)" width="phone" className="overflow-hidden">
          <section aria-labelledby="kit-coming" className="flex flex-col gap-2">
            <SectionHeading id="kit-coming">Coming up</SectionHeading>
            <DateTileRow label="Coming up">
              <li>
                <DateTile urgent badge="8 days" icon="pill" day={19} month="Nov" title="Warfarin refill" href="#lists" />
              </li>
              <li>
                <DateTile icon="drop" day={25} month="Nov" title="INR blood test" href="#lists" />
              </li>
              <li>
                <DateTile icon="heart" day={29} month="Dec" title="Cardiology" href="#lists" />
              </li>
            </DateTileRow>
          </section>
        </Specimen>
        <Specimen title="Avatars" surface="surface">
          <States
            items={[
              ["outline 40", <Avatar key="a" initials="JD" size={40} tone="outline" />],
              ["tint 44", <Avatar key="b" initials="DH" size={44} tone="tint" />],
              ["tint 52", <Avatar key="c" initials="DW" size={52} tone="tint" />],
              ["solid 56", <Avatar key="d" initials="DH" size={56} tone="solid" />],
              ["solid 56, Sora", <Avatar key="e" initials="JD" size={56} tone="solid" display />],
            ]}
          />
        </Specimen>
        <Specimen title="Avatars on session indigo and accent" surface="session">
          <div className="flex items-end gap-6">
            <Avatar initials="DH" size={88} tone="session" display />
            <span className="rounded-feature bg-accent p-3">
              <Avatar initials="DH" size={48} tone="onAccent" />
            </span>
          </div>
        </Specimen>
        <Specimen title="Section heading and label" width="phone">
          <div className="flex flex-col gap-3">
            <SectionHeading as="h3">History</SectionHeading>
            <SectionLabel as="h3">For how long</SectionLabel>
          </div>
        </Specimen>
      </div>
    </KitSection>
  );
}

export function FramesSection() {
  return (
    <KitSection
      id="frames"
      title="Headers, strips and the tab bar"
      description="Page header 56px with the title in Sora 300; detail screens add a 32px back arrow at the page edge. The demo strip is 28px. The tab bar is 68px with the one filled circle, Add."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Page header" bleed>
          <div className="w-full max-w-[390px]">
            <PageHeader title="Record" />
            <PageHeader title="Concerta" backHref="#frames" backLabel="Back to Medications" subtitle="Now 36mg, since Feb 2025" />
            <PageHeader title="Family history" size="md" backHref="#frames" backLabel="Back to Record" />
            <PageHeader
              variant="greeting"
              subtitle="Good afternoon"
              title="Jane"
              action={<Avatar initials="JD" size={40} tone="outline" />}
            />
          </div>
        </Specimen>
        <Specimen title="On session indigo" surface="session" bleed>
          <div className="w-full max-w-[390px]">
            <DemoStrip tone="session" />
            <PageHeader title="Share your record" size="md" tone="session" backHref="#frames" />
          </div>
        </Specimen>
        <Specimen title="Demo strip and sign-up progress" bleed>
          <div className="w-full max-w-[390px]">
            <DemoStrip />
            <ProgressHeader step={3} backHref="#frames" />
          </div>
        </Specimen>
        <Specimen title="Tab bar, each tab active" className="flex flex-col gap-3">
          {TAB_STATES.map((k) => (
            <div key={k} className="w-full max-w-[390px]">
              <TabBar active={k} />
            </div>
          ))}
        </Specimen>
        <Specimen title="Patient rail (desktop, from 1024px), Record and Profile active" className="flex flex-wrap gap-3">
          <PatientRail active="record" className="h-90" />
          <PatientRail active="profile" className="h-90" />
        </Specimen>
      </div>
    </KitSection>
  );
}

export function MessagesSection() {
  return (
    <KitSection
      id="messages"
      title="Notices, empty and error states"
      description="One line of ink-2 text and one text button; no illustration. Notices have no fill except where a tint means something (urgent, not shared)."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <Specimen title="Notice tones" width="phone">
          <div className="flex flex-col gap-4">
            <Notice>Personal note. Only you can see it.</Notice>
            <Notice tone="critical">This couldn&apos;t be saved. Check your connection and try again.</Notice>
            <Notice tone="urgent">A doctor can already see your record.</Notice>
            <Notice tone="locked">Not included in this share: Full timeline, Documents.</Notice>
          </div>
        </Specimen>
        <Specimen title="Notice on session indigo" surface="session" width="phone">
          <Notice tone="critical" surface="session">
            The code could not be made. Try again.
          </Notice>
        </Specimen>
        <Specimen title="Empty and error states" width="phone">
          <div className="flex flex-col gap-6">
            <StateMessage message="No current medications." action={{ label: "Add a medication", href: "#messages" }} />
            <StateMessage tone="error" message="This couldn't load. Check your connection and try again." action={{ label: "Try again", onClick: () => {} }} />
          </div>
        </Specimen>
        <Specimen title="Page state (404, expired, no access)" surface="surface">
          <PageState
            title="This page isn't here"
            message="The link may be old, or the page was moved."
            action={{ label: "Go to Home", href: "#messages" }}
            className="py-6"
          />
        </Specimen>
        <Specimen title="Share code (CodeA2)" surface="session" width="phone">
          <CodeDisplay code="9070" />
        </Specimen>
        <Specimen title="Share code, tap to copy (onCopy)" surface="session" width="phone">
          <CodeDisplay code="9070" onCopy={() => {}} />
        </Specimen>
      </div>
    </KitSection>
  );
}
