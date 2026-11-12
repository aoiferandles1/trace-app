"use client";

import { Card } from "@/components/ui/Card";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { useHere, withBack } from "@/lib/back";

/**
 * The Add flow (BRIEF.md section 7): the tab bar's centre plus opens a
 * bottom sheet of plain rows, one bare icon and a title each; every row
 * opens a full-screen form with its primary button pinned at the bottom.
 * `/add` shows the same rows as a screen (the desktop rail's Add, and the
 * address itself).
 *
 * Only what the app can add today. The brief's six rows plus "Add to your
 * timeline" (an illness or diagnosis, TimelineA2's data) and "Log vitals".
 */
export const ADD_ROWS: { href: string; icon: IconName; title: string }[] = [
  { href: "/add/appointment", icon: "calendar", title: "Add a visit" },
  { href: "/add/medication", icon: "pill", title: "Add a medication" },
  { href: "/record/conditions/new", icon: "heart-pulse", title: "Add a condition" },
  { href: "/record/family/new", icon: "tree", title: "Add a relative" },
  { href: "/profile/documents/upload", icon: "document-plus", title: "Upload a document" },
  { href: "/add/note", icon: "pencil", title: "Log a note" },
  { href: "/record/timeline/new", icon: "clock", title: "Add to your timeline" },
  { href: "/add/vitals", icon: "heart", title: "Log vitals" },
];

/**
 * The rows as one card of links. `onChoose` runs when one is followed (the
 * sheet closes itself). Each form's Back returns to `back`: the screen under
 * the sheet, or /add.
 */
export function AddRows({ onChoose, back, className }: { onChoose?: () => void; back: string; className?: string }) {
  return (
    <Card as="ul" aria-label="What to add" className={className}>
      {ADD_ROWS.map((row) => (
        <li key={row.href} onClick={onChoose}>
          <ListRow href={withBack(row.href, back)} icon={row.icon} title={row.title} height={60} chevron />
        </li>
      ))}
    </Card>
  );
}

export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const here = useHere();
  return (
    <BottomSheet open={open} onClose={onClose} title="Add to your record">
      {/* Closed in state before the next screen shows, so Back does not reopen it. */}
      <AddRows onChoose={onClose} back={here} />
    </BottomSheet>
  );
}
