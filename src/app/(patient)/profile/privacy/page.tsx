"use client";

import { useState } from "react";
import { leaveForWelcome, SessionReady } from "@/components/patient/PatientSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Notice } from "@/components/ui/Notice";
import { dayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { SubScreen } from "../../_components/Screens";

/**
 * Privacy and security (Profile's row; no board): the terms, "Export my
 * data" (export_my_data version 2, every table, as a JSON file) and
 * "Delete my account" (a destructive text row with a confirm sheet).
 */
function PrivacyScreen() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function exportData() {
    setExporting(true);
    setExportError(false);
    const { data, error } = await createClient().rpc("export_my_data", { version: 2 });
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
    <SubScreen title="Privacy and security" backHref="/profile" backLabel="Back to Profile">
      <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
        <Card as="ul">
          <li>
            <ListRow icon="document" title="Privacy and terms" chevron href="/terms" />
          </li>
          <li>
            <ListRow
              icon="download"
              title={exporting ? "Preparing your file…" : "Export my data"}
              caption="Everything in your record, as one file"
              onClick={exporting ? undefined : exportData}
            />
          </li>
        </Card>
        {exportError && (
          <Notice tone="critical" live="assertive">
            Your data couldn&apos;t be exported. Check your connection and try again.
          </Notice>
        )}
        <Button variant="destructive" className="w-fit" onClick={() => setConfirmDelete(true)}>
          Delete my account
        </Button>
      </div>

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
          Your whole record goes with it: profile, conditions, medications, timeline, family, documents, insurance,
          care team and share history. This can&apos;t be undone. You can export your data first.
        </p>
        {deleteError && (
          <Notice tone="critical" live="assertive">
            Your account couldn&apos;t be deleted. Check your connection and try again.
          </Notice>
        )}
      </BottomSheet>
    </SubScreen>
  );
}

export default function PrivacyPage() {
  return (
    <SessionReady>
      <PrivacyScreen />
    </SessionReady>
  );
}
