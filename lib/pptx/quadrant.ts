// A quadrant band (2x2 matrix, SWOT, PPM, positioning map, risk grid) as native shapes: the cells as rectangles, free regions as filled
// freeforms, the crosshair as lines, each item as its marker (ellipse, square, diamond or triangle), arrows as arrow connectors, and every
// label as a text box of its own at the place the layout gave it. A dimmed quadrant (spotlight) stays a picture.
import {PALETTE, colorOf, toneStyle, type ToneEnv} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutQuadrant, QuadrantShape} from '../quadrant.ts';
import {groupXml} from './shapes.ts';
import {lineXml, nameOf, polygonXml, presetXml, textLineXml, type Paint} from './prims.ts';
import {roundRectAdj, type Fonts, type Rect} from './xml.ts';

/** The colours the svg gives a cell or region of this tone. */
function areaPaint(tones: ToneEnv, tone: LaidOutQuadrant['cells'][number]['tone'], day: LaidOutDiagram['day']): Paint {
  const ts = toneStyle(tones, tone);
  const stroke = ts.stroke === null ? colorOf(ts.fill, day) : tone === 'plain' ? PALETTE.muted : colorOf(ts.stroke, day);
  return {fill: colorOf(ts.fill, day), stroke, widthPx: 2, dashed: ts.dashed};
}

/** A marker of area pi r^2 centred at (x, y), as the svg draws it: the preset and the box that holds it. */
export function markerShape(shape: QuadrantShape, x: number, y: number, r: number): {prst: string; rect: Rect} {
  if (shape === 'circle') return {prst: 'ellipse', rect: {x: x - r, y: y - r, w: 2 * r, h: 2 * r}};
  if (shape === 'square') { const s = r * Math.sqrt(Math.PI) / 2; return {prst: 'rect', rect: {x: x - s, y: y - s, w: 2 * s, h: 2 * s}}; }
  if (shape === 'diamond') { const s = r * Math.sqrt(Math.PI) / Math.SQRT2; return {prst: 'diamond', rect: {x: x - s, y: y - s, w: 2 * s, h: 2 * s}}; }
  const a = r * Math.sqrt(4 * Math.PI / Math.sqrt(3)), hh = a * Math.sqrt(3) / 2;
  return {prst: 'triangle', rect: {x: x - a / 2, y: y - hh * 2 / 3, w: a, h: hh}};
}

export interface QuadrantShapes {xml: string; glue: {dslId: string; id: number; rect: Rect}[]}

export function quadrantXml(b: LaidOutQuadrant, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): QuadrantShapes {
  const ink = (k: 'text' | 'muted' | 'accent' | 'danger', dim?: boolean): string => dim ? PALETTE.muted : colorOf(k, ld.day);
  const out: string[] = [];
  const glue: QuadrantShapes['glue'] = [];
  for (const c of b.cells) {
    const id = next();
    out.push(presetXml(id, nameOf('cell', id), b.crosshair ? 'rect' : 'roundRect', c, areaPaint(tones, c.tone, ld.day), b.crosshair ? undefined : roundRectAdj(c)));
  }
  for (const r of b.regions) {
    const id = next();
    out.push(polygonXml(id, nameOf('region', id), r.points.map(([x, y]) => ({x, y})), areaPaint(tones, r.tone, ld.day)));
  }
  for (const l of b.lines) { const id = next(); out.push(lineXml(id, nameOf('line', id), {x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}, PALETTE.muted, 2)); }
  for (const a of b.arrows) { const id = next(); out.push(lineXml(id, nameOf('arrow', id), {x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}, PALETTE.text, 2, {dashed: a.dashed, arrow: true})); }
  for (const c of b.chips) { const id = next(); out.push(presetXml(id, nameOf('chip', id), 'roundRect', c, {fill: PALETTE.bg}, Math.min(c.w, c.h) > 0 ? 4 / Math.min(c.w, c.h) * 100000 : 0)); }
  // a hollow marker is an outline inside the shape's area (groups 5 to 8); a filled one has a white edge
  const marker = (shape: QuadrantShape, x: number, y: number, r: number, color: string, hollow: boolean | undefined, ring: boolean, label?: string): {xml: string; id: number; rect: Rect} => {
    const id = next();
    const m = markerShape(shape, x, y, ring ? r : hollow ? r - 1.5 : r);
    const paint: Paint = ring ? {stroke: color, widthPx: 2} : hollow ? {fill: PALETTE.bg, stroke: color, widthPx: 3} : {fill: color, stroke: PALETTE.bg, widthPx: 1.5};
    return {xml: presetXml(id, nameOf('item', id, label), m.prst, m.rect, paint), id, rect: m.rect};
  };
  for (const q of b.bubbles) {
    const m = marker(q.shape, q.x, q.y, q.r, ink(q.tone, q.dim), q.hollow, false, q.label);
    out.push(m.xml);
    if (q.id) glue.push({dslId: q.id, id: m.id, rect: m.rect});
  }
  for (const m of b.marks) out.push(marker(m.shape, m.x, m.y, m.r, ink(m.tone, b.dim), m.hollow, m.ring).xml);
  for (const t of b.texts) {
    const dim = t.item !== undefined && b.bubbles[t.item]?.dim;
    const id = next();
    out.push(textLineXml(id, nameOf('text', id, t.text), {text: t.text, x: t.x, y: t.y, anchor: t.anchor, size: t.size, bold: t.bold, color: ink(t.fill, dim)}, fonts));
  }
  return {xml: groupXml(next(), b.id ? `quadrant-${b.id}` : 'quadrant', b, out.join('')), glue};
}
