// A cause-and-effect band (current / future reality tree, PDPC, relation diagram, why-why tree, negative branch) as native shapes: each
// entity a shape holding its own text (a hexagon for an obstacle, an inner frame for a double outline, a thick frame and a badge for the
// core driver), each arrow a connector glued to cause and effect, an AND as a curved freeform across its arrows, a cutting arrow as a
// dashed line ending in a bar. The hops of `hop` are not drawn: the lines simply cross. A dimmed band stays a picture.
import {PALETTE, colorOf, isSolidTone, toneStyle, type ToneEnv} from '../tokens.ts';
import {CORE_BADGE_GAP, CORE_BADGE_H, CORE_BADGE_W} from '../toc.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutCause} from '../types/diagrams.ts';
import {fitConnector, siteIndex, type Pt} from './geom.ts';
import {boxXml, groupXml, type TextBox} from './shapes.ts';
import {connectorShapeXml, freeformPathXml, type Glue} from './connectors.ts';
import {lineXml, nameOf, presetXml, roundGeomXml, textLineXml} from './prims.ts';
import {nodeRunsOf} from './tree.ts';
import type {Fonts, Rect} from './xml.ts';

const PAD_X = 14, PAD_Y = 8, CORE_STROKE = 3.5;

type Node = LaidOutCause['nodes'][number];

/** The arrow colour of a figure with `focus` (ADR 0051): lit (it touches a focused item) in the accent colour, the others muted. */
export function focusColor(focused: readonly string[] | undefined, day: LaidOutDiagram['day'], plain: string): (from: string, to: string) => string {
  if (!focused) return () => plain;
  const f = new Set(focused);
  return (from, to) => f.has(from) || f.has(to) ? colorOf('accent', day) : PALETTE.muted;
}

/** Where the core driver's badge goes: just outside the side away from the arrows that leave it (as lib/emit-figures.ts coreBadge). */
export function coreBadgeRect(n: Rect, leave: Pt | undefined): Rect {
  const eps = 1;
  const side = !leave ? 'top' : Math.abs(leave.y - n.y) < eps ? 'bottom' : Math.abs(leave.y - n.y - n.h) < eps ? 'top' : Math.abs(leave.x - n.x) < eps ? 'right' : 'left';
  const x = side === 'left' ? n.x - CORE_BADGE_W - CORE_BADGE_GAP : side === 'right' ? n.x + n.w + CORE_BADGE_GAP : n.x + 6;
  const y = side === 'top' ? n.y - CORE_BADGE_H - CORE_BADGE_GAP : side === 'bottom' ? n.y + n.h + CORE_BADGE_GAP : n.y + 6;
  return {x, y, w: CORE_BADGE_W, h: CORE_BADGE_H};
}

export interface CauseShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

export function causeXml(b: LaidOutCause, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): CauseShapes {
  const day = ld.day;
  const nodes = b.nodes.map((n, i) => ({n, id: next(), rect: {x: n.x, y: n.y, w: n.w, h: n.h}, dslId: b.anchors[i]?.id}));
  const byId = new Map(nodes.flatMap(x => x.dslId ? [[x.dslId, x] as const] : []));
  const ink = focusColor(b.focused, day, PALETTE.text);
  const out: string[] = [];
  const edges = b.edges.map((e, k) => ({e, k}));
  // with focus, the lit arrows last (over the muted ones they cross)
  if (b.focused) edges.sort((p, q) => Number(ink(p.e.from, p.e.to) !== PALETTE.muted) - Number(ink(q.e.from, q.e.to) !== PALETTE.muted));
  for (const {e} of edges) {
    const color = ink(e.from, e.to);
    const pts = e.points.map(p => ({...p}));
    const a = pts[0], z = pts[pts.length - 1], before = pts[pts.length - 2];
    if (!a || !z || !before) continue;
    const from = byId.get(e.from), to = byId.get(e.to);
    const start: Glue | undefined = from && {id: from.id, idx: siteIndex(from.rect, a, '')};
    let end: Glue | undefined = to && {id: to.id, idx: siteIndex(to.rect, z, '')};
    const blocks = e.kind === 'blocks';
    if (blocks) {
      // no head: the line stops 3px short of the box it cuts, and a bar 20px long crosses its end
      const dx = Math.sign(z.x - before.x), dy = Math.sign(z.y - before.y), tip = {x: z.x - dx * 3, y: z.y - dy * 3};
      pts[pts.length - 1] = tip;
      end = undefined;
      const bar = next();
      out.push(lineXml(bar, `bar-${e.from}-${e.to}`, {x: tip.x - dy * 10, y: tip.y + dx * 10}, {x: tip.x + dy * 10, y: tip.y - dx * 10}, color, 3));
    }
    const opts = {dashed: e.line === 'dashed', dotted: e.line === 'dotted', arrow: !blocks};
    const width = e.back ? 3 : 2;
    const fit = fitConnector(pts);
    const id = next(), name = `arrow-${e.from}-${e.to}`;
    out.push(fit.ok
      ? connectorShapeXml(id, name, fit.x, color, width, start, end, opts)
      : freeformPathXml(id, name, pts.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), color, width, opts));
  }
  for (const a of b.ands) {
    // lit when any of its arrows is (without focus, every arrow is the plain colour)
    const id = next(), color = a.from.map(f => ink(f, a.to)).find(c => c !== PALETTE.muted) ?? PALETTE.muted;
    out.push(freeformPathXml(id, `and-${a.to}`, [{op: 'M', pts: [a.p0]}, {op: 'Q', pts: [a.c, a.p1]}], color, 2));
  }
  for (const {n, id, rect, dslId} of nodes) {
    const box: TextBox = {...rect, tone: n.tone, ...(n.dashed ? {dashed: true} : {}), padX: PAD_X, padY: PAD_Y, align: 'center', wrappedRuns: nodeRunsOf(n, b.texts, tones)};
    out.push(boxXml(id, dslId ?? `entity-${id}`, box, day, tones, fonts, n.hex ? roundGeomXml('hex', n.w, n.h) : undefined, n.core ? CORE_STROKE : n.hex ? 2 : 2.5));
    if (n.double && !n.hex) out.push(innerFrame(n, tones, day, next));
    if (n.core) {
      const r = coreBadgeRect(n, b.edges.find(e => e.from === dslId)?.points[0]);
      const badge = next(), text = next();
      out.push(presetXml(badge, `core-badge-${dslId ?? badge}`, 'roundRect', r, {fill: colorOf('accent', day)}, 8 / Math.min(r.w, r.h) * 100000));
      out.push(textLineXml(text, nameOf('core', text, b.coreBadge ?? '中核'), {text: b.coreBadge ?? '中核', x: r.x + r.w / 2, y: r.y + 16, anchor: 'middle', size: 14, bold: true, color: PALETTE.bg}, fonts));
    }
  }
  const glue = nodes.flatMap(({dslId, id, rect}) => dslId ? [{dslId, id, rect}] : []);
  return {xml: groupXml(next(), b.id ? `cause-${b.id}` : 'cause', b, out.join('')), glue};
}

/** The inner outline of a double frame: in the text colour (white) on a solid fill, as the svg draws it. */
function innerFrame(n: Node, tones: ToneEnv, day: LaidOutDiagram['day'], next: () => number): string {
  const inner = {x: n.x + 4, y: n.y + 4, w: n.w - 8, h: n.h - 8};
  const ts = toneStyle(tones, n.tone);
  const stroke = isSolidTone(n.tone) ? colorOf(ts.text, day) : ts.stroke === null ? colorOf(ts.fill, day) : colorOf(ts.stroke, day);
  const id = next();
  return presetXml(id, `inner-${id}`, 'roundRect', inner, {stroke, widthPx: 2.5}, Math.min(inner.w, inner.h) > 0 ? 5 / Math.min(inner.w, inner.h) * 100000 : 0);
}
