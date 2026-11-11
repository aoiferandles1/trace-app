import Link from "next/link";
import { ButtonsSection, FormsSection, SegmentedSection, TogglesSection } from "./_kit/ControlsSection";
import { FramesSection, ListsSection, MessagesSection } from "./_kit/ContentSection";
import { DataSection } from "./_kit/DataSection";
import { PatientPiecesSection, PortalPiecesSection, SheetsSection } from "./_kit/PiecesSection";
import { TokensSection } from "./_kit/TokensSection";

const NAV = [
  ["tokens", "Tokens"],
  ["buttons", "Buttons"],
  ["toggles", "Toggles"],
  ["segmented", "Segmented"],
  ["forms", "Inputs"],
  ["lists", "Cards and rows"],
  ["frames", "Headers"],
  ["messages", "States"],
  ["data", "Charts"],
  ["sheets", "Sheets"],
  ["patient", "Patient"],
  ["portal", "Portal"],
] as const;

const navLink = "inline-flex min-h-11 items-center px-2 text-caption font-medium text-accent hovered:underline";

export default function KitPage() {
  return (
    <div className="min-h-dvh bg-ground">
      <header className="sticky top-0 z-40 border-b border-border-tabbar bg-ground">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 sm:px-8">
          <p className="font-display text-heading font-light">
            trace <span className="font-sans text-caption text-ink-2">UI kit</span>
          </p>
          <nav aria-label="Kit sections">
            <ul className="flex flex-wrap">
              {NAV.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className={navLink}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/kit/patient" className={navLink}>
                  Patient shell
                </Link>
              </li>
              <li>
                <Link href="/kit/portal" className={navLink}>
                  Portal shell
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-16 px-5 pb-24 pt-10 sm:px-8">
        <div>
          <h1 className="font-display text-display font-light">UI kit</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-ink-2">
            Every Trace component in every state, on ground, on surface and on session indigo, with phone and desktop
            tokens. Built from docs/redesign (BRIEF.md sections 2, 3 and 7, and the canvas boards). Development only.
          </p>
        </div>
        <TokensSection />
        <ButtonsSection />
        <TogglesSection />
        <SegmentedSection />
        <FormsSection />
        <ListsSection />
        <FramesSection />
        <MessagesSection />
        <DataSection />
        <SheetsSection />
        <PatientPiecesSection />
        <PortalPiecesSection />
      </main>
    </div>
  );
}
