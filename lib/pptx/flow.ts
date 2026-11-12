// The figures drawn from plain primitives, as native shapes: the flow shapes (chevron, funnel, cycle, Venn, concentric, emblem, value
// chain), the pyramid and the timeline. Each polygon, circle, frame and path becomes a shape of its own (a filled path a freeform, an
// arrow path an open freeform with a head), each text a text box at its baseline. Items with an id stay glueable through an invisible
// rectangle over their anchor. A dimmed band stays a picture.
import {PALETTE, colorOf, type ToneEnv} from '../tokens.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';
import type {LaidOutPyramid} from '../types/figures.ts';
import type {LaidOutTimeline} from '../types/timeline.ts';
import type {Anchor} from '../types/core.ts';
import {freeformPathXml} from './connectors.ts';
import {anchorXml, groupXml} from './shapes.ts';
import {dashOfSvg, lineXml, nameOf, pathShapeXml, polygonXml, presetXml, textLineXml, type Paint} from './prims.ts';
import {svgPathSteps} from './svg-path.ts';
import type {Fonts, Rect} from './xml.ts';

export interface DrawnShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

/** Invisible rectangles over the anchors, so connect() can glue to an item drawn as several pieces. */
function anchorsXml(anchors: readonly Anchor[], next: () => number): DrawnShapes {
  const glue = anchors.map(a => ({dslId: a.id, id: next(), rect: {x: a.x, y: a.y, w: a.w, h: a.h}}));
  return {xml: glue.map(g => anchorXml(g.id, `anchor-${g.dslId}`, g.rect)).join(''), glue};
}

export function flowShapeXml(b: LaidOutFlowShape, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): DrawnShapes {
  const day = ld.day, out: string[] = [];
  const boxPaint = (tone: Parameters<typeof resolveBoxStyle>[1], widthPx: number): Paint => { const s = resolveBoxStyle(tones, tone, day); return {fill: s.fill, stroke: s.stroke, widthPx, dashed: s.dashed}; };
  for (const p of b.primitives) {
    const id = next();
    if (p.k === 'polygon') out.push(polygonXml(id, p.node ? `item-${p.node}` : `shape-${id}`, p.points.map(([x, y]) => ({x, y})), boxPaint(p.tone, p.strong ? 3.5 : 2)));
    else if (p.k === 'circle') {
      const r = {x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r};
      if (p.fill) out.push(presetXml(id, p.node ? `item-${p.node}` : `circle-${id}`, 'ellipse', r, boxPaint(p.fill, 2)));
      else { const c = colorOf(p.tone, day); out.push(presetXml(id, p.node ? `item-${p.node}` : `circle-${id}`, 'ellipse', r, {fill: c, fillOpacity: p.opacity ?? .16, stroke: c, widthPx: 2, ...dashOfSvg(p.dash)})); }
    } else if (p.k === 'rect') out.push(presetXml(id, `frame-${id}`, 'roundRect', p, {stroke: colorOf(p.tone, day), widthPx: 2}, Math.min(p.w, p.h) > 0 ? 8 / Math.min(p.w, p.h) * 100000 : 0));
    else {
      const {steps} = svgPathSteps(p.d);
      if (p.fill) out.push(pathShapeXml(id, p.node ? `item-${p.node}` : `shape-${id}`, steps, boxPaint(p.fill, 2)));
      else out.push(freeformPathXml(id, `line-${id}`, steps, colorOf(p.tone, day), p.thin ? 1.5 : 2, {arrow: p.arrow}));
    }
  }
  for (const t of b.texts) {
    const id = next();
    out.push(textLineXml(id, nameOf('text', id, t.text), {text: t.text, x: t.tx, y: t.ty, anchor: t.anchor, size: t.size, bold: t.weight === 700, color: t.tone === 'bg' ? PALETTE.bg : colorOf(t.tone, day)}, fonts));
  }
  const anchors = anchorsXml(b.anchors, next);
  return {xml: groupXml(next(), b.id ? `${b.type}-${b.id}` : b.type, b, out.join('') + anchors.xml), glue: anchors.glue};
}

/** A pyramid: each layer a trapezoid in the accent colour at its opacity, its lines text boxes. */
export function pyramidXml(b: LaidOutPyramid, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  const accent = PALETTE[b.day].accent, out: string[] = [];
  for (const layer of b.layers) {
    const id = next();
    out.push(polygonXml(id, nameOf('layer', id, layer.lines.join('')), layer.points.map(([x, y]) => ({x, y})), {fill: accent, fillOpacity: layer.opacity, stroke: accent, widthPx: 2.5}));
    layer.lines.forEach((line, i) => { const t = next(); out.push(textLineXml(t, nameOf('text', t, line), {text: line, x: layer.cx, y: layer.textYs[i] ?? 0, anchor: 'middle', size: ld.roles.title, bold: true, color: layer.textColor}, fonts)); });
  }
  return groupXml(next(), 'pyramid', b, out.join(''));
}

/** A timeline: the axis, ticks, stems and guides as lines, the span and bars as rectangles, dots as circles, every text a text box. */
export function timelineXml(b: LaidOutTimeline, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  const col = (k: 'text' | 'muted' | 'accent' | 'danger'): string => colorOf(k, ld.day), out: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number) => out.push(lineXml(next(), 'line', {x: x1, y: y1}, {x: x2, y: y2}, color, w));
  if (b.span?.fill) out.push(presetXml(next(), 'span', 'rect', {x: b.span.x1, y: b.span.y - 12, w: b.span.x2 - b.span.x1, h: 24}, {fill: b.span.tone === 'accent' ? PALETTE[ld.day].soft : PALETTE.border}));
  line(b.axis.x1, b.axis.y, b.axis.x2, b.axis.y, PALETTE.muted, 2);
  if (b.span && !b.span.fill) line(b.span.x1, b.span.y, b.span.x2, b.span.y, col(b.span.tone), 8);
  for (const g of b.guides ?? []) line(g.x1, g.y, g.x2, g.y, PALETTE.border, 1);
  for (const r of b.bars ?? []) out.push(presetXml(next(), 'bar', 'rect', r, {fill: col(r.tone), fillOpacity: .18, stroke: col(r.tone), widthPx: 2}));
  for (const d of b.dims ?? []) { line(d.x1, d.y, d.x2, d.y, col(d.tone), 2); line(d.x1, d.y - 5, d.x1, d.y + 5, col(d.tone), 2); line(d.x2, d.y - 5, d.x2, d.y + 5, col(d.tone), 2); }
  if (b.fullLine) line(b.fullLine.x, b.fullLine.y1, b.fullLine.x, b.fullLine.y2, col('danger'), 2);
  for (const t of b.ticks) line(t.x, t.y1, t.x, t.y2, PALETTE.muted, 2);
  for (const s of b.stems) line(s.x, s.y1, s.x, s.y2, col(s.tone), 2);
  for (const d of b.dots) out.push(presetXml(next(), 'dot', 'ellipse', {x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r}, {fill: col(d.tone), stroke: PALETTE.bg, widthPx: 4}));
  if (b.bracket) { const {x1, x2, y, tone} = b.bracket; out.push(freeformPathXml(next(), 'bracket', [{op: 'M', pts: [{x: x1, y: y - 4}]}, {op: 'L', pts: [{x: x1, y}]}, {op: 'L', pts: [{x: x2, y}]}, {op: 'L', pts: [{x: x2, y: y - 4}]}], col(tone), 2)); }
  for (const t of b.texts) { const id = next(); out.push(textLineXml(id, nameOf('text', id, t.text), {text: t.text, x: t.x, y: t.y, anchor: t.anchor, size: t.size, bold: !!t.bold, color: col(t.fill)}, fonts)); }
  return groupXml(next(), b.id ? `timeline-${b.id}` : 'timeline', b, out.join(''));
}
