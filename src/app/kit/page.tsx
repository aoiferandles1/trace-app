import Link from "next/link";
import { ActionsSection, FormsSection } from "./_kit/FormsSection";
import { DisplaySection } from "./_kit/DisplaySection";
import { PatientSection } from "./_kit/PatientSection";
import { PortalSection } from "./_kit/PortalSection";
import { TokensSection } from "./_kit/TokensSection";

const NAV = [
  ["tokens", "Tokens"],
  ["actions", "Buttons"],
  ["forms", "Forms"],
  ["display", "Chips and cards"],
  ["patient", "Patient"],
  ["portal", "Portal"],
] as const;

export default function KitPage() {
  return (
    <div className="min-h-dvh bg-surface-page">
      <header className="sticky top-0 z-40 border-b border-border-default bg-surface-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-8">
          <p className="text-h3 font-medium text-indigo-text">
            trace <span className="text-body-sm text-text-tertiary">UI kit</span>
          </p>
          <nav aria-label="Kit sections">
            <ul className="flex flex-wrap gap-x-1">
              {NAV.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm text-indigo-text hovered:bg-brand-indigo-tint">
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/kit/patient" className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm text-indigo-text hovered:bg-brand-indigo-tint">
                  Patient shell
                </Link>
              </li>
              <li>
                <Link href="/kit/portal" className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm text-indigo-text hovered:bg-brand-indigo-tint">
                  Portal shell
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-16 px-4 pb-24 pt-10 sm:px-8">
        <div>
          <h1 className="font-display text-h1 font-light">UI kit</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-text-tertiary">
            Every Trace component in every state, built from the Figma Design System page. Development only.
            Accessibility substitutions are listed in docs/REVIEW.md.
          </p>
        </div>
        <TokensSection />
        <ActionsSection />
        <FormsSection />
        <DisplaySection />
        <PatientSection />
        <PortalSection />
      </main>
    </div>
  );
}
