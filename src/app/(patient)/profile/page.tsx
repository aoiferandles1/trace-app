"use client";

import { ChevronRight, Download, FileText, History, Plus, RotateCcw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ListItemCard } from "@/components/patient/ListItemCard";
import { leaveForWelcome, SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { ScreenHeader } from "@/components/patient/ScreenHeader";
import { useShareSession } from "@/components/patient/ShareSession";
import { StatTile } from "@/components/patient/StatTile";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, SectionLabel } from "@/components/ui/Card";
import { HintStrip } from "@/components/ui/HintStrip";
import type { Tone } from "@/components/ui/Pill";
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
const KIND_TONE = { gp: "indigo", specialist: "indigo", pharmacy: "teal" } as Record<string, Tone>;
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
    <TabScreen header={<ScreenHeader title="My profile" />}>
      <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
        <section aria-label="You" className="flex flex-col gap-4 rounded-card border border-border-default bg-surface-card p-5">
          <div className="flex items-center gap-3.5">
            <Avatar initials={initialsOf(name) || "?"} size="lg" tone="solid" />
            <div className="min-w-0 flex-1">
              <h2 className="text-h3 font-bold">{name || "Your name"}</h2>
              <p className="text-meta text-text-tertiary">{["Patient", place].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <ButtonLink href="/profile/edit" variant="secondary" size="sm" fullWidth>
            Edit profile
          </ButtonLink>
        </section>

        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : (
          <>
            <section aria-label="Your record in numbers" className="grid grid-cols-3 gap-3">
              <StatTile size="lg" tone="indigo" value={data.data.records} label="records" />
              <StatTile size="lg" tone="teal" value={data.data.medications} label="medications" />
              <StatTile size="lg" tone="peach" value={data.data.conditions} label="conditions" />
            </section>

            <section aria-labelledby="details-label" className="flex flex-col gap-3">
              <SectionLabel id="details-label">Personal details</SectionLabel>
              <dl className="flex flex-col rounded-card border border-border-default bg-surface-card px-2 py-1.5">
                <InfoRow label="Full name" value={name} />
                <InfoRow label="Date of birth" value={profile.date_of_birth && formatDay(profile.date_of_birth)} />
                <InfoRow label="Sex" value={profile.sex} />
                <InfoRow label="Address" value={profile.address || profile.city} />
                <InfoRow label="Phone" value={profile.phone} />
                {email && <InfoRow label="Email" value={email} />}
              </dl>
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
    <div className="flex items-center gap-3 px-4 py-3.5">
      <dt className="shrink-0 text-label font-medium text-text-tertiary">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-words text-right text-body-sm", value ? "text-text-primary" : "text-text-tertiary")}>
        {value || "Not added"}
      </dd>
    </div>
  );
}

function CareTeam({ team }: { team: CareMember[] }) {
  return (
    <section aria-labelledby="team-label" className="flex flex-col gap-3">
      <SectionLabel id="team-label">Care team</SectionLabel>
      {team.length === 0 && <p className="text-body-sm text-text-tertiary">No one on your care team yet.</p>}
      {team.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {team.map((m) => {
            const tone = KIND_TONE[m.kind] ?? "indigo";
            return (
              <li key={m.id}>
                <ListItemCard
                  title={m.name}
                  tone={tone}
                  tag={m.role ? { label: m.role } : undefined}
                  meta={m.organisation ?? KIND_LABEL[m.kind]}
                  href={`/profile/care-team/${m.id}`}
                  chevronTone={tone}
                />
              </li>
            );
          })}
        </ul>
      )}
      <ButtonLink
        href="/profile/care-team/new"
        variant="ghost"
        size="sm"
        className="w-fit"
        iconLeft={<Plus aria-hidden="true" className="size-4" />}
      >
        Add to your care team
      </ButtonLink>
    </section>
  );
}

const rowClasses =
  "flex min-h-14 w-full items-center gap-3 px-4 text-left text-body-lg text-text-primary transition-colors duration-150 hovered:bg-neutral-50";

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
        <SectionLabel id="data-label">Your data</SectionLabel>
        <ul className="divide-y divide-border-default overflow-hidden rounded-card border border-border-default bg-surface-card">
          {share.loaded && !isOpen(share.session) && (
            <li>
              <Link href="/share" className={rowClasses}>
                <Share2 aria-hidden="true" className="size-5 shrink-0 text-indigo-text" />
                <span className="flex-1">Share my record</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-tertiary" />
              </Link>
            </li>
          )}
          <li>
            <Link href="/access-log" className={rowClasses}>
              <History aria-hidden="true" className="size-5 shrink-0 text-indigo-text" />
              <span className="flex-1">Access log</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-tertiary" />
            </Link>
          </li>
          <li>
            <button type="button" className={rowClasses} onClick={exportData} aria-busy={exporting || undefined}>
              <Download aria-hidden="true" className="size-5 shrink-0 text-indigo-text" />
              <span className="flex-1">{exporting ? "Preparing your file…" : "Export my data"}</span>
            </button>
          </li>
          <li>
            <Link href="/terms" className={rowClasses}>
              <FileText aria-hidden="true" className="size-5 shrink-0 text-indigo-text" />
              <span className="flex-1">Privacy and terms</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-tertiary" />
            </Link>
          </li>
          {isAnonymous && (
            <li>
              <button type="button" className={rowClasses} onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden="true" className="size-5 shrink-0 text-indigo-text" />
                <span className="flex-1">Reset demo</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" className={rowClasses} onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" className="size-5 shrink-0 text-red-700" />
              <span className="flex-1 text-red-700">Delete my account</span>
            </button>
          </li>
        </ul>
        {exportError && (
          <HintStrip tone="danger" live="assertive">
            Your data couldn&apos;t be exported. Check your connection and try again.
          </HintStrip>
        )}
      </section>

      <Button size="md" fullWidth onClick={signOut} loading={signingOut}>
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
            <Button variant="secondary" size="lg" fullWidth onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-tertiary">
          Jane&apos;s record goes back to how it started. Anything you added, and any share, is cleared.
        </p>
        {resetError && (
          <HintStrip tone="danger" live="assertive">
            The demo couldn&apos;t be reset. Check your connection and try again.
          </HintStrip>
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
            <Button variant="secondary" size="lg" fullWidth onClick={() => setConfirmDelete(false)}>
              Keep my account
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-tertiary">
          Your whole record goes with it: profile, conditions, medications, timeline, care team and access log. This
          can&apos;t be undone. You can export your data first.
        </p>
        {deleteError && (
          <HintStrip tone="danger" live="assertive">
            Your account couldn&apos;t be deleted. Check your connection and try again.
          </HintStrip>
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
