import {PALETTE, colorOf} from '../tokens.ts';
import {TIMELINE_AXIS} from '../parts.ts';
import type {LaidOutTimeline} from '../types/timeline.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import {freeformPathXml} from './line-shapes.ts';
import {drawParts, geomHolder, joined} from './fill.ts';
import type {Drawn, PartDrawn, Placed} from './fill.ts';
import {groupXml} from './shapes.ts';
import {lineXml, namedAs, nameOf, presetXml, prstGeomXml} from './prims.ts';
import type {Fonts, Rect} from './xml.ts';

/** A timeline: the axis, ticks, stems and guides as lines, the span and bars as rectangles (a bar holding the texts inside it), dots as circles, any other text a text box. */
export function timelineXml(b: LaidOutTimeline, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  // ADR 0054: an event (stem, dot, name, date), the axis (line, ticks, dates) and the remaining span (bracket, label) are parts
  const col = (k: 'text' | 'muted' | 'accent' | 'danger'): string => colorOf(k, ld.day), out: PartDrawn[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number, part?: string) =>
    out.push({d: lineXml(next(), 'line', {x: x1, y: y1}, {x: x2, y: y2}, color, w), geo: {kind: 'poly', pts: [{x: x1, y: y1}, {x: x2, y: y2}], w}, ...(part ? {part} : {})});
  const area = (d: Drawn, r: Rect, part?: string) => out.push({d, geo: {kind: 'rect', r}, ...(part ? {part} : {})});
  if (b.span?.fill) { const r = {x: b.span.x1, y: b.span.y - 12, w: b.span.x2 - b.span.x1, h: 24}; area(presetXml(next(), 'span', 'rect', r, {fill: b.span.tone === 'accent' ? PALETTE[ld.day].soft : PALETTE.border}), r); }
  line(b.axis.x1, b.axis.y, b.axis.x2, b.axis.y, PALETTE.muted, 2, TIMELINE_AXIS);
  if (b.span && !b.span.fill) line(b.span.x1, b.span.y, b.span.x2, b.span.y, col(b.span.tone), 8);
  for (const g of b.guides ?? []) line(g.x1, g.y, g.x2, g.y, PALETTE.border, 1);
  for (const r of b.bars ?? []) { const id = next(), rect = {x: r.x, y: r.y, w: r.w, h: r.h}; area(geomHolder(id, texts => nameOf('bar', id, joined(texts)), rect, prstGeomXml('rect'), {fill: col(r.tone), fillOpacity: .18, stroke: col(r.tone), widthPx: 2}), rect); }
  for (const d of b.dims ?? []) { line(d.x1, d.y, d.x2, d.y, col(d.tone), 2); line(d.x1, d.y - 5, d.x1, d.y + 5, col(d.tone), 2); line(d.x2, d.y - 5, d.x2, d.y + 5, col(d.tone), 2); }
  if (b.fullLine) line(b.fullLine.x, b.fullLine.y1, b.fullLine.x, b.fullLine.y2, col('danger'), 2);
  for (const t of b.ticks) line(t.x, t.y1, t.x, t.y2, PALETTE.muted, 2, TIMELINE_AXIS);
  for (const s of b.stems) line(s.x, s.y1, s.x, s.y2, col(s.tone), 2, s.part);
  for (const d of b.dots) { const r = {x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r}; area(presetXml(next(), 'dot', 'ellipse', r, {fill: col(d.tone), stroke: PALETTE.bg, widthPx: 4}), r, d.part); }
  if (b.bracket) {
    const {x1, x2, y, tone, part} = b.bracket, pts = [{x: x1, y: y - 4}, {x: x1, y}, {x: x2, y}, {x: x2, y: y - 4}];
    out.push({d: freeformPathXml(next(), 'bracket', pts.map((q, i) => ({op: i ? 'L' as const : 'M' as const, pts: [q]})), col(tone), 2), geo: {kind: 'poly', pts, w: 2}, ...(part ? {part} : {})});
  }
  const texts = b.texts.map((t): Placed => ({t: {text: t.text, x: t.x, y: t.y, anchor: t.anchor, size: t.size, bold: !!t.bold, color: col(t.fill)}, ...(t.part ? {part: t.part} : {})}));
  return groupXml(next(), namedAs('timeline', '', b.id), b, drawParts(out, texts, fonts, next));
}
