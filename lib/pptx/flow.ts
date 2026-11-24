// The figures drawn from plain primitives, as native shapes: the flow shapes (chevron, funnel, cycle, Venn, concentric, emblem, value
// chain). Each polygon, circle, frame and path becomes a shape of its own (a filled path a freeform, an
// arrow path an open freeform with a head). A text inside a shape is that shape's text (fill.ts), so it moves and wraps with it; any other
// is a text box at its baseline. Items with an id stay glueable through an invisible rectangle over their anchor. A dimmed band stays a
// picture.
import {PALETTE, colorOf, type ToneEnv} from '../tokens.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';
import type {Anchor} from '../types/core.ts';
import {freeformPathXml} from './connectors.ts';
import {bboxOf, drawParts, geomHolder, joined, outlineHolder, polygonHolder, type PartDrawn, type Placed} from './fill.ts';
import type {Geo} from './parts-group.ts';
import {anchorXml, groupXml} from './shapes.ts';
import {dashOfSvg, namedAs, nameOf, presetXml, roundGeomXml, type Paint, type TextLine} from './prims.ts';
import {svgPathSteps} from './svg-path.ts';
import type {Fonts, Rect} from './xml.ts';

export interface DrawnShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

/** Invisible rectangles over the anchors, so connect() can glue to an item drawn as several pieces. */
function anchorsXml(anchors: readonly Anchor[], next: () => number): DrawnShapes {
  const glue = anchors.map(a => ({dslId: a.id, id: next(), rect: {x: a.x, y: a.y, w: a.w, h: a.h}}));
  return {xml: glue.map(g => anchorXml(g.id, `anchor-${g.dslId}`, g.rect)).join(''), glue};
}

export function flowShapeXml(b: LaidOutFlowShape, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): DrawnShapes {
  const day = ld.day, drawn: PartDrawn[] = [];
  const boxPaint = (tone: Parameters<typeof resolveBoxStyle>[1], widthPx: number): Paint => { const s = resolveBoxStyle(tones, tone, day); return {fill: s.fill, stroke: s.stroke, widthPx, dashed: s.dashed}; };
  for (const p of b.primitives) {
    const id = next(), part = 'part' in p && p.part ? {part: p.part} : {};
    const box = (r: Rect): Geo => ({kind: 'rect', r});
    // an item keeps its name (item-<id>); another shape is named by its text, if it takes some
    const name = (kind: string) => (texts: readonly TextLine[]) => 'node' in p && p.node ? `item-${p.node}` : nameOf(kind, id, joined(texts));
    if (p.k === 'polygon') {
      const pts = p.points.map(([x, y]) => ({x, y}));
      drawn.push({d: polygonHolder(id, name('shape'), pts, boxPaint(p.tone, p.strong ? 3.5 : 2)), geo: box(bboxOf(pts)), ...part});
    } else if (p.k === 'circle') {
      const rect = {x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r}, c = colorOf(p.tone, day);
      const paint: Paint = p.fill ? boxPaint(p.fill, 2) : {fill: c, fillOpacity: p.opacity ?? .16, stroke: c, widthPx: 2, ...dashOfSvg(p.dash)};
      drawn.push({d: geomHolder(id, name('circle'), rect, roundGeomXml('ellipse', rect.w, rect.h), paint, q => Math.hypot(q.x - p.cx, q.y - p.cy) <= p.r), geo: box(rect), ...part});
    } else if (p.k === 'rect') drawn.push({d: presetXml(id, 'frame', 'roundRect', p, {stroke: colorOf(p.tone, day), widthPx: 2}, Math.min(p.w, p.h) > 0 ? 8 / Math.min(p.w, p.h) * 100000 : 0), geo: box(p), ...part});
    else {
      const {steps} = svgPathSteps(p.d);
      const pts = steps.flatMap(s => s.pts);
      if (p.fill) drawn.push({d: outlineHolder(id, name('shape'), steps, steps.flatMap(s => s.pts.slice(-1)), boxPaint(p.fill, 2)), geo: box(bboxOf(pts)), ...part});
      else drawn.push({d: freeformPathXml(id, 'line', steps, colorOf(p.tone, day), p.thin ? 1.5 : 2, {arrow: p.arrow}), geo: {kind: 'poly', pts, w: p.thin ? 1.5 : 2}, ...part});
    }
  }
  const texts = b.texts.map((t): Placed => ({t: {text: t.text, x: t.tx, y: t.ty, anchor: t.anchor, size: t.size, bold: t.weight === 700, color: t.tone === 'bg' ? PALETTE.bg : colorOf(t.tone, day)}, w: t.w, ...(t.part ? {part: t.part} : {})}));
  // the anchors last (over everything, as before), each in its item's part: a connector glued to it follows the item's group (ADR 0054)
  const anchors = anchorsXml(b.anchors, next);
  anchors.glue.forEach((g, i) => { const a = b.anchors[i]; // (an anchor is invisible: its geometry is a point at its centre, so it never crosses a shape and never moves a group)
    drawn.push({d: anchorXml(g.id, `anchor-${g.dslId}`, g.rect), geo: {kind: 'rect', r: {x: g.rect.x + g.rect.w / 2, y: g.rect.y + g.rect.h / 2, w: 0, h: 0}}, ...(a?.part ? {part: a.part} : {})}); });
  return {xml: groupXml(next(), namedAs(b.type, '', b.id), b, drawParts(drawn, texts, fonts, next)), glue: anchors.glue};
}
