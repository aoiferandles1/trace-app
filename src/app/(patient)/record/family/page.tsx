"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import {
  categoryOfConditionName,
  CONDITION_CATEGORIES,
  loadSections,
  type Relative,
  type RelativeCondition,
} from "@/lib/patient/record";
import { useLoad } from "@/lib/useLoad";
import { LoadStatus, SubScreen } from "../../_components/Screens";
import { layoutTree, NODE_W, type TreeNode } from "./_components/treeLayout";

type Category = NonNullable<RelativeCondition["category"]>;

async function loadFamily() {
  const r = await loadSections("family_history", "conditions");
  const own = r.conditions.conditions.filter((c) => c.status !== "resolved");
  return {
    relatives: r.family_history.relatives,
    you: {
      count: own.length,
      categories: own.map((c) => categoryOfConditionName(c.name)).filter(Boolean) as Category[],
    },
  };
}

/**
 * Family history (board FamilyA2, BRIEF.md 5.7): a filter by condition
 * group, the tree drawn from the relatives (layoutTree), one line saying who
 * has the chosen group, and "Add a relative".
 *
 * The tree is a real list for assistive tech: each person is a list item
 * with a button ("Dad's dad, Heart attack at 61") in reading order,
 * grandparents first; the connector lines are hidden from screen readers.
 * A relative's button opens a sheet with their conditions and "Edit"; your
 * own node leads to your conditions. When the tree is wider than the screen
 * (320px, or a large family) it scrolls sideways inside itself.
 *
 * The filter offers All and the groups that appear in the family (the
 * board's Heart, Diabetes, Asthma for the demo). A person whose conditions
 * are not in the chosen group is dimmed, ring only: their words stay at full
 * contrast.
 *
 * `?relative=<id>` opens that relative's sheet; `?add=relative` goes to the
 * add form.
 */
function FamilyScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("relative");
  const adding = params.get("add") === "relative";
  const data = useLoad(loadFamily);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [openId, setOpenId] = useState<string | null>(asked);

  useEffect(() => {
    if (adding) router.replace("/record/family/new");
  }, [adding, router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (asked) setOpenId(asked);
  }, [asked]);

  function close() {
    setOpenId(null);
    if (asked) window.history.replaceState(window.history.state, "", "/record/family");
  }

  const relatives = data.status === "ready" ? data.data.relatives : [];
  const open = relatives.find((r) => r.id === openId) ?? null;

  return (
    <SubScreen title="Family history" titleSize="md" backHref="/record?tab=family" backLabel="Back to Record" tabBar>
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-3.5">
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : (
          <FamilyBody
            relatives={relatives}
            you={data.data.you}
            filter={filter}
            onFilter={setFilter}
            onOpen={setOpenId}
          />
        )}
        <ButtonLink href="/record/family/new" size="lg" fullWidth iconLeft={<Icon name="plus" size={20} strokeWidth={2.25} />}>
          Add a relative
        </ButtonLink>
      </div>
      <RelativeSheet relative={open} onClose={close} />
    </SubScreen>
  );
}

function FamilyBody({
  relatives,
  you,
  filter,
  onFilter,
  onOpen,
}: {
  relatives: Relative[];
  you: { count: number; categories: Category[] };
  filter: "all" | Category;
  onFilter: (f: "all" | Category) => void;
  onOpen: (id: string) => void;
}) {
  const present = new Set(relatives.flatMap((r) => r.conditions.map((c) => c.category)).filter(Boolean));
  const groups = CONDITION_CATEGORIES.filter((c) => c.value !== "other" && present.has(c.value));
  const tree = layoutTree(relatives);
  const tagsOf = (n: TreeNode): Category[] =>
    n.relative ? (n.relative.conditions.map((c) => c.category).filter(Boolean) as Category[]) : you.categories;
  const label = (n: TreeNode) => (n.relative ? n.relative.label : "You");
  // A group left with nobody in it (its only relative deleted) falls back to All (A45).
  const shown = filter !== "all" && !groups.some((g) => g.value === filter) ? "all" : filter;
  const groupName = groups.find((g) => g.value === shown)?.label ?? "";
  const filtering = shown !== "all";
  const hits = filtering ? tree.nodes.filter((n) => tagsOf(n).includes(shown)).map(label) : [];

  return (
    <>
      {groups.length > 0 && (
        <SegmentedControl
          label="Show relatives with"
          options={[{ value: "all" as const, label: "All" }, ...groups]}
          value={shown}
          onChange={onFilter}
          fill={groups.length <= 3}
        />
      )}

      {/* Scrolls sideways inside itself when the family is wider than the screen; the padding keeps focus rings in view. */}
      <div className="-m-1 scroll-px-2 overflow-x-auto p-1">
        <ul aria-label="Family tree" className="relative" style={{ width: tree.width, height: tree.height }}>
          <svg
            aria-hidden="true"
            width={tree.width}
            height={tree.height}
            viewBox={`0 0 ${tree.width} ${tree.height}`}
            fill="none"
            className="absolute left-0 top-0"
          >
            <g className="stroke-tree-line" strokeWidth="2" strokeLinecap="round">
              {tree.paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </svg>
          {tree.nodes.map((n) => {
            const match = filtering && tagsOf(n).includes(shown);
            const dim = filtering && !match;
            return (
              <li key={n.key} className="absolute" style={{ left: n.x - NODE_W / 2, top: n.y - 26, width: NODE_W }}>
                <Node node={n} you={you} match={match} dim={dim} onOpen={onOpen} />
              </li>
            );
          })}
        </ul>
      </div>

      <p aria-live="polite" className="min-h-5 text-caption text-ink-2">
        {filtering ? `${groupName}: ${hits.length ? hits.join(", ") : "nobody yet"}` : relatives.length ? "Choose a condition to see who has it." : "Add your parents, grandparents and siblings to build your tree."}
      </p>
    </>
  );
}

function Node({
  node: n,
  you,
  match,
  dim,
  onOpen,
}: {
  node: TreeNode;
  you: { count: number };
  match: boolean;
  dim: boolean;
  onOpen: (id: string) => void;
}) {
  const me = !n.relative;
  const name = me ? "You" : n.relative!.label;
  const cond = me
    ? you.count === 0
      ? "None known"
      : `${you.count} ${you.count === 1 ? "condition" : "conditions"}`
    : n.relative!.conditions.length
      ? n.relative!.conditions.map((c) => c.label).join(", ")
      : "None known";
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-13 items-center justify-center rounded-full border-2 transition-opacity duration-150 ease-out",
          me
            ? "border-accent bg-accent text-white"
            : match
              ? "border-accent bg-locked-tint text-accent"
              : "border-tree-node bg-surface text-ink-2",
          dim && "opacity-35",
        )}
      >
        <Icon name="person" />
      </span>
      <span className="mt-1 text-meta leading-4 font-semibold text-ink">{name}</span>
      <span className="sr-only">, </span>
      <span className={cn("line-clamp-2 text-micro", match ? "font-semibold text-accent" : "text-ink-2")}>{cond}</span>
    </>
  );
  const classes = "flex w-full flex-col items-center rounded-tile text-center";
  if (me)
    return (
      <Link href="/record?tab=conditions" className={classes}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={() => onOpen(n.relative!.id)} className={classes}>
      {body}
    </button>
  );
}

function RelativeSheet({ relative: r, onClose }: { relative: Relative | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(r)}
      onClose={onClose}
      title={r?.label ?? ""}
      actions={
        r && (
          <ButtonLink href={`/record/family/${r.id}/edit`} size="lg" fullWidth aria-label={`Edit ${r.label}`}>
            Edit
          </ButtonLink>
        )
      }
    >
      {r &&
        (r.conditions.length === 0 ? (
          <p className="text-body text-ink-2">No conditions known.</p>
        ) : (
          <ul aria-label="Conditions" className="flex flex-col gap-3">
            {r.conditions.map((c) => (
              <li key={c.id} className="flex flex-col">
                <span className="text-row font-medium">{c.name}</span>
                <span className="text-caption text-ink-2">
                  {[
                    c.age_at_diagnosis !== null ? `Diagnosed at ${c.age_at_diagnosis}` : null,
                    CONDITION_CATEGORIES.find((g) => g.value === c.category)?.label,
                    c.is_mental_health ? "About mental health" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No details"}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </BottomSheet>
  );
}

export default function FamilyPage() {
  return (
    <SessionReady>
      <FamilyScreen />
    </SessionReady>
  );
}
