// What pert, causalLoop and dependencyNetwork share: the layered canvas, arrows, node boxes and the labels placed beside edges.
import type {Cand, ChartBox, ChartGeom, ChartOpts} from './charts-base.ts';
import {Canvas, checkIds, checkText, fail} from './charts-base.ts';
import {layoutWithLanes, routeLayered} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';

export type SemnetDirection = 'LR' | 'TB';
export interface SemnetOpts extends ChartOpts {direction?: SemnetDirection}
type Rect = ReturnType<Canvas['boxOf']>;
type Fill = Parameters<Canvas['place']>[2];
type PlaceOpts = NonNullable<Parameters<Canvas['place']>[3]>;

export const direction = (who: string, d: SemnetDirection | undefined): SemnetDirection => { if (d !== undefined && d !== 'LR' && d !== 'TB') fail(who, `direction must be LR or TB (got ${String(d)})`); return d ?? 'LR'; };
export const validateNodes = (who: string, nodes: readonly {id: string; label: string}[], bandId?: string): void => {
  if (!nodes.length) fail(who, 'needs at least one node');
  nodes.forEach((n, i) => { checkText(who, `nodes[${i}].id`, n.id); checkText(who, `node "${n.id}"'s label`, n.label); });
  checkIds(who, nodes.map(n => n.id), bandId);
};

const r = (n: number): number => Math.round(n * 10) / 10;
export function arrow(c: Canvas, points: Pt[], o: {stroke: 'accent' | 'danger' | 'muted' | 'text'; sw?: number; dash?: string; of?: string}, mark = true): void {
  for (let i = 1; i < points.length; i++) c.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, {...o, avoid: true});
  if (!mark || points.length < 2) return;
  const b = points.at(-1)!, a = points.at(-2)!, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux, z = 7 + (o.sw ?? 2);
  c.path(`M${r(b.x)},${r(b.y)} L${r(b.x - ux * z + px * z * .55)},${r(b.y - uy * z + py * z * .55)} L${r(b.x - ux * z - px * z * .55)},${r(b.y - uy * z - py * z * .55)} Z`, {fill: o.stroke, of: o.of});
}
/** The box an arrow head fills (the head is drawn as a path, which the canvas does not register). */
export const headBox = (p: Pt[], sw = 2): Rect => { const b = p.at(-1)!, z = 7 + sw + 2; return {x: b.x - z, y: b.y - z, w: 2 * z, h: 2 * z}; };
export const edgeMid = (p: Pt[]): Pt => { const i = Math.max(0, Math.floor((p.length - 1) / 2)); return {x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2}; };
export const pathOf = (paths: Map<number, Pt[]>, i: number, e: {from: string; to: string}, positions: Map<string, {x: number; y: number; w: number; h: number}>): Pt[] => {
  const routed = paths.get(i); if (routed) return routed;
  const n = positions.get(e.from)!; // self loop (routeLayered deliberately leaves these to the caller)
  return [{x: n.x + n.w, y: n.y + n.h * .7}, {x: n.x + n.w + 24, y: n.y + n.h * .7}, {x: n.x + n.w + 24, y: n.y - 18}, {x: n.x + n.w * .7, y: n.y - 18}, {x: n.x + n.w * .7, y: n.y}];
};

/** Draws the label at the first candidate whose plate (2px wider than the text each side) is free, and that `also` accepts. */
export function placePlated(c: Canvas, text: string, cands: Cand[], fill: Fill, o: PlaceOpts, also: (b: Rect) => boolean = () => true): ChartBox | undefined {
  for (const k of cands) {
    const b = c.boxOf(text, Math.round(k.x), Math.round(k.y), k.anchor, o.bold);
    if (c.free({x: b.x - 2, y: b.y, w: b.w + 4, h: b.h}, o.host ?? -1, 0, true) && also(b)) return c.text(text, k.x, k.y, k.anchor, fill, o);
  }
  return undefined;
}
/** Points along a polyline at fractions of its length, with the segment each lies on (horizontal or not) and how far it is from that segment's ends. */
const along = (p: Pt[], fracs: readonly number[]): {pt: Pt; horizontal: boolean; room: number}[] => {
  const lens = p.slice(1).map((b, i) => Math.hypot(b.x - p[i].x, b.y - p[i].y)), total = lens.reduce((a, b) => a + b, 0);
  return fracs.map(f => {
    let d = f * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const t = lens[i] ? d / lens[i] : 0;
    return {pt: {x: p[i].x + (p[i + 1].x - p[i].x) * t, y: p[i].y + (p[i + 1].y - p[i].y) * t}, horizontal: Math.abs(p[i + 1].y - p[i].y) < Math.abs(p[i + 1].x - p[i].x), room: Math.min(d, lens[i] - d)};
  });
};
const ON_EDGE = [.5, .45, .55, .4, .6, .35, .65, .3, .7, .25, .75, .2, .8];
/**
 * The second stage of an edge label: beside the edge when there is room; otherwise on the edge itself, from the middle outwards. A label on the
 * edge hides the line under its plate, so it is taken only where the line stays visible on both sides (6px of the same segment beyond the plate),
 * the plate stays off every box (a plate is wider than its text), and it keeps off every arrow head in `heads` (the heads are not registered
 * on the canvas, so `free()` cannot see them).
 */
export function placeEdgeLabel(c: Canvas, text: string, p: Pt[], besideAt: (m: Pt) => Cand[], fill: Fill, o: PlaceOpts, heads: readonly Rect[] = []): ChartBox | undefined {
  const clear = (b: Rect): boolean => !touchesAny(b, heads);
  // the usual spots beside the middle first (as before), then the same spots beside points further along the edge
  const near = placePlated(c, text, besideAt(edgeMid(p)), fill, o, clear) ?? placePlated(c, text, along(p, ON_EDGE).flatMap(a => besideAt(a.pt)), fill, o, clear);
  if (near) return near;
  const w = c.tw(text, o.bold), h = c.size + 4, cands: Cand[] = [], room = new Map<Cand, number>();
  for (const a of along(p, ON_EDGE)) { const k: Cand = {x: a.pt.x, y: c.mid(a.pt.y), anchor: 'middle'}; cands.push(k); room.set(k, a.room - ((a.horizontal ? w : h) / 2 + 2)); }
  for (const k of cands) {
    if ((room.get(k) ?? 0) < 6) continue;
    const put = placePlated(c, text, [k], fill, o, clear);
    if (put) return put;
  }
  return undefined;
}
const overlapsRect = (a: Rect, b: Rect): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
/** Does the box reach any of these (arrow heads, say)? */
export const touchesAny = (b: Rect, boxes: readonly Rect[]): boolean => boxes.some(h => overlapsRect(b, h));

export function networkCanvas(g: ChartGeom, nodes: {id: string; label: string; w: number; h: number}[], edges: {from: string; to: string}[], dir: SemnetDirection, legendH = 0): {c: Canvas; positions: Map<string, {x: number; y: number; w: number; h: number}>; paths: Map<number, Pt[]>} {
  // Orthogonal routing works in the layout's right-running axes; TB is that geometry transposed.
  const vertical = dir === 'TB';
  const lay = layoutWithLanes(nodes.map(n => ({id: n.id, size: vertical ? {w: n.h, h: n.w} : {w: n.w, h: n.h}})), edges, {dir: 'right', gap: 28, levelGap: 76});
  const naturalW = vertical ? lay.h : lay.w, naturalH = vertical ? lay.w : lay.h;
  const scale = Math.min(1, (g.w - 8) / Math.max(1, naturalW)), ox = g.x + (g.w - naturalW * scale) / 2, oy = g.y + 8;
  const place = (p: Pt): Pt => vertical ? {x: ox + p.y * scale, y: oy + p.x * scale} : {x: ox + p.x * scale, y: oy + p.y * scale};
  const positions = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const [id, p] of lay.nodes) positions.set(id, vertical ? {x: ox + p.y * scale, y: oy + p.x * scale, w: p.h * scale, h: p.w * scale} : {x: ox + p.x * scale, y: oy + p.y * scale, w: p.w * scale, h: p.h * scale});
  const paths = routeLayered(lay, place);
  const h = Math.max(g.height ?? 0, naturalH * scale + 16 + legendH), c = new Canvas(g.x, g.y, g.w, h, g.size, g.widthOf);
  for (const n of nodes) { const p = positions.get(n.id)!; c.solids.push({...p, id: n.id, label: `node "${n.label}"`}); }
  return {c, positions, paths};
}

export function nodeBox(c: Canvas, p: {x: number; y: number; w: number; h: number}, id: string, label: string, tone: 'accent' | 'danger' | 'muted' | 'text', critical = false): number {
  c.rect(p.x, p.y, p.w, p.h, {fill: critical ? 'accent' : 'bg', op: critical ? .16 : undefined, stroke: tone, sw: critical ? 4 : 2, id, of: id});
  return c.solids.findIndex(s => s.id === id);
}
