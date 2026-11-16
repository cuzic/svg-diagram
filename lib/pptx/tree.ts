// A tree band (tree, mind map, org chart, KPI tree, roadmap, fishbone) as native shapes: each node a rounded rectangle holding its own
// text, each line a connector glued to the parent and the child (a curved line is a curvedConnector3, an elbow a bentConnector), and a
// brace a freeform. Moving a node in PowerPoint drags its lines along. A dimmed tree (spotlight) stays a picture.
import {assembleParts, type Geo, type Piece} from './parts-group.ts';
import {partStep} from '../parts.ts';
import {linesText} from './prims.ts';
import {namedAs} from './prims.ts';
import {PALETTE, colorOf, isSolidTone, toneStyle} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutTree, TreeNodeText} from '../types/diagrams.ts';
import type {WrappedRun} from '../types/text-bands.ts';
import type {TextTone} from '../types/core.ts';
import {fitConnector, siteIndex, type Pt} from './geom.ts';
import {boxXml, groupXml, type TextBox} from './shapes.ts';
import {connectorShapeXml, freeformPathXml, type Glue} from './connectors.ts';
import type {Fonts, Rect} from './xml.ts';
import type {ToneEnv} from '../tokens.ts';

/** The tree's padding inside a node (lib/tree.ts PAD_X / PAD_Y). */
const PAD_X = 14, PAD_Y = 8;

type Node = LaidOutTree['nodes'][number];
const RUN_TONES: ReadonlySet<string> = new Set(['text', 'accent', 'muted', 'danger']);

/** The texts drawn inside a node, by the same test the svg uses to colour them. */
const inside = (r: Rect, t: TreeNodeText): boolean => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h;

/** A node's lines as runs: consecutive lines of the same size, weight and colour are one run, at the baselines the layout gave. */
export function nodeRunsOf(n: Rect & {tone: Node['tone']}, texts: readonly TreeNodeText[], tones: ToneEnv): WrappedRun[] {
  const solid = isSolidTone(n.tone), soft = toneStyle(tones, n.tone).fill === 'soft';
  const runs: WrappedRun[] = [];
  for (const t of texts.filter(t => inside(n, t))) {
    // as the svg: white on a solid fill (the second line too); the muted second line takes the plain colour on a soft fill; other
    // lines take the tone's text colour (blue on an accent node), where that colour is one a run can name
    const own = toneStyle(tones, n.tone).text;
    const tone = solid ? undefined : t.muted ? (soft ? undefined : 'muted' as const) : RUN_TONES.has(own) && own !== 'text' ? own as TextTone : undefined;
    const y = t.y - (n.y + PAD_Y);
    const last = runs[runs.length - 1];
    if (last && last.size === t.size && (last.weight === 700) === t.bold && last.tone === tone) { last.lines.push(t.text); last.lineYs.push(y); last.text += t.text; continue; }
    runs.push({text: t.text, size: t.size, weight: t.bold ? 700 : 400, mono: false, ...(tone ? {tone} : {}), lines: [t.text], lineYs: [y]});
  }
  return runs;
}

/** The node whose frame the point lies on (within 2px), if any. */
function nodeAt(nodes: readonly {rect: Rect; id: number}[], p: Pt): {rect: Rect; id: number} | undefined {
  const near = (r: Rect) => p.x >= r.x - 2 && p.x <= r.x + r.w + 2 && p.y >= r.y - 2 && p.y <= r.y + r.h + 2
    && (Math.abs(p.x - r.x) <= 2 || Math.abs(p.x - r.x - r.w) <= 2 || Math.abs(p.y - r.y) <= 2 || Math.abs(p.y - r.y - r.h) <= 2);
  return nodes.find(n => near(n.rect));
}

/** The orthogonal route whose curved twin is the svg's S: out along the axis the tree grows on, across at the middle, in along it. */
function curveRoute(a: Pt, z: Pt, axis: 'x' | 'y'): Pt[] {
  if (axis === 'x') { const m = (a.x + z.x) / 2; return [a, {x: m, y: a.y}, {x: m, y: z.y}, z]; }
  const m = (a.y + z.y) / 2;
  return [a, {x: a.x, y: m}, {x: z.x, y: m}, z];
}

export interface TreeShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

/**
 * The branches of a tree (ADR 0054 D9.3): each node that has children is a branch, its path the branches above it; the root's branch is
 * the band's own group, a leaf is no branch of its own, and a subtree that holds a band node (no box: it is drawn as a band of its own)
 * is not a branch. Returns each node's path (outside in) and whether it has a branch of its own.
 */
export function treeBranches(b: Pick<LaidOutTree, 'nodes'>, label: (i: number) => string): {path: string[]; own: boolean}[] {
  // the parents the layout recorded (a fishbone's bones have no line from the head, so the lines do not tell)
  const n = b.nodes.length, parent = b.nodes.map(x => x.parent), kids: number[][] = Array.from({length: n}, () => []);
  parent.forEach((p, i) => { if (p !== undefined) kids[p]?.push(i); });
  const holdsBand = (i: number): boolean => !!b.nodes[i]?.band || (kids[i] ?? []).some(holdsBand);
  const out: {path: string[]; own: boolean}[] = new Array(n);
  const visit = (i: number, above: string[]): void => {
    const own = parent[i] !== undefined && (kids[i]?.length ?? 0) > 0 && !holdsBand(i);
    const path = own ? [...above, partStep('branch', b.nodes[i]?.id ?? i, label(i))] : above;
    out[i] = {path, own};
    for (const k of kids[i] ?? []) visit(k, path);
  };
  for (let i = 0; i < n; i++) if (parent[i] === undefined) visit(i, []);
  return out;
}

/** The tree's shapes, numbered from `next`. Lines, then braces, then nodes (as the svg draws them); each branch a group (treeBranches). */
export function treeXml(b: LaidOutTree, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): TreeShapes {
  const nodes = b.nodes.map((n, i) => ({n, i, id: n.band ? 0 : next(), rect: {x: n.x, y: n.y, w: n.w, h: n.h}})).filter(x => !x.n.band);
  const glue = nodes.flatMap(({n, id, rect}) => n.id ? [{dslId: n.id, id, rect}] : []);
  const runsOf = new Map(nodes.map(x => [x.i, nodeRunsOf(x.n, b.texts, tones)]));
  const branches = treeBranches(b, i => linesText((runsOf.get(i) ?? []).flatMap(r => r.lines)));
  const pathOf = (i: number | undefined): string[] => i === undefined ? [] : branches[i]?.path ?? [];
  const pieces: Piece[] = [];
  const add = (xml: string, geo: Geo, path: string[], text = false) => pieces.push({order: pieces.length, xml, geo, part: path, ...(text ? {text} : {})});
  for (const e of b.edges.toSorted((p, q) => Number(p.lit ?? 0) - Number(q.lit ?? 0))) {
    const a = e.points[0], z = e.points[e.points.length - 1];
    if (!a || !z) continue;
    const color = e.lit && !b.dim ? colorOf('accent', ld.day) : PALETTE.muted;
    const width = e.bold ? 4 : 2;
    const from = nodeAt(nodes, a), to = nodeAt(nodes, z);
    const start: Glue | undefined = from && {id: from.id, idx: siteIndex(from.rect, a, '')};
    const end: Glue | undefined = to && {id: to.id, idx: siteIndex(to.rect, z, '')};
    const route = e.curve ? curveRoute(a, z, e.curve) : e.points;
    const fit = fitConnector(route);
    const id = next();
    // a line is in its parent's branch (a node's own line, in the node's)
    const geo: Geo = {kind: 'poly', pts: route, w: width};
    if (fit.ok) {
      const x = e.curve ? {...fit.x, prst: fit.x.prst.replace('bentConnector', 'curvedConnector')} : fit.x;
      add(connectorShapeXml(id, 'line', x, color, width, start, end), geo, pathOf(e.from));
    } else add(freeformPathXml(id, 'line', e.points.map((p, i) => ({op: i ? 'L' : 'M', pts: [p]})), color, width), geo, pathOf(e.from));
  }
  for (const br of b.braces ?? []) {
    const s = br.side === 'right' ? 1 : -1, r = 8, {x, tipX: xt, y1, y2, ymid: ym} = br;
    const id = next();
    add(freeformPathXml(id, 'brace', [
      {op: 'M', pts: [{x: x + s * r, y: y1}]}, {op: 'Q', pts: [{x, y: y1}, {x, y: y1 + r}]}, {op: 'L', pts: [{x, y: ym - r}]},
      {op: 'Q', pts: [{x, y: ym}, {x: xt, y: ym}]}, {op: 'Q', pts: [{x, y: ym}, {x, y: ym + r}]}, {op: 'L', pts: [{x, y: y2 - r}]},
      {op: 'Q', pts: [{x, y: y2}, {x: x + s * r, y: y2}]},
    ], PALETTE.muted, 2), {kind: 'poly', pts: [{x: x + s * r, y: y1}, {x, y: y1}, {x, y: y2}, {x: x + s * r, y: y2}, {x, y: ym}, {x: xt, y: ym}], w: 2}, pathOf(br.of));
  }
  for (const {n, i, id, rect} of nodes) {
    const runs = runsOf.get(i) ?? [], box: TextBox = {...rect, tone: n.tone, padX: PAD_X, padY: PAD_Y, align: 'center', wrappedRuns: runs};
    add(boxXml(id, namedAs('box', linesText(runs.flatMap(r => r.lines)), n.id), box, ld.day, tones, fonts), {kind: 'rect', r: rect}, pathOf(i), runs.length > 0);
  }
  return {xml: groupXml(next(), namedAs('tree', '', b.id), b, assembleParts(pieces, next)), glue};
}
