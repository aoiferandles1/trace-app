"use client";

import { Calendar, Clock, Share2, Stethoscope } from "lucide-react";
import { useState } from "react";
import { BannerCard } from "@/components/ui/BannerCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Avatar, Card, Eyebrow, SectionLabel } from "@/components/ui/Card";
import { HintStrip } from "@/components/ui/HintStrip";
import { Pill, type Tone } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AccessRequestPreview } from "./AccessRequestPreview";
import { KitSection, Specimen, StateLabel } from "./Specimen";

const TONES: Tone[] = ["indigo", "teal", "peach", "red", "neutral"];

export function DisplaySection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<string>("");

  return (
    <KitSection id="display" title="Chips, cards and feedback">
      <Specimen title="Pills (tags)" note="Five tones, solid or outlined, three sizes. Not interactive.">
        <div className="flex flex-col gap-4">
          {(["solid", "outlined"] as const).map((variant) =>
            (["sm", "md", "lg"] as const).map((size) => (
              <div key={`${variant}-${size}`} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-body-tiny text-text-tertiary">
                  {variant} · {size}
                </span>
                {TONES.map((tone) => (
                  <Pill key={tone} tone={tone} variant={variant} size={size}>
                    {tone}
                  </Pill>
                ))}
              </div>
            )),
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-body-tiny text-text-tertiary">with dot, icon</span>
            <Pill tone="teal" size="md" dot>
              Shared
            </Pill>
            <Pill tone="indigo" size="md" icon={<Clock aria-hidden="true" className="size-3.5" />}>
              30 min
            </Pill>
          </div>
        </div>
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen title="Section label, eyebrow, avatar">
          <div className="flex flex-col gap-4">
            <SectionLabel as="p">Quick actions</SectionLabel>
            <div className="flex flex-wrap gap-4">
              <Eyebrow>About You</Eyebrow>
              <Eyebrow tone="teal">Teal</Eyebrow>
              <Eyebrow tone="peach">Peach</Eyebrow>
              <Eyebrow tone="red">Red</Eyebrow>
              <Eyebrow tone="neutral">Neutral</Eyebrow>
              <Eyebrow uppercase>New session</Eyebrow>
            </div>
            <div className="flex items-center gap-3">
              <Avatar initials="DH" size="sm" />
              <Avatar initials="DH" />
              <Avatar initials="JD" size="lg" tone="solid" label="Jane Doe" />
            </div>
          </div>
        </Specimen>
        <Specimen title="Card" note="White, 16px radius, Border/Default, Shadow/SM.">
          <Card>
            <p className="text-h4 font-bold">Card title</p>
            <p className="text-body-sm text-text-tertiary">Any content goes here.</p>
          </Card>
        </Specimen>
      </div>

      <Specimen title="Banner cards">
        <div className="flex max-w-[400px] flex-col gap-4">
          <BannerCard
            tone="indigo"
            icon={<Calendar />}
            eyebrow="Upcoming"
            title="GP visit · Dr Hennessy"
            meta="Wed 14 Jan · 9:30am · Rathmines Medical Centre"
            badge="2d"
            badgeLabel="in 2 days"
            href="#display"
          />
          <BannerCard
            tone="indigo"
            icon={<Share2 />}
            eyebrow="Sharing in progress"
            title="Dr Hennessy · GP visit"
            meta="Ends at 10:05am · View session"
            badge="24:12"
            badgeLabel="24 minutes left"
            href="#display"
          />
          <BannerCard
            tone="peach"
            icon={<Clock />}
            eyebrow="Refill due soon"
            eyebrowCaps
            title="Warfarin 5mg · 8 days left"
            meta="Dr O'Mahony · Mater Private"
            badge="8d"
            badgeLabel="in 8 days"
          />
          <BannerCard tone="teal" icon={<Stethoscope />} eyebrow="Session notes" title="Notes from Dr Hennessy" meta="Added to your record" />
          <BannerCard tone="neutral" icon={<Calendar />} eyebrow="Nothing booked" title="No upcoming visits" meta="Log one from Add" />
        </div>
      </Specimen>

      <Specimen title="Hint strips">
        <div className="flex max-w-[400px] flex-col gap-3">
          <HintStrip tone="indigo">3 active prescriptions · 2 expired in the last 12 months</HintStrip>
          <HintStrip tone="neutral">Full timeline, documents, insurance and mental health not included</HintStrip>
          <HintStrip tone="peach">Your code expires in 2 minutes.</HintStrip>
          <HintStrip tone="teal">Notes saved to your record.</HintStrip>
          <HintStrip tone="danger">Anonymous sign-ins are switched off, so the demo can&rsquo;t start right now.</HintStrip>
        </div>
      </Specimen>

      <Specimen title="Progress bar">
        <div className="flex max-w-[400px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <ProgressBar value={3} max={7} label="Sign-up progress" valueText="Step 3 of 7" />
            <StateLabel>thin, 3 of 7</StateLabel>
          </div>
          <div className="on-dark rounded-card bg-indigo-accessible p-4">
            <ProgressBar
              value={1471}
              max={1800}
              tone="onDark"
              thickness="thick"
              label="Time remaining"
              valueText="24 minutes 31 seconds"
            />
          </div>
        </div>
      </Specimen>

      <Specimen
        title="Bottom sheet"
        note="A modal dialog: focus moves in, is trapped, and returns to the button on close. Allow and Deny have equal weight."
      >
        <div className="flex flex-col items-start gap-3">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open the access request
          </Button>
          <p role="status" className="text-body-sm text-text-tertiary">
            {lastAnswer && `Last answer: ${lastAnswer}`}
          </p>
        </div>
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          eyebrow="Access request"
          title="Dr Hennessy wants access"
          dismissible={false}
          actions={
            <>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setLastAnswer("allowed");
                  setSheetOpen(false);
                }}
              >
                Allow access
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setLastAnswer("denied");
                  setSheetOpen(false);
                }}
              >
                Deny access
              </Button>
            </>
          }
        >
          <AccessRequestPreview />
        </BottomSheet>
      </Specimen>
    </KitSection>
  );
}
