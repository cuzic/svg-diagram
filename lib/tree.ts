// tree(): an org chart / hierarchy. The nodes place themselves (graph-layout.ts layoutTree); each node is a box with a bold
// label and an optional muted sub line, wrapped to maxNodeW. Nodes with an id are anchors, so connect() can reach them.
import {textWidth, splitAtoms} from './atoms.ts';
import {layoutBalanced, layoutTree} from './graph-layout.ts';
import type {TreeLayout, TreeNode} from './graph-layout.ts';
import {layoutBrace, layoutFishbone, layoutHanging, layoutTimelineMap, mirror} from './map-layouts.ts';
import {fitLayout} from './fit-width.ts';
import {longestUnitWidth, wrapText} from './wrap.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv, WrapMode} from './types/core.ts';
import type {LaidOutTree, TreeBand, TreeItem, TreeNodeText} from './types/diagrams.ts';

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

export interface NodeLines {label: string[]; sub: string[]; w: number; h: number}
const lineH = (s: number): number => Math.round(s * 1.4);

/** The wrapped texts (each a list of lines) that broke into several lines of 2.5 characters or fewer on average: what `fit: 'shrink'` squeezing a column too far does (rule shrink-narrow-text). Returns the joined texts, each once. */
export function narrowTexts(texts: string[][]): string[] {
  return texts.filter(lines => lines.length >= 3 && lines.join('').replace(/\s/g, '').length / lines.length <= 2.5).map(lines => lines.join('')).filter((t, i, a) => a.indexOf(t) === i);
}

/** `{narrow}` for a laid-out band, or nothing when no text broke that way (so a shrink that changed nothing leaves the band as it was). */
export function narrowField(texts: string[][]): {narrow?: string[]} { const n = narrowTexts(texts); return n.length ? {narrow: n} : {}; }

/** A node's text wrapped to maxW, and the box size it needs (bold label, muted sub line). Shared with states(). */
/** The widest katakana word of a text: a run of the characters `phrase` keeps whole (wrap.ts scriptRun: katakana with ー and ・, and half-width kana). */
function katakanaWidth(text: string, widthOf: WidthOf, size: number, weight: 400 | 700): number {
  let widest = 0;
  for (const run of text.match(/[\u30A1-\u30FF\uFF66-\uFF9F]+/g) ?? []) widest = Math.max(widest, splitAtoms(run).reduce((sum, a) => sum + widthOf(a, size, weight, 'sans'), 0));
  return widest;
}
/** The widest a keepWords floor may make a box (inner width) unless the component gives its own: a word past this breaks anyway. */
const KEEP_WORDS_CAP = 240;
/** `mode`: the diagram's wrap mode; `floor`: whether the keepWords floor applies to this measurement (the diagram's keepWords, or the fit attempt's: see fitLayout). */
export function measureNode(label: string, sub: string | undefined, maxW: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, floor: boolean, opts: {/** The widest inner width the keepWords floor may give this node (default 240): a task of a flow keeps to its own column width. */ keepWordsCap?: number; /** false: this node is not given the floor (a round node, a cloud's fixed column). */ keepWords?: boolean} = {}): NodeLines {
  const L = roles.body, S = roles.note;
  let inner = maxW - 2 * PAD_X;
  if (floor && opts.keepWords !== false) { // keepWords (ADR 0029 D3): not narrower than the longest katakana word
    const word = Math.max(katakanaWidth(label, widthOf, L, 700), sub ? katakanaWidth(sub, widthOf, S, 400) : 0);
    inner = Math.max(inner, Math.min(Math.ceil(word), opts.keepWordsCap ?? KEEP_WORDS_CAP));
  }
  if (mode === 'bunsetsu') { // a box wide enough for its longest unit (up to 1.5 x maxNodeW; a longer unit breaks per character)
    const unit = Math.max(longestUnitWidth(splitAtoms(label), a => widthOf(a, L, 700, 'sans'), mode), sub ? longestUnitWidth(splitAtoms(sub), a => widthOf(a, S, 400, 'sans'), mode) : 0);
    inner = Math.max(inner, Math.min(Math.ceil(unit), Math.floor(1.5 * maxW) - 2 * PAD_X));
  }
  const lab = wrapText(label, {maxWidth: inner, atomWidth: a => widthOf(a, L, 700, 'sans'), mode});
  const sb = sub ? wrapText(sub, {maxWidth: inner, atomWidth: a => widthOf(a, S, 400, 'sans'), mode}) : [];
  const tw = Math.max(...lab.map(l => textWidth(widthOf, l, L, 700)), ...sb.map(l => textWidth(widthOf, l, S, 400)));
  return {label: lab, sub: sb, w: Math.max(MIN_W, Math.ceil(tw + 2 * PAD_X)), h: 2 * PAD_Y + lab.length * lineH(L) + sb.length * lineH(S)};
}

/** The centred text runs of a node laid in rectangle r. */
export function nodeRuns(r: {x: number; y: number; w: number}, l: NodeLines, roles: Roles): TreeNodeText[] {
  const L = roles.body, S = roles.note, out: TreeNodeText[] = [];
  let ty = r.y + PAD_Y;
  for (const line of l.label) { out.push({text: line, x: r.x + r.w / 2, y: ty + L, size: L, bold: true, muted: false}); ty += lineH(L); }
  for (const line of l.sub) { out.push({text: line, x: r.x + r.w / 2, y: ty + S, size: S, bold: false, muted: true}); ty += lineH(S); }
  return out;
}

export function layoutTreeBand(band: TreeBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number): LaidOutTree {
  const items = treeItems(band.root);
  const seen = new Set<string>();
  for (const n of items) {
    if (typeof n.label !== 'string' || !n.label.trim()) throw new Error('tree(): every node needs a label');
    if (n.id !== undefined) { if (seen.has(n.id)) throw new Error(`tree(): duplicate node id "${n.id}"`); seen.add(n.id); }
  }
  // node i of `items` is "n<i>" in the layout (ids of the band are the user's; the layout needs unique keys for all)
  const key = new Map<TreeItem, string>(items.map((n, i) => [n, `n${i}`]));
  // One whole attempt: the text wrapped at maxW, a plain tree growing `dirNow` (a balanced mindmap keeps its layout).
  const attemptWith = (dirNow: 'down' | 'right', maxW: number, floor: boolean) => {
    const lines = new Map<TreeItem, NodeLines>();
    const build = (n: TreeItem): TreeNode => {
      const m = measureNode(n.label, n.sub, maxW, widthOf, roles, env.wrap, floor);
      lines.set(n, m);
      return {id: key.get(n)!, size: {w: m.w, h: m.h}, ...(n.children?.length ? {children: n.children.map(build)} : {})};
    };
    const laidRoot = build(band.root);
    const sides = Object.fromEntries(Object.entries(band.sides ?? {}).map(([id, side]) => {
      const item = items.find(n => n.id === id);
      if (!item) throw new Error(`mindmap(): sides names unknown node id "${id}"`);
      if (!band.root.children?.includes(item)) throw new Error(`mindmap(): sides can pin only a child of the root ("${id}" is deeper)`);
      return [key.get(item)!, side];
    }));
    const kind = band.balanced ? band.layout ?? 'radial' : dirNow;
    if (band.sides && kind !== 'radial') throw new Error(`mindmap(): sides applies to the radial layout (this is layout: '${kind}')`);
    const styled = band.edges !== undefined && band.edges !== 'elbow';
    if (styled && !['radial', 'right', 'left', 'down', 'up'].includes(kind)) throw new Error(`mindmap(): edges: '${band.edges}' applies to the radial, right, left, down and up layouts (this is layout: '${kind}')`);
    const grown = (dir: 'down' | 'right'): TreeLayout => layoutTree(laidRoot, {dir, gap: Math.round(GAP * (env.space ?? 1)), levelGap: Math.round(LEVEL_GAP * (env.space ?? 1))});
    const raw: TreeLayout = kind === 'radial' ? layoutBalanced(laidRoot, {gap: Math.round(GAP * (env.space ?? 1)), levelGap: Math.round(LEVEL_GAP * (env.space ?? 1)), sides})
      : kind === 'right' ? grown('right') : kind === 'left' ? mirror(grown('right'), 'x') : kind === 'down' ? grown('down') : kind === 'up' ? mirror(grown('down'), 'y')
      : kind === 'org' ? layoutHanging(laidRoot, {rowFirst: true}) : kind === 'list' ? layoutHanging(laidRoot)
      : kind === 'brace' ? layoutBrace(laidRoot) : kind === 'fishbone' ? layoutFishbone(laidRoot) : layoutTimelineMap(laidRoot);
    // the line style: straight or smooth instead of the elbow (the first and last point of each line, the smooth one along the way the tree grows)
    const along: 'x' | 'y' = kind === 'down' || kind === 'up' ? 'y' : 'x';
    const tree: TreeLayout = !styled ? raw : {...raw, edges: raw.edges.map(e => ({...e, points: [e.points[0], e.points[e.points.length - 1]], ...(band.edges === 'curve' ? {curve: along} : {})}))};
    return {size: {w: tree.w, h: tree.h}, score: {crossings: 0, bends: 0}, tree, lines, kind};
  };
  const explicitDir = !band.balanced && band.dir !== undefined && band.dir !== 'auto';
  const start: 'down' | 'right' = band.dir === 'right' ? 'right' : 'down';
  const balancedHint = band.balanced ? (['org', 'timeline', 'fishbone', 'down', 'up'].includes(band.layout ?? 'radial') ? "layout: 'list', 'right' or 'left'" : 'fewer branches') : undefined;
  const fitted = fitLayout({
    who: band.balanced ? 'mindmap()' : 'tree()', w, start, keepWords: env.keepWords, ...(band.balanced ? {noDir: true} : {}), ...(band.balanced ? {axisKept: `another layout (a mindmap keeps its layout: '${band.layout ?? 'radial'}')`} : {alt: start === 'down' ? 'right' as const : 'down' as const}),
    explicitDir, mode: band.dir === 'auto' ? 'auto' : 'omitted', ...(band.maxNodeW === undefined ? {} : {maxNodeW: band.maxNodeW}),
    build: attemptWith, best: band.dir === 'auto' && !band.balanced, ...(heightBudget === undefined ? {} : {heightBudget}),
    ...(balancedHint ? {fix: `write ${balancedHint}${balancedHint.startsWith('layout') ? '' : ', or a wider figure'}`} : {}),
  });
  const {tree, lines} = fitted.result, fitApplied = fitted.applied;
  const dx = x + (w - tree.w) / 2, dy = y;
  const out: LaidOutTree = {
    type: 'tree', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: tree.h,
    nodes: [], edges: [], texts: [], anchors: [], labelBoxes: [],
    ...(fitApplied.length ? {fitApplied} : {}),
  };
  for (const n of items) {
    const p = tree.nodes.get(key.get(n)!)!, l = lines.get(n)!;
    const r = {x: p.x + dx, y: p.y + dy, w: p.w, h: p.h};
    out.nodes.push({...r, tone: n.tone ?? 'plain', ...(n.id ? {id: n.id} : {})});
    if (n.id) out.anchors.push({id: n.id, ...r});
    out.texts.push(...nodeRuns(r, l, roles));
    out.labelBoxes.push({label: n.label, ...r});
  }
  for (const e of tree.edges) out.edges.push({points: e.points.map(p => ({x: p.x + dx, y: p.y + dy})), ...(e.curve ? {curve: e.curve} : {}), ...(e.bold ? {bold: true} : {})});
  if (tree.braces?.length) out.braces = tree.braces.map(b => ({...b, x: b.x + dx, tipX: b.tipX + dx, y1: b.y1 + dy, y2: b.y2 + dy, ymid: b.ymid + dy}));
  return out;
}
