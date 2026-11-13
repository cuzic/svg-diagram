// A state diagram or flowchart (the `states` band) as native shapes: each node a shape holding its own text (a rounded rectangle, or a
// diamond, ellipse or pill whose text area is the whole box), each transition an arrow connector glued to the two nodes, a transition's
// label a text box on a white chip, the start dot an ellipse. Moving a node drags its arrows along. A dimmed band, or one whose nodes
// carry icons (not drawn as shapes yet), stays a picture.
import {PALETTE, colorOf, isSolidTone, toneStyle, type ToneEnv} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutStates} from '../types/diagrams.ts';
import {fitConnector, siteIndex, type Pt} from './geom.ts';
import {boxXml, groupXml, type TextBox} from './shapes.ts';
import {connectorShapeXml, freeformPathXml, type Glue} from './connectors.ts';
import {boxTextXml, geomShapeXml, namedAs, presetXml, prstGeomXml, roundGeomXml} from './prims.ts';
import {nodeRunsOf} from './tree.ts';
import type {Fonts, Rect} from './xml.ts';

/** The tree's padding, which states lays its text out with (lib/tree.ts nodeRuns). */
const PAD_X = 14, PAD_Y = 8;

type Node = LaidOutStates['nodes'][number];

/** The geometry of a node that is not a rounded rectangle. */
const geomOf = (n: Node): string | undefined => n.circle ? roundGeomXml('ellipse', n.w, n.h) : n.shape === 'diamond' ? roundGeomXml('diamond', n.w, n.h) : n.shape === 'pill' ? roundGeomXml('pill', n.w, n.h) : undefined;

/** The node a route end touches: its box, or for a diamond or circle the box around it (the ends lie on the outline, inside the box). */
function nodeAt(nodes: readonly {rect: Rect; id: number}[], p: Pt): {rect: Rect; id: number} | undefined {
  return nodes.find(({rect: r}) => p.x >= r.x - 2 && p.x <= r.x + r.w + 2 && p.y >= r.y - 2 && p.y <= r.y + r.h + 2);
}

export interface StatesShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

export function statesXml(b: LaidOutStates, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): StatesShapes {
  const day = ld.day;
  const nodes = b.nodes.map((n, i) => ({n, id: next(), rect: {x: n.x, y: n.y, w: n.w, h: n.h}, dslId: b.anchors[i]?.id}));
  const textOf = (dslId: string): string => { const x = nodes.find(m => m.dslId === dslId); return x ? nodeRunsOf(x.n, b.texts, tones).flatMap(r => r.lines).join('') : dslId; };
  const out: string[] = [];
  // the start dot, glueable like a node (a custGeom ellipse with the four sites)
  const dot = b.initial && {id: next(), rect: {x: b.initial.x - b.initial.r, y: b.initial.y - b.initial.r, w: 2 * b.initial.r, h: 2 * b.initial.r}};
  const ends = dot ? [...nodes, dot] : nodes;
  const inkOf = (tone: 'danger' | 'accent' | 'muted' | undefined): string => tone === undefined ? PALETTE.text : tone === 'muted' ? PALETTE.muted : colorOf(tone, day);
  for (const e of b.edges) {
    const a = e.points[0], z = e.points[e.points.length - 1];
    if (!a || !z) continue;
    const from = nodeAt(ends, a), to = nodeAt(ends, z);
    const start: Glue | undefined = from && {id: from.id, idx: siteIndex(from.rect, a, '')};
    const end: Glue | undefined = to && {id: to.id, idx: siteIndex(to.rect, z, '')};
    const opts = {dashed: e.line === 'dashed', dotted: e.line === 'dotted', arrow: true};
    const fit = fitConnector(e.points);
    const id = next(), name = namedAs('arrow', `${textOf(e.from)} → ${textOf(e.to)}`);
    out.push(fit.ok
      ? connectorShapeXml(id, name, fit.x, inkOf(e.tone), e.strong ? 4 : 2, start, end, opts)
      : freeformPathXml(id, name, e.points.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), inkOf(e.tone), e.strong ? 4 : 2, opts));
  }
  if (dot) out.push(geomShapeXml(dot.id, 'start', dot.rect, roundGeomXml('ellipse', dot.rect.w, dot.rect.h), {fill: PALETTE.text}));
  for (const {n, id, rect, dslId} of nodes) {
    const runs = nodeRunsOf(n, b.texts, tones), text = runs.flatMap(r => r.lines).join('');
    const box: TextBox = {...rect, tone: n.tone, padX: PAD_X, padY: PAD_Y, align: 'center', wrappedRuns: runs};
    const shape = boxXml(id, namedAs('box', text, dslId), box, day, tones, fonts, geomOf(n));
    if (!n.final) out.push(shape);
    else {
      // the inner outline of an end state; on a solid fill it is drawn in the text colour (white), as the svg draws it
      const inner = {x: n.x + 4, y: n.y + 4, w: n.w - 8, h: n.h - 8};
      const ts = toneStyle(tones, n.tone);
      const stroke = isSolidTone(n.tone) ? colorOf(ts.text, day) : ts.stroke === null ? colorOf(ts.fill, day) : colorOf(ts.stroke, day);
      const frame = presetXml(next(), 'inner frame', 'roundRect', inner, {stroke, widthPx: 2.5}, Math.min(inner.w, inner.h) > 0 ? 5 / Math.min(inner.w, inner.h) * 100000 : 0);
      // an end state: its box and inner frame are one part (ADR 0054)
      out.push(groupXml(next(), namedAs('state', text, dslId), rect, shape + frame));
    }
  }
  // a label: its white chip holds its text, one shape (ADR 0054)
  for (const l of b.labels) out.push(geomShapeXml(next(), namedAs('label', l.text), l, prstGeomXml('rect'), {fill: PALETTE.bg}, boxTextXml(l, [{text: l.text, x: l.tx, y: l.ty, anchor: 'middle', size: l.size, bold: false, color: PALETTE.text}], fonts)));
  const glue = nodes.flatMap(({dslId, id, rect}) => dslId ? [{dslId, id, rect}] : []);
  return {xml: groupXml(next(), namedAs(b.flavor === 'flowchart' ? 'flowchart' : 'states', '', b.id), b, out.join('')), glue};
}
