"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { leaveForWelcome, SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { PageHeader } from "@/components/patient/PageHeader";
import { useShareSession } from "@/components/patient/ShareSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Avatar, Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { initialsOf } from "@/lib/format";
import { isOpen } from "@/lib/patient/share";
import { fullName } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { TabScreen } from "../_components/Screens";

const COUNTRY_CODES: Record<string, string> = { Ireland: "IE", "United Kingdom": "UK" };

/**
 * Profile (BRIEF.md section 5.12; no board): who you are, then one list of
 * rows. Your details, Share my record (hidden while a doctor has access),
 * Insurance, Documents, Care team, Share history, Privacy and security, and
 * for demo accounts Reset demo; then Sign out.
 *
 * Export and account deletion live under Privacy and security
 * (/profile/privacy). Mental health has no page (owner's decision): it stays
 * a flag on each item and a share tile.
 */
function ProfileScreen() {
  const router = useRouter();
  const { profile, isAnonymous, reloadProfile } = usePatientSession();
  const share = useShareSession();
  const name = fullName(profile);
  const place = [profile.city, profile.country && (COUNTRY_CODES[profile.country] ?? profile.country)]
    .filter(Boolean)
    .join(", ");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function resetDemo() {
    setResetting(true);
    setResetError(false);
    const { error } = await createClient().rpc("seed_demo_record_v2");
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

  return (
    <TabScreen header={<PageHeader title="Profile" />}>
      <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
        <section aria-label="You" className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name) || "?"} size={56} tone="outline" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-heading font-light">{name || "Your name"}</h2>
            <p className="text-caption text-ink-2">{["Patient", place].filter(Boolean).join(" · ")}</p>
          </div>
        </section>

        <Card as="ul" aria-label="Your record and settings">
          <li>
            <ListRow icon="person" title="Your details" chevron href="/profile/details" />
          </li>
          {share.loaded && !isOpen(share.session) && (
            <li>
              <ListRow icon="share" title="Share my record" chevron href="/share" />
            </li>
          )}
          <li>
            <ListRow icon="shield" title="Insurance" chevron href="/profile/insurance" />
          </li>
          <li>
            <ListRow icon="document" title="Documents" chevron href="/profile/documents" />
          </li>
          <li>
            <ListRow icon="people" title="Care team" chevron href="/profile/care-team" />
          </li>
          <li>
            <ListRow icon="history" title="Share history" chevron href="/access-log" />
          </li>
          <li>
            <ListRow icon="lock" title="Privacy and security" chevron href="/profile/privacy" />
          </li>
          {isAnonymous && (
            <li>
              <ListRow icon="refresh" title="Reset demo" onClick={() => setConfirmReset(true)} />
            </li>
          )}
        </Card>

        <Card as="ul" aria-label="Account">
          <li>
            <ListRow icon="sign-out" title={signingOut ? "Signing out…" : "Sign out"} onClick={signingOut ? undefined : signOut} />
          </li>
        </Card>
      </div>

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
    </TabScreen>
  );
}

export default function ProfilePage() {
  return (
    <SessionReady>
      <ProfileScreen />
    </SessionReady>
  );
}
