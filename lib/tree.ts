// tree(): an org chart / hierarchy. The nodes place themselves (graph-layout.ts layoutTree); each node is a box with a bold
// label and an optional muted sub line, wrapped to maxNodeW. Nodes with an id are anchors, so connect() can reach them.
import {textWidth, splitAtoms} from './atoms.ts';
import {layoutTree} from './graph-layout.ts';
import type {TreeNode} from './graph-layout.ts';
import {wrapText} from './wrap.ts';
import type {FontFamily, LaidOutTree, Roles, TreeBand, TreeItem, WidthOf} from './types.ts';

const PAD_X = 14, PAD_Y = 8, MIN_W = 88, DEFAULT_MAX_W = 200, GAP = 24, LEVEL_GAP = 44;

/** Every item of a tree in drawing order (a parent before its children). */
export function treeItems(root: TreeItem): TreeItem[] {
  const out: TreeItem[] = [];
  const walk = (n: TreeItem): void => { out.push(n); for (const c of n.children ?? []) walk(c); };
  walk(root);
  return out;
}

/** Every string a tree draws, registered before its geometry is calculated. */
export function treeTexts(band: TreeBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const n of treeItems(band.root)) {
    for (const a of splitAtoms(n.label)) out.push([a, roles.body, 700, 'sans']);
    for (const a of splitAtoms(n.sub ?? '')) out.push([a, roles.note, 400, 'sans']);
  }
  return out;
}

export function layoutTreeBand(band: TreeBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutTree {
  const L = roles.body, S = roles.note, LH = (s: number): number => Math.round(s * 1.4);
  const maxW = band.maxNodeW ?? DEFAULT_MAX_W, inner = maxW - 2 * PAD_X;
  const items = treeItems(band.root);
  const seen = new Set<string>();
  for (const n of items) {
    if (typeof n.label !== 'string' || !n.label.trim()) throw new Error('tree(): every node needs a label');
    if (n.id !== undefined) { if (seen.has(n.id)) throw new Error(`tree(): duplicate node id "${n.id}"`); seen.add(n.id); }
  }
  // node i of `items` is "n<i>" in the layout (ids of the band are the user's; the layout needs unique keys for all)
  const key = new Map<TreeItem, string>(items.map((n, i) => [n, `n${i}`]));
  const lines = new Map<TreeItem, {label: string[]; sub: string[]; w: number; h: number}>();
  const build = (n: TreeItem): TreeNode => {
    const label = wrapText(n.label, {maxWidth: inner, atomWidth: a => widthOf(a, L, 700, 'sans')});
    const sub = n.sub ? wrapText(n.sub, {maxWidth: inner, atomWidth: a => widthOf(a, S, 400, 'sans')}) : [];
    const tw = Math.max(...label.map(l => textWidth(widthOf, l, L, 700)), ...sub.map(l => textWidth(widthOf, l, S, 400)));
    const nw = Math.max(MIN_W, Math.ceil(tw + 2 * PAD_X)), nh = 2 * PAD_Y + label.length * LH(L) + sub.length * LH(S);
    lines.set(n, {label, sub, w: nw, h: nh});
    return {id: key.get(n)!, size: {w: nw, h: nh}, ...(n.children?.length ? {children: n.children.map(build)} : {})};
  };
  const tree = layoutTree(build(band.root), {dir: band.dir ?? 'down', gap: GAP, levelGap: LEVEL_GAP});
  if (tree.w > w + 0.5) throw new Error(`tree(): the chart is ${Math.ceil(tree.w)}px wide but the figure has ${Math.round(w)}px (use dir: 'right', a smaller maxNodeW, or fewer siblings on one level)`);
  const dx = x + (w - tree.w) / 2, dy = y;
  const out: LaidOutTree = {
    type: 'tree', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: tree.h,
    nodes: [], edges: [], texts: [], anchors: [], labelBoxes: [],
  };
  for (const n of items) {
    const p = tree.nodes.get(key.get(n)!)!, l = lines.get(n)!;
    const r = {x: p.x + dx, y: p.y + dy, w: p.w, h: p.h};
    out.nodes.push({...r, tone: n.tone ?? 'plain', ...(n.id ? {id: n.id} : {})});
    if (n.id) out.anchors.push({id: n.id, ...r});
    let ty = r.y + PAD_Y;
    for (const line of l.label) { out.texts.push({text: line, x: r.x + r.w / 2, y: ty + L, size: L, bold: true, muted: false}); ty += LH(L); }
    for (const line of l.sub) { out.texts.push({text: line, x: r.x + r.w / 2, y: ty + S, size: S, bold: false, muted: true}); ty += LH(S); }
    out.labelBoxes.push({label: n.label, ...r});
  }
  for (const e of tree.edges) out.edges.push({points: e.points.map(p => ({x: p.x + dx, y: p.y + dy}))});
  return out;
}
