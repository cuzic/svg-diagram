// A quadrant band (2x2 matrix, SWOT, PPM, positioning map, risk grid) as native shapes: the cells as rectangles, free regions as filled
// freeforms, the crosshair as lines, each item as its marker (ellipse, square, diamond or triangle), arrows as arrow connectors. A caption
// is the text of the cell, region or chip it sits in (fill.ts); an item is its marker grouped with its label (a text box where the layout
// put it), so they move together; any other text is a text box too.
// A dimmed quadrant (spotlight) stays a picture.
import {PALETTE, colorOf, toneStyle, type ToneEnv} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutQuadrant, QuadrantShape} from '../quadrant.ts';
import {groupXml} from './shapes.ts';
import {drawAll, estimatedWidth, geomHolder, joined, polygonHolder, type Drawn} from './fill.ts';
import {lineXml, nameOf, presetXml, prstGeomXml, textLineXml, type Paint, type TextLine} from './prims.ts';
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
  const out: Drawn[] = [];
  const glue: QuadrantShapes['glue'] = [];
  for (const c of b.cells) {
    const id = next();
    out.push(geomHolder(id, texts => nameOf('cell', id, joined(texts)), {x: c.x, y: c.y, w: c.w, h: c.h}, b.crosshair ? prstGeomXml('rect') : prstGeomXml('roundRect', roundRectAdj(c)), areaPaint(tones, c.tone, ld.day)));
  }
  for (const r of b.regions) {
    const id = next();
    out.push(polygonHolder(id, texts => nameOf('region', id, joined(texts)), r.points.map(([x, y]) => ({x, y})), areaPaint(tones, r.tone, ld.day)));
  }
  for (const l of b.lines) { const id = next(); out.push(lineXml(id, nameOf('line', id), {x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}, PALETTE.muted, 2)); }
  for (const a of b.arrows) { const id = next(); out.push(lineXml(id, nameOf('arrow', id), {x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}, PALETTE.text, 2, {dashed: a.dashed, arrow: true})); }
  for (const c of b.chips) { const id = next(); out.push(geomHolder(id, texts => nameOf('chip', id, joined(texts)), {x: c.x, y: c.y, w: c.w, h: c.h}, prstGeomXml('roundRect', Math.min(c.w, c.h) > 0 ? 4 / Math.min(c.w, c.h) * 100000 : 0), {fill: PALETTE.bg})); }
  // a hollow marker is an outline inside the shape's area (groups 5 to 8); a filled one has a white edge
  const marker = (shape: QuadrantShape, x: number, y: number, r: number, color: string, hollow: boolean | undefined, ring: boolean, label?: string): {xml: string; id: number; rect: Rect} => {
    const id = next();
    const m = markerShape(shape, x, y, ring ? r : hollow ? r - 1.5 : r);
    const paint: Paint = ring ? {stroke: color, widthPx: 2} : hollow ? {fill: PALETTE.bg, stroke: color, widthPx: 3} : {fill: color, stroke: PALETTE.bg, widthPx: 1.5};
    return {xml: presetXml(id, nameOf('item', id, label), m.prst, m.rect, paint), id, rect: m.rect};
  };
  const items = b.bubbles.map(q => {
    const m = marker(q.shape, q.x, q.y, q.r, ink(q.tone, q.dim), q.hollow, false, q.label);
    if (q.id) glue.push({dslId: q.id, id: m.id, rect: m.rect});
    return m;
  });
  for (const m of b.marks) out.push(marker(m.shape, m.x, m.y, m.r, ink(m.tone, b.dim), m.hollow, m.ring).xml);
  // an item's label stays a text box beside its marker (it lies in a cell, but is not the cell's); captions go into their cells and regions
  const line = (t: LaidOutQuadrant['texts'][number]): TextLine => ({text: t.text, x: t.x, y: t.y, anchor: t.anchor, size: t.size, bold: t.bold, color: ink(t.fill, t.item !== undefined && b.bubbles[t.item]?.dim)});
  const body = drawAll(out, b.texts.filter(t => t.item === undefined).map(t => ({t: line(t)})), fonts, next);
  // an item is its marker and its label, grouped so they move together
  const labelled = items.map((m, i) => {
    const lines = b.texts.filter(t => t.item === i).map(line);
    if (!lines.length) return m.xml;
    const spans = lines.map(t => { const w = estimatedWidth(t); return {x: t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x, y: t.y - t.size, w, h: t.size * 1.2}; });
    const all = [m.rect, ...spans], x = Math.min(...all.map(r => r.x)), y = Math.min(...all.map(r => r.y));
    const rect = {x, y, w: Math.max(...all.map(r => r.x + r.w)) - x, h: Math.max(...all.map(r => r.y + r.h)) - y};
    const texts = lines.map(t => { const id = next(); return textLineXml(id, nameOf('text', id, t.text), t, fonts); }).join('');
    return groupXml(next(), nameOf('item', m.id, b.bubbles[i]?.label), rect, m.xml + texts);
  });
  return {xml: groupXml(next(), b.id ? `quadrant-${b.id}` : 'quadrant', b, body + labelled.join('')), glue};
}
