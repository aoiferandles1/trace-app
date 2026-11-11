import type { Relative } from "@/lib/patient/record";

/**
 * Where each person sits in the family tree, and the connector lines, from
 * the data (board FamilyA2). The board's own numbers are the anchors: a
 * 350px wide drawing, node centres for grandparents at 44, 132, 218 and 306
 * (y 26), Mum at 88 and Dad at 262 (y 176), you and your siblings centred
 * on 175, 90 apart (y 316). Rows are 140 apart. Aunts and uncles extend the
 * parents' row outwards, children go under you, and anyone else ("Someone
 * else", or a second Mum) sits on a last row without lines. When that makes
 * the drawing wider than 350px it grows, and the screen lets it scroll
 * sideways inside itself.
 */

export const NODE_W = 84;
const R = 26; // circle radius
const ROW = 140;
const TOP = 26;
const NODE_H = 88; // circle 52, 4 gap, two 16px lines
const BASE_W = 350;

export type TreeNode = { key: string; relative: Relative | null; x: number; y: number };
export type TreeLayout = { nodes: TreeNode[]; paths: string[]; width: number; height: number };

const GP_SLOTS: Record<string, number> = {
  maternal_grandmother: 44,
  maternal_grandfather: 132,
  paternal_grandmother: 218,
  paternal_grandfather: 306,
};

/** A line from a couple (or one parent) down to their children's tops, with a bar when there are several. */
function bracket(ax: number, ay: number, xs: number[], childTop: number): string[] {
  if (xs.length === 0) return [];
  if (xs.length === 1 && xs[0] === ax) return [`M${ax} ${ay}V${childTop}`];
  const mid = childTop - 20;
  const lo = Math.min(ax, ...xs);
  const hi = Math.max(ax, ...xs);
  return [`M${ax} ${ay}V${mid}`, `M${lo} ${mid}H${hi}`, ...xs.map((x) => `M${x} ${mid}V${childTop}`)];
}

function spread(centre: number, n: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => centre + (i - (n - 1) / 2) * gap);
}

export function layoutTree(relatives: Relative[]): TreeLayout {
  const used = new Set<string>();
  const take = (relation: string) => {
    const r = relatives.find((x) => x.relation === relation && !used.has(x.id));
    if (r) used.add(r.id);
    return r ?? null;
  };
  const takeAll = (relations: string[]) =>
    relatives.filter((x) => relations.includes(x.relation) && !used.has(x.id) && (used.add(x.id), true));

  const nodes: TreeNode[] = [];
  const paths: string[] = [];
  const y = [TOP, TOP + ROW, TOP + 2 * ROW, TOP + 3 * ROW];

  // Grandparents.
  const gp: Record<string, Relative | null> = {};
  for (const rel of Object.keys(GP_SLOTS)) {
    gp[rel] = take(rel);
    if (gp[rel]) nodes.push({ key: gp[rel]!.id, relative: gp[rel], x: GP_SLOTS[rel], y: y[0] });
  }

  // Parents, with aunts and uncles further out on their side.
  const mum = take("mother");
  const dad = take("father");
  const mAunts = takeAll(["maternal_aunt", "maternal_uncle"]);
  const pAunts = takeAll(["paternal_aunt", "paternal_uncle"]);
  const mumX = 88;
  const dadX = 262;
  // Outermost first, so the list reads left to right.
  mAunts.reverse().forEach((r, i) => nodes.push({ key: r.id, relative: r, x: mumX - 88 * (mAunts.length - i), y: y[1] }));
  if (mum) nodes.push({ key: mum.id, relative: mum, x: mumX, y: y[1] });
  if (dad) nodes.push({ key: dad.id, relative: dad, x: dadX, y: y[1] });
  pAunts.forEach((r, i) => nodes.push({ key: r.id, relative: r, x: dadX + 88 * (i + 1), y: y[1] }));

  // Grandparents to their children.
  const side = (gm: string, gf: string, parentX: number, parent: Relative | null, aunts: Relative[], sign: -1 | 1) => {
    const a = gp[gm];
    const b = gp[gf];
    if (!a && !b) return;
    let ax: number;
    let ay: number;
    if (a && b) {
      paths.push(`M${GP_SLOTS[gm] + R} ${y[0]}H${GP_SLOTS[gf] - R}`);
      ax = (GP_SLOTS[gm] + GP_SLOTS[gf]) / 2;
      ay = y[0];
    } else {
      ax = GP_SLOTS[a ? gm : gf];
      ay = y[0] + R;
    }
    const kids = [...(parent ? [parentX] : []), ...aunts.map((_, i) => parentX + sign * 88 * (i + 1))];
    paths.push(...bracket(ax, ay, kids, y[1] - R));
  };
  side("maternal_grandmother", "maternal_grandfather", mumX, mum, mAunts, -1);
  side("paternal_grandmother", "paternal_grandfather", dadX, dad, pAunts, 1);

  // You and your siblings.
  const siblings = takeAll(["sister", "brother"]);
  const genX = spread(175, siblings.length + 1, 90);
  nodes.push({ key: "you", relative: null, x: genX[0], y: y[2] });
  siblings.forEach((r, i) => nodes.push({ key: r.id, relative: r, x: genX[i + 1], y: y[2] }));
  if (mum && dad) {
    paths.push(`M${mumX + R} ${y[1]}H${dadX - R}`);
    paths.push(...bracket((mumX + dadX) / 2, y[1], genX, y[2] - R));
  } else if (mum || dad) {
    paths.push(...bracket(mum ? mumX : dadX, y[1] + R, genX, y[2] - R));
  }

  // Children.
  const children = takeAll(["daughter", "son"]);
  let lastRow = 2;
  if (children.length) {
    const cx = spread(genX[0], children.length, 90);
    children.forEach((r, i) => nodes.push({ key: r.id, relative: r, x: cx[i], y: y[3] }));
    paths.push(...bracket(genX[0], y[2] + R, cx, y[3] - R));
    lastRow = 3;
  }

  // Everyone else: a last row, no lines.
  const others = relatives.filter((r) => !used.has(r.id));
  if (others.length) {
    lastRow += 1;
    const oy = TOP + lastRow * ROW;
    others.forEach((r, i) => nodes.push({ key: r.id, relative: r, x: 44 + 88 * i, y: oy }));
  }

  // Fit: shift right if anything pokes out on the left; grow if it pokes out on the right.
  const minX = Math.min(...nodes.map((n) => n.x)) - NODE_W / 2;
  const shift = minX < 0 ? -minX : 0;
  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_W / 2 + shift;
  const shifted = shift
    ? {
        nodes: nodes.map((n) => ({ ...n, x: n.x + shift })),
        paths: paths.map((p) => p.replace(/([MH])(-?[\d.]+)/g, (_, c: string, v: string) => `${c}${Number(v) + shift}`)),
      }
    : { nodes, paths };
  const lastY = Math.max(...nodes.map((n) => n.y));
  return {
    ...shifted,
    width: Math.max(BASE_W, maxX),
    height: lastY - R + NODE_H + 14,
  };
}
