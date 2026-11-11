"use client";

import type { ReactNode } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDay } from "@/lib/dates";
import { fullName } from "@/lib/patient/types";
import { cn } from "@/lib/cn";
import { SubScreen } from "../../_components/Screens";

/**
 * Your details (Profile's first row; no board): the personal details and
 * critical safety facts as they are stored, and "Edit details".
 */
function DetailsScreen() {
  const { profile, email } = usePatientSession();
  const name = fullName(profile);
  return (
    <SubScreen
      title="Your details"
      backHref="/profile"
      backLabel="Back to Profile"
      footer={
        <ButtonLink href="/profile/edit" size="lg" fullWidth>
          Edit details
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
        <Card as="article" className="px-4.5">
          <dl className="divide-y divide-border-row">
            <InfoRow label="Full name" value={name} />
            <InfoRow label="Date of birth" value={profile.date_of_birth && formatDay(profile.date_of_birth)} />
            <InfoRow label="Sex" value={profile.sex} />
            <InfoRow label="Address" value={profile.address || profile.city} />
            <InfoRow label="Phone" value={profile.phone} />
            {email && <InfoRow label="Email" value={email} />}
          </dl>
        </Card>
        <Card as="article" className="px-4.5" aria-label="Critical safety">
          <dl className="divide-y divide-border-row">
            <InfoRow label="Blood type" value={profile.blood_type} />
            <InfoRow label="Allergies" value={profile.allergies.join(", ")} />
            <InfoRow label="Implants or devices" value={profile.implants.join(", ")} />
          </dl>
        </Card>
      </div>
    </SubScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-3">
      <dt className="shrink-0 text-caption text-ink-2">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-words text-right text-body", value ? "text-ink" : "text-ink-2")}>
        {value || "Not added"}
      </dd>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <SessionReady>
      <DetailsScreen />
    </SessionReady>
  );
}
