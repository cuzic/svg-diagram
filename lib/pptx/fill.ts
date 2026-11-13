// The texts a layout draws over its shapes, as the text of those shapes: a step's label in its chevron, a stage's in its funnel layer, a
// cell's caption in its cell. A text goes to the smallest shape whose outline holds its middle and whose box holds the whole line, when that
// shape lies inside every other one holding it (a label in the overlap of two Venn circles belongs to neither, and stays a text box). A shape
// keeps its texts only if boxTextXml can place every line at its anchor without wrapping it; otherwise they stay text boxes too.
import type {PathStep} from './connectors.ts';
import type {Pt} from './geom.ts';
import {boxTextWidth, boxTextXml, geomShapeXml, nameOf, outlineGeomXml, textLineXml, type Paint, type TextLine} from './prims.ts';
import type {Fonts, Rect} from './xml.ts';
import {assembleParts, type Geo, type Piece} from './parts-group.ts';

/** A shape that may take texts: its box, and whether a point is inside its outline. */
export interface Holder {rect: Rect; hit: (p: Pt) => boolean; texts: TextLine[]}

/** A line of text, and its width (px) when the layout measured it; `part`: the part it is grouped in (ADR 0054). */
export interface Placed {t: TextLine; w?: number; part?: string}

/** The width a line takes, estimated: a full-width character one size, any other a little over half. */
export const estimatedWidth = (t: TextLine): number => [...t.text].reduce((s, c) => s + ((c.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.55), 0) * t.size;

/** Whether p is inside the polygon (even-odd, so a notched chevron counts). */
export function inPolygon(p: Pt, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i] as Pt, b = pts[j] as Pt;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const holds = (o: Rect, r: Rect): boolean => r.x >= o.x - 0.5 && r.y >= o.y - 0.5 && r.x + r.w <= o.x + o.w + 0.5 && r.y + r.h <= o.y + o.h + 0.5;

/** Fills `holders[i].texts`; returns the texts no shape took, in their order. */
export function fillHolders(holders: readonly Holder[], texts: readonly Placed[]): TextLine[] {
  const taken = new Map<Holder, Placed[]>(), left: Placed[] = [];
  for (const p of texts) {
    const {t} = p, w = p.w ?? estimatedWidth(t);
    const x = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
    const span = {x, y: t.y - t.size * 0.8, w, h: t.size * 0.8}, mid = {x: x + w / 2, y: t.y - t.size * 0.35};
    const by = holders.filter(h => h.hit(mid) && holds({x: h.rect.x - 1, y: h.rect.y - 1, w: h.rect.w + 2, h: h.rect.h + 2}, span));
    const smallest = by.toSorted((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h)[0];
    if (smallest && by.every(h => holds(h.rect, smallest.rect))) taken.set(smallest, [...(taken.get(smallest) ?? []), p]);
    else left.push(p);
  }
  for (const [h, ps] of taken) {
    const lines = ps.map(p => p.t), room = boxTextWidth(h.rect, lines);
    if (room !== null && ps.every(p => (p.w ?? estimatedWidth(p.t)) <= room + 1)) h.texts = lines;
    else left.push(...ps);
  }
  const order = new Map(texts.map((p, i) => [p.t, i]));
  return left.map(p => p.t).toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/** A shape that may hold texts, drawn once its texts are known. */
export type Shape = Holder & {draw: (text?: string) => string};
export type Drawn = string | Shape;

export const bboxOf = (pts: readonly Pt[]): Rect => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys); return {x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y)}; };

/** A closed outline (its steps, and the corner points it is hit-tested by) as a shape that may hold texts. */
export function outlineHolder(id: number, name: (texts: readonly TextLine[]) => string, steps: readonly PathStep[], corners: readonly Pt[], paint: Paint): Shape {
  const rect = bboxOf(steps.flatMap(s => s.pts));
  const h: Shape = {rect, hit: p => inPolygon(p, corners), texts: [], draw: text => geomShapeXml(id, name(h.texts), rect, outlineGeomXml(steps, rect), paint, text)};
  return h;
}

/** A closed polygon as a shape that may hold texts. */
export function polygonHolder(id: number, name: (texts: readonly TextLine[]) => string, pts: readonly Pt[], paint: Paint): Shape {
  const steps: PathStep[] = [...pts.map((q, i) => ({op: i ? 'L' as const : 'M' as const, pts: [q]})), {op: 'Z', pts: []}];
  return outlineHolder(id, name, steps, pts, paint);
}

/** A shape of a given geometry over `rect` (a prstGeom, or a custGeom from roundGeomXml) that may hold texts. */
export function geomHolder(id: number, name: (texts: readonly TextLine[]) => string, rect: Rect, geom: string, paint: Paint, hit: (p: Pt) => boolean = () => true): Shape {
  const h: Shape = {rect, hit, texts: [], draw: text => geomShapeXml(id, name(h.texts), rect, geom, paint, text)};
  return h;
}

/** The texts joined top to bottom: a shape's name when it holds them. */
export const joined = (texts: readonly TextLine[]): string => texts.toSorted((a, b) => a.y - b.y).map(t => t.text).join('');

/** Draws the shapes in order, each holding the texts fillHolders gave it, then the texts no shape took as text boxes. */
export function drawAll(drawn: readonly Drawn[], texts: readonly Placed[], fonts: Fonts, next: () => number): string {
  const left = fillHolders(drawn.filter((d): d is Shape => typeof d !== 'string'), texts);
  return drawn.map(d => typeof d === 'string' ? d : d.draw(d.texts.length ? boxTextXml(d.rect, d.texts, fonts) : undefined)).join('')
    + left.map(t => { const id = next(); return textLineXml(id, nameOf('text', id, t.text), t, fonts); }).join('');
}

/** A shape drawn with drawParts: where it draws, and the part it is grouped in (ADR 0054). */
export interface PartDrawn {d: Drawn; geo: Geo; part?: string}

/** The text's area, estimated: what a part's group is sized by and what is checked for crossing. */
export const textGeo = (p: Placed): Geo => {
  const {t} = p, w = p.w ?? estimatedWidth(t), x = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
  return {kind: 'rect', r: {x, y: t.y - t.size * 0.8, w, h: t.size}};
};

/** drawAll, with the shapes and texts of one part gathered into a group (parts-group.ts). `holds`: whether a text may go into a shape (default: all may). */
export function drawParts(drawn: readonly PartDrawn[], texts: readonly Placed[], fonts: Fonts, next: () => number, o: {holds?: (p: Placed) => boolean} = {}): string {
  const may = o.holds ?? (() => true);
  const left = new Set([...fillHolders(drawn.flatMap(d => typeof d.d === 'string' ? [] : [d.d]), texts.filter(may)), ...texts.filter(p => !may(p)).map(p => p.t)]);
  const pieces: Piece[] = [];
  const add = (xml: string, geo: Geo, part?: string, text = false) => pieces.push({order: pieces.length, xml, geo, part: part ? part.split('/') : [], ...(text ? {text} : {})});
  for (const {d, geo, part} of drawn) add(typeof d === 'string' ? d : d.draw(d.texts.length ? boxTextXml(d.rect, d.texts, fonts) : undefined), geo, part, typeof d !== 'string' && d.texts.length > 0);
  for (const p of texts) if (left.has(p.t)) { const id = next(); add(textLineXml(id, nameOf('text', id, p.t.text), p.t, fonts), textGeo(p), p.part, true); }
  return assembleParts(pieces, next);
}
