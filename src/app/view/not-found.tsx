import type { Metadata } from "next";
import { PortalShell } from "@/components/layout/PortalShell";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSplit } from "@/components/portal/PortalSplit";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

/**
 * A mistyped portal address (/view/anything): the portal's own frame and a
 * way back to the code step, not the patient app's page and its link to /.
 */
export default function PortalNotFound() {
  return (
    <PortalShell tone="ground" header={<PortalHeader />} footer={<PortalFooter />}>
      <PortalSplit>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-2.5">
            <p className="text-caption font-medium text-ink-2">Page not found</p>
            <h1 className="font-display text-display font-light">There is nothing at this address.</h1>
            <p className="text-body-lg text-ink-2">Check the address, or go to the portal to enter a code.</p>
          </div>
          <ButtonLink href="/view" size="lg" className="w-full sm:w-55">
            Go to the portal
          </ButtonLink>
        </div>
      </PortalSplit>
    </PortalShell>
  );
}
