"use client";

import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { leaveForWelcome, SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { PageHeader } from "@/components/patient/PageHeader";
import { useShareSession } from "@/components/patient/ShareSession";
import { StatTile } from "@/components/patient/StatTile";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, Card, SectionHeading } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { dayKey, formatDay } from "@/lib/dates";
import { initialsOf } from "@/lib/format";
import { isOpen } from "@/lib/patient/share";
import { fullName, isCurrentMedication, type CareMember } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { cn } from "@/lib/cn";
import { LoadStatus, TabScreen } from "../_components/Screens";

const KIND_ORDER = { gp: 0, specialist: 1, pharmacy: 2 } as Record<string, number>;
const KIND_LABEL = { gp: "GP", specialist: "Specialist", pharmacy: "Pharmacy" } as Record<string, string>;
const COUNTRY_CODES: Record<string, string> = { Ireland: "IE", "United Kingdom": "UK" };

async function loadProfile() {
  const supabase = createClient();
  const [entries, meds, conditions, team] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }),
    supabase.from("medications").select("ended_on"),
    supabase.from("conditions").select("id", { count: "exact", head: true }),
    supabase.from("care_team").select("*").order("created_at", { ascending: true }),
  ]);
  if (entries.error) throw entries.error;
  if (conditions.error) throw conditions.error;
  const today = dayKey();
  return {
    records: entries.count ?? 0,
    medications: must(meds).filter((m) => isCurrentMedication(m, today)).length,
    conditions: conditions.count ?? 0,
    team: must(team).sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9)),
  };
}

/**
 * My profile (p-profile). Left out from the frame (PLAN.md section 11, and
 * docs/REVIEW.md): the Verified badge, the PPS number, the documents count
 * (now conditions), the Settings switches and the Help action. "Share my
 * record" (any day, PLAN.md section 1) is the first row of Your data, hidden
 * while a doctor has access; "Access log" follows it. Demo accounts also get
 * "Reset demo".
 */
function ProfileScreen() {
  const { profile, email } = usePatientSession();
  const data = useLoad(loadProfile);
  const name = fullName(profile);
  const place = [profile.city, profile.country && (COUNTRY_CODES[profile.country] ?? profile.country)]
    .filter(Boolean)
    .join(", ");

  return (
    <TabScreen header={<PageHeader title="My profile" />}>
      <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
        <section aria-label="You" className="flex flex-col gap-4 rounded-card border border-border-card bg-surface p-5">
          <div className="flex items-center gap-3.5">
            <Avatar initials={initialsOf(name) || "?"} size={56} tone="outline" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-heading font-light">{name || "Your name"}</h2>
              <p className="text-caption text-ink-2">{["Patient", place].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <ButtonLink href="/profile/edit" variant="secondary" size="md" fullWidth>
            Edit profile
          </ButtonLink>
        </section>

        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : (
          <>
            <section aria-label="Your record in numbers" className="grid grid-cols-3 gap-3">
              <StatTile value={data.data.records} label="records" />
              <StatTile value={data.data.medications} label="medications" />
              <StatTile value={data.data.conditions} label="conditions" />
            </section>

            <section aria-labelledby="details-label" className="flex flex-col gap-3">
              <SectionHeading id="details-label">Personal details</SectionHeading>
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
            </section>

            <CareTeam team={data.data.team} />
          </>
        )}

        <YourData />
      </div>
    </TabScreen>
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

function CareTeam({ team }: { team: CareMember[] }) {
  return (
    <section aria-labelledby="team-label" className="flex flex-col gap-3">
      <SectionHeading id="team-label">Care team</SectionHeading>
      {team.length === 0 && <p className="text-body text-ink-2">No one on your care team yet.</p>}
      {team.length > 0 && (
        <Card as="ul">
          {team.map((m) => (
            <li key={m.id}>
              <ListRow
                title={m.name}
                caption={[m.role, m.organisation ?? KIND_LABEL[m.kind]].filter(Boolean).join(", ")}
                chevron
                href={`/profile/care-team/${m.id}`}
              />
            </li>
          ))}
        </Card>
      )}
      <ButtonLink
        href="/profile/care-team/new"
        variant="text"
        size="sm"
        className="w-fit"
        iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}
      >
        Add to your care team
      </ButtonLink>
    </section>
  );
}

const rowClasses =
  "flex min-h-16 w-full items-center gap-3.5 py-2 text-left text-row font-medium text-ink transition-colors duration-150 ease-out hovered:text-accent-alt";

function YourData() {
  const router = useRouter();
  const { isAnonymous, reloadProfile } = usePatientSession();
  const share = useShareSession();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function exportData() {
    setExporting(true);
    setExportError(false);
    const { data, error } = await createClient().rpc("export_my_data");
    setExporting(false);
    if (error || !data) {
      setExportError(true);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace-export-${dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function resetDemo() {
    setResetting(true);
    setResetError(false);
    const { error } = await createClient().rpc("seed_demo_record");
    if (error) {
      setResetting(false);
      setResetError(true);
      return;
    }
    await Promise.all([share.refresh(), reloadProfile()]);
    setResetting(false);
    setConfirmReset(false);
    share.announce("The demo is reset. Jane's record is back to how it started.");
    router.push("/home");
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    // Offline, the global sign-out fails and keeps the session: forget it on this device anyway.
    if (error) await supabase.auth.signOut({ scope: "local" });
    leaveForWelcome();
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(false);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      setDeleteError(true);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    leaveForWelcome();
  }

  return (
    <>
      <section aria-labelledby="data-label" className="flex flex-col gap-3">
        <SectionHeading id="data-label">Your data</SectionHeading>
        <Card as="ul">
          {share.loaded && !isOpen(share.session) && (
            <li>
              <Link href="/share" className={rowClasses}>
                <Icon name="share" className="text-accent" />
                <span className="flex-1">Share my record</span>
                <Icon name="chevron-right" size={18} className="text-ink-2" />
              </Link>
            </li>
          )}
          <li>
            <Link href="/access-log" className={rowClasses}>
              <Icon name="history" className="text-accent" />
              <span className="flex-1">Access log</span>
              <Icon name="chevron-right" size={18} className="text-ink-2" />
            </Link>
          </li>
          <li>
            <button type="button" className={rowClasses} onClick={exportData} aria-busy={exporting || undefined}>
              <Icon name="download" className="text-accent" />
              <span className="flex-1">{exporting ? "Preparing your file…" : "Export my data"}</span>
            </button>
          </li>
          <li>
            <Link href="/terms" className={rowClasses}>
              <Icon name="document" className="text-accent" />
              <span className="flex-1">Privacy and terms</span>
              <Icon name="chevron-right" size={18} className="text-ink-2" />
            </Link>
          </li>
          {isAnonymous && (
            <li>
              <button type="button" className={rowClasses} onClick={() => setConfirmReset(true)}>
                <Icon name="refresh" className="text-accent" />
                <span className="flex-1">Reset demo</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" className={rowClasses} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" className="text-critical" />
              <span className="flex-1 text-critical">Delete my account</span>
            </button>
          </li>
        </Card>
        {exportError && (
          <Notice tone="critical" live="assertive">
            Your data couldn&apos;t be exported. Check your connection and try again.
          </Notice>
        )}
      </section>

      <Button variant="secondary" size="lg" fullWidth onClick={signOut} loading={signingOut}>
        Sign out
      </Button>

      <BottomSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the demo?"
        actions={
          <>
            <Button size="lg" fullWidth onClick={resetDemo} loading={resetting}>
              Reset demo
            </Button>
            <Button variant="text" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">
          Jane&apos;s record goes back to how it started. Anything you added, and any share, is cleared.
        </p>
        {resetError && (
          <Notice tone="critical" live="assertive">
            The demo couldn&apos;t be reset. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
      <BottomSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        actions={
          <>
            <Button size="lg" fullWidth onClick={deleteAccount} loading={deleting}>
              Delete everything
            </Button>
            <Button variant="text" onClick={() => setConfirmDelete(false)}>
              Keep my account
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">
          Your whole record goes with it: profile, conditions, medications, timeline, care team and access log. This
          can&apos;t be undone. You can export your data first.
        </p>
        {deleteError && (
          <Notice tone="critical" live="assertive">
            Your account couldn&apos;t be deleted. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
    </>
  );
}

export default function ProfilePage() {
  return (
    <SessionReady>
      <ProfileScreen />
    </SessionReady>
  );
}
