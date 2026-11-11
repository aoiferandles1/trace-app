"use client";

import { useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { formatDay } from "@/lib/dates";
import { connectWithProvider, MOCK_PROVIDERS } from "@/lib/patient/insuranceMock";
import { loadSection, type InsuranceConnection } from "@/lib/patient/record";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DeleteWithConfirm } from "../../_components/forms/FormBits";
import { LoadStatus, SubScreen } from "../../_components/Screens";

async function loadInsurance() {
  return (await loadSection("insurance")).data.connections[0] ?? null;
}

/** "1 Mar 2027". */
function shortDay(day: string): string {
  return formatDay(day).replace(/^(\d+) (\w{3})\w* (\d{4})$/, "$1 $2 $3");
}

/**
 * Insurance (board InsuranceA2, BRIEF.md 5.12), two states:
 * - choosing: one line, the providers, "Enter policy details manually" and
 *   "Read only. You can disconnect any time.";
 * - connected: the accent card (provider, member number ending, plan,
 *   renewal) and Disconnect, a critical text button with a confirm sheet.
 *
 * Insurance is personal (owner's decision, 11 Nov 2026): it is never part of
 * a share, so the board's "Include in shares" switch is not built.
 *
 * The provider sign-in is a mock on every account (owner's decision): see
 * src/lib/patient/insuranceMock.ts. Tapping a provider opens a sheet that
 * says so before it saves the sample plan. "Other provider" goes to manual
 * entry. Trace never asks for a password.
 */
function InsuranceScreen() {
  // Re-read after every change (and whenever this screen shows again), never kept in local state.
  const data = useLoad(loadInsurance);
  const current = data.status === "ready" ? data.data : null;

  return (
    <SubScreen title="Insurance" titleSize="md" backHref="/profile" backLabel="Back to Profile" tabBar>
      <div className="flex flex-col gap-4 px-5 pb-4 pt-4">
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : current ? (
          <Connected connection={current} onDisconnected={data.reload} />
        ) : (
          <Choose onConnected={data.reload} />
        )}
      </div>
    </SubScreen>
  );
}

function Choose({ onConnected }: { onConnected: () => void }) {
  const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function connect() {
    if (!provider) return;
    setBusy(true);
    setFailed(false);
    try {
      await connectWithProvider(provider);
      setBusy(false);
      setProvider(null);
      onConnected();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <>
      <p className="text-body text-ink-2">Choose your provider and sign in with them. Trace never sees your password.</p>
      <Card as="ul" aria-label="Providers">
        {MOCK_PROVIDERS.map((p) => (
          <li key={p}>
            <ListRow title={p} chevron onClick={() => setProvider(p)} height={60} />
          </li>
        ))}
        <li>
          <ListRow title="Other provider" chevron href="/profile/insurance/manual?other=1" height={60} />
        </li>
      </Card>
      <ButtonLink href="/profile/insurance/manual" variant="text" className="w-fit">
        Enter policy details manually
      </ButtonLink>
      <p className="flex items-center gap-2 text-caption text-ink-2">
        <Icon name="lock" size={18} />
        Read only. You can disconnect any time.
      </p>

      <BottomSheet
        open={Boolean(provider)}
        onClose={() => setProvider(null)}
        title={`Sign in with ${provider ?? ""}`}
        actions={
          <>
            <Button size="lg" fullWidth loading={busy} onClick={connect}>
              Continue
            </Button>
            <Button variant="text" onClick={() => setProvider(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">
          You sign in on {provider}&apos;s own page, and Trace never sees your password. For now this is a stand-in: it
          adds a sample plan.
        </p>
        {failed && (
          <Notice tone="critical" live="assertive">
            This couldn&apos;t connect. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
    </>
  );
}

function Connected({ connection: c, onDisconnected }: { connection: InsuranceConnection; onDisconnected: () => void }) {
  return (
    <>
      <section
        aria-label={`${c.provider} insurance`}
        className="flex flex-col gap-5.5 rounded-feature bg-accent px-5.5 pb-5 pt-5.5 text-white"
      >
        <p className="text-meta leading-4 font-medium">{c.via === "provider" ? "Connected" : "Added by you"}</p>
        <h2 className="font-display text-title font-light">{c.provider}</h2>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <p className="flex flex-col">
            <span className="text-meta leading-4">Member number</span>
            <span className="text-body-lg font-medium tracking-[0.08em]">
              <span aria-hidden="true">{c.member_number_masked}</span>
              <span className="sr-only">ending {c.member_number_masked.replace(/\D*/, "")}</span>
            </span>
          </p>
          {(c.plan_name || c.renews_on) && (
            <p className="flex flex-col items-end text-right">
              {c.plan_name && <span className="text-meta leading-4">{c.plan_name}</span>}
              {c.renews_on && <span className="text-caption font-medium">Renews {shortDay(c.renews_on)}</span>}
            </p>
          )}
        </div>
      </section>
      <DeleteWithConfirm
        label="Disconnect"
        title={`Disconnect ${c.provider}?`}
        body="Your plan details are removed from Trace. You can connect again any time."
        onConfirm={async () => {
          const { error } = await createClient().from("insurance_connections").delete().eq("id", c.id);
          if (error) return false;
          onDisconnected();
          return true;
        }}
      />
    </>
  );
}

export default function InsurancePage() {
  return (
    <SessionReady>
      <InsuranceScreen />
    </SessionReady>
  );
}
