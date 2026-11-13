// The figures drawn from plain primitives, as native shapes: the flow shapes (chevron, funnel, cycle, Venn, concentric, emblem, value
// chain), the pyramid and the timeline. Each polygon, circle, frame and path becomes a shape of its own (a filled path a freeform, an
// arrow path an open freeform with a head). A text inside a shape is that shape's text (fill.ts), so it moves and wraps with it; any other
// is a text box at its baseline. Items with an id stay glueable through an invisible rectangle over their anchor. A dimmed band stays a
// picture.
import {PALETTE, colorOf, type ToneEnv} from '../tokens.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';
import type {LaidOutPyramid} from '../types/figures.ts';
import type {LaidOutTimeline} from '../types/timeline.ts';
import type {Anchor} from '../types/core.ts';
import {freeformPathXml} from './connectors.ts';
import {drawAll, geomHolder, joined, outlineHolder, polygonHolder, type Drawn, type Placed} from './fill.ts';
import {anchorXml, groupXml} from './shapes.ts';
import {dashOfSvg, lineXml, nameOf, presetXml, prstGeomXml, roundGeomXml, type Paint, type TextLine} from './prims.ts';
import {svgPathSteps} from './svg-path.ts';
import type {Fonts, Rect} from './xml.ts';

export interface DrawnShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

/** Invisible rectangles over the anchors, so connect() can glue to an item drawn as several pieces. */
function anchorsXml(anchors: readonly Anchor[], next: () => number): DrawnShapes {
  const glue = anchors.map(a => ({dslId: a.id, id: next(), rect: {x: a.x, y: a.y, w: a.w, h: a.h}}));
  return {xml: glue.map(g => anchorXml(g.id, `anchor-${g.dslId}`, g.rect)).join(''), glue};
}

export function flowShapeXml(b: LaidOutFlowShape, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): DrawnShapes {
  const day = ld.day, drawn: Drawn[] = [];
  const boxPaint = (tone: Parameters<typeof resolveBoxStyle>[1], widthPx: number): Paint => { const s = resolveBoxStyle(tones, tone, day); return {fill: s.fill, stroke: s.stroke, widthPx, dashed: s.dashed}; };
  for (const p of b.primitives) {
    const id = next();
    // an item keeps its name (item-<id>); another shape is named by its text, if it takes some
    const name = (kind: string) => (texts: readonly TextLine[]) => 'node' in p && p.node ? `item-${p.node}` : nameOf(kind, id, joined(texts));
    if (p.k === 'polygon') {
      drawn.push(polygonHolder(id, name('shape'), p.points.map(([x, y]) => ({x, y})), boxPaint(p.tone, p.strong ? 3.5 : 2)));
    } else if (p.k === 'circle') {
      const rect = {x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r}, c = colorOf(p.tone, day);
      const paint: Paint = p.fill ? boxPaint(p.fill, 2) : {fill: c, fillOpacity: p.opacity ?? .16, stroke: c, widthPx: 2, ...dashOfSvg(p.dash)};
      drawn.push(geomHolder(id, name('circle'), rect, roundGeomXml('ellipse', rect.w, rect.h), paint, q => Math.hypot(q.x - p.cx, q.y - p.cy) <= p.r));
    } else if (p.k === 'rect') drawn.push(presetXml(id, `frame-${id}`, 'roundRect', p, {stroke: colorOf(p.tone, day), widthPx: 2}, Math.min(p.w, p.h) > 0 ? 8 / Math.min(p.w, p.h) * 100000 : 0));
    else {
      const {steps} = svgPathSteps(p.d);
      if (p.fill) drawn.push(outlineHolder(id, name('shape'), steps, steps.flatMap(s => s.pts.slice(-1)), boxPaint(p.fill, 2)));
      else drawn.push(freeformPathXml(id, `line-${id}`, steps, colorOf(p.tone, day), p.thin ? 1.5 : 2, {arrow: p.arrow}));
    }
  }
  const texts = b.texts.map((t): Placed => ({t: {text: t.text, x: t.tx, y: t.ty, anchor: t.anchor, size: t.size, bold: t.weight === 700, color: t.tone === 'bg' ? PALETTE.bg : colorOf(t.tone, day)}, w: t.w}));
  const body = drawAll(drawn, texts, fonts, next);
  const anchors = anchorsXml(b.anchors, next);
  return {xml: groupXml(next(), b.id ? `${b.type}-${b.id}` : b.type, b, body + anchors.xml), glue: anchors.glue};
}

/** A pyramid: each layer a trapezoid in the accent colour at its opacity, holding its lines. */
export function pyramidXml(b: LaidOutPyramid, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  const accent = PALETTE[b.day].accent, drawn: Drawn[] = [], texts: Placed[] = [];
  for (const layer of b.layers) {
    const id = next();
    drawn.push(polygonHolder(id, () => nameOf('layer', id, layer.lines.join('')), layer.points.map(([x, y]) => ({x, y})), {fill: accent, fillOpacity: layer.opacity, stroke: accent, widthPx: 2.5}));
    layer.lines.forEach((line, i) => texts.push({t: {text: line, x: layer.cx, y: layer.textYs[i] ?? 0, anchor: 'middle', size: ld.roles.title, bold: true, color: layer.textColor}}));
  }
  return groupXml(next(), 'pyramid', b, drawAll(drawn, texts, fonts, next));
}

/** A timeline: the axis, ticks, stems and guides as lines, the span and bars as rectangles (a bar holding the texts inside it), dots as circles, any other text a text box. */
export function timelineXml(b: LaidOutTimeline, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  const col = (k: 'text' | 'muted' | 'accent' | 'danger'): string => colorOf(k, ld.day), out: Drawn[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number) => out.push(lineXml(next(), 'line', {x: x1, y: y1}, {x: x2, y: y2}, color, w));
  if (b.span?.fill) out.push(presetXml(next(), 'span', 'rect', {x: b.span.x1, y: b.span.y - 12, w: b.span.x2 - b.span.x1, h: 24}, {fill: b.span.tone === 'accent' ? PALETTE[ld.day].soft : PALETTE.border}));
  line(b.axis.x1, b.axis.y, b.axis.x2, b.axis.y, PALETTE.muted, 2);
  if (b.span && !b.span.fill) line(b.span.x1, b.span.y, b.span.x2, b.span.y, col(b.span.tone), 8);
  for (const g of b.guides ?? []) line(g.x1, g.y, g.x2, g.y, PALETTE.border, 1);
  for (const r of b.bars ?? []) { const id = next(); out.push(geomHolder(id, texts => nameOf('bar', id, joined(texts)), {x: r.x, y: r.y, w: r.w, h: r.h}, prstGeomXml('rect'), {fill: col(r.tone), fillOpacity: .18, stroke: col(r.tone), widthPx: 2})); }
  for (const d of b.dims ?? []) { line(d.x1, d.y, d.x2, d.y, col(d.tone), 2); line(d.x1, d.y - 5, d.x1, d.y + 5, col(d.tone), 2); line(d.x2, d.y - 5, d.x2, d.y + 5, col(d.tone), 2); }
  if (b.fullLine) line(b.fullLine.x, b.fullLine.y1, b.fullLine.x, b.fullLine.y2, col('danger'), 2);
  for (const t of b.ticks) line(t.x, t.y1, t.x, t.y2, PALETTE.muted, 2);
  for (const s of b.stems) line(s.x, s.y1, s.x, s.y2, col(s.tone), 2);
  for (const d of b.dots) out.push(presetXml(next(), 'dot', 'ellipse', {x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r}, {fill: col(d.tone), stroke: PALETTE.bg, widthPx: 4}));
  if (b.bracket) { const {x1, x2, y, tone} = b.bracket; out.push(freeformPathXml(next(), 'bracket', [{op: 'M', pts: [{x: x1, y: y - 4}]}, {op: 'L', pts: [{x: x1, y}]}, {op: 'L', pts: [{x: x2, y}]}, {op: 'L', pts: [{x: x2, y: y - 4}]}], col(tone), 2)); }
  const texts = b.texts.map((t): Placed => ({t: {text: t.text, x: t.x, y: t.y, anchor: t.anchor, size: t.size, bold: !!t.bold, color: col(t.fill)}}));
  return groupXml(next(), b.id ? `timeline-${b.id}` : 'timeline', b, drawAll(out, texts, fonts, next));
}
