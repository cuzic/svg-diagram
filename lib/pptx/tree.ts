// A tree band (tree, mind map, org chart, KPI tree, roadmap, fishbone) as native shapes: each node a rounded rectangle holding its own
// text, each line a connector glued to the parent and the child (a curved line is a curvedConnector3, an elbow a bentConnector), and a
// brace a freeform. Moving a node in PowerPoint drags its lines along. A dimmed tree (spotlight) stays a picture.
import {PALETTE, colorOf, isSolidTone, toneStyle} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutTree, TreeNodeText} from '../types/diagrams.ts';
import type {WrappedRun} from '../types/text-bands.ts';
import {fitConnector, siteIndex, type Pt} from './geom.ts';
import {boxXml, groupXml, type TextBox} from './shapes.ts';
import {connectorShapeXml, freeformPathXml, type Glue} from './connectors.ts';
import type {Fonts, Rect} from './xml.ts';
import type {ToneEnv} from '../tokens.ts';

/** The tree's padding inside a node (lib/tree.ts PAD_X / PAD_Y). */
const PAD_X = 14, PAD_Y = 8;

type Node = LaidOutTree['nodes'][number];

/** The texts drawn inside a node, by the same test the svg uses to colour them. */
const inside = (r: Rect, t: TreeNodeText): boolean => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h;

/** A node's lines as runs: consecutive lines of the same size, weight and colour are one run, at the baselines the layout gave. */
export function nodeRunsOf(n: Node, texts: readonly TreeNodeText[], tones: ToneEnv): WrappedRun[] {
  const solid = isSolidTone(n.tone), soft = toneStyle(tones, n.tone).fill === 'soft';
  const runs: WrappedRun[] = [];
  for (const t of texts.filter(t => inside(n, t))) {
    // as the svg: white on a solid fill (the second line too); the muted second line takes the plain colour on a soft fill
    const tone = solid || !t.muted || soft ? undefined : 'muted' as const;
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

/** The tree's shapes, numbered from `next`. Lines first, then braces, then nodes (as the svg draws them), all in one group. */
export function treeXml(b: LaidOutTree, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): TreeShapes {
  const nodes = b.nodes.filter(n => !n.band).map(n => ({n, id: next(), rect: {x: n.x, y: n.y, w: n.w, h: n.h}}));
  const glue = nodes.flatMap(({n, id, rect}) => n.id ? [{dslId: n.id, id, rect}] : []);
  const out: string[] = [];
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
    if (fit.ok) {
      const x = e.curve ? {...fit.x, prst: fit.x.prst.replace('bentConnector', 'curvedConnector')} : fit.x;
      out.push(connectorShapeXml(id, `tree-line-${id}`, x, color, width, start, end));
    } else out.push(freeformPathXml(id, `tree-line-${id}`, e.points.map((p, i) => ({op: i ? 'L' : 'M', pts: [p]})), color, width));
  }
  for (const br of b.braces ?? []) {
    const s = br.side === 'right' ? 1 : -1, r = 8, {x, tipX: xt, y1, y2, ymid: ym} = br;
    const id = next();
    out.push(freeformPathXml(id, `tree-brace-${id}`, [
      {op: 'M', pts: [{x: x + s * r, y: y1}]}, {op: 'Q', pts: [{x, y: y1}, {x, y: y1 + r}]}, {op: 'L', pts: [{x, y: ym - r}]},
      {op: 'Q', pts: [{x, y: ym}, {x: xt, y: ym}]}, {op: 'Q', pts: [{x, y: ym}, {x, y: ym + r}]}, {op: 'L', pts: [{x, y: y2 - r}]},
      {op: 'Q', pts: [{x, y: y2}, {x: x + s * r, y: y2}]},
    ], PALETTE.muted, 2));
  }
  for (const {n, id, rect} of nodes) {
    const box: TextBox = {...rect, tone: n.tone, padX: PAD_X, padY: PAD_Y, align: 'center', wrappedRuns: nodeRunsOf(n, b.texts, tones)};
    out.push(boxXml(id, n.id ?? `tree-node-${id}`, box, ld.day, tones, fonts));
  }
  return {xml: groupXml(next(), b.id ? `tree-${b.id}` : 'tree', b, out.join('')), glue};
}
