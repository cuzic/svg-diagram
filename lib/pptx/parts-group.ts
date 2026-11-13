// The shapes of one part as a group (ADR 0054 D3). A shape carries the steps of its part (the `data-part` of the element it came from),
// outside in; the shapes of one part become a group, named after the part, nested as the steps are.
//
// The shapes of a part need not be drawn one after another (most figures draw all lines, then all boxes, then all texts). A group is written
// in one place, so gathering its shapes changes what is drawn over what. The place is chosen so that this never shows: at the part's last
// shape, else its first, else one between, wherever no moved shape crosses a shape outside the part that is drawn between its own place and
// the group's. When there is no such place, the shapes that cross are left out of the group, drawn where they were.
import type {Pt} from './geom.ts';
import {groupXml} from './shapes.ts';
import {parsePart} from '../parts.ts';
import type {Rect} from './xml.ts';

/** Where a shape draws: an area (a box, a text, a filled outline), or a line of some width (an open or closed polyline). */
export type Geo = {kind: 'rect'; r: Rect} | {kind: 'poly'; pts: Pt[]; w: number; closed?: boolean};

/** A shape as written: its place in drawing order, its xml, its part's steps and where it draws. */
export interface Piece {order: number; xml: string; part: readonly string[]; geo: Geo}

/** Contact this small (px) is not crossing: shapes that touch at a corner or share an edge's antialiasing. */
const SLACK = 0.5;

const boxOf = (g: Geo): Rect => {
  if (g.kind === 'rect') return g.r;
  const xs = g.pts.map(p => p.x), ys = g.pts.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return {x: x - g.w / 2, y: y - g.w / 2, w: Math.max(...xs) - x + g.w, h: Math.max(...ys) - y + g.w};
};
const segsOf = (g: Extract<Geo, {kind: 'poly'}>): [Pt, Pt][] => {
  const s: [Pt, Pt][] = g.pts.slice(1).map((p, i) => [g.pts[i] as Pt, p]);
  if (g.closed && g.pts.length > 2) s.push([g.pts[g.pts.length - 1] as Pt, g.pts[0] as Pt]);
  return s;
};
const distPtSeg = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const segsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
const distSegSeg = (a: Pt, b: Pt, c: Pt, d: Pt): number => segsCross(a, b, c, d) ? 0 : Math.min(distPtSeg(a, c, d), distPtSeg(b, c, d), distPtSeg(c, a, b), distPtSeg(d, a, b));
/** Whether the segment a-b comes within `m` of the rectangle (Liang-Barsky against the rectangle grown by m). */
function segNearRect(a: Pt, b: Pt, r: Rect, m: number): boolean {
  const x0 = r.x - m, y0 = r.y - m, x1 = r.x + r.w + m, y1 = r.y + r.h + m, dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as const) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

/** Whether two shapes overlap by more than SLACK (so the order they are drawn in can show). */
export function crosses(g: Geo, h: Geo): boolean {
  const a = boxOf(g), b = boxOf(h);
  if (a.x >= b.x + b.w - SLACK || b.x >= a.x + a.w - SLACK || a.y >= b.y + b.h - SLACK || b.y >= a.y + a.h - SLACK) return false;
  if (g.kind === 'rect' && h.kind === 'rect') return true;
  if (g.kind === 'poly' && h.kind === 'poly') return segsOf(g).some(([p, q]) => segsOf(h).some(([u, v]) => distSegSeg(p, q, u, v) < (g.w + h.w) / 2 - SLACK));
  const [line, area] = g.kind === 'poly' ? [g, h as Extract<Geo, {kind: 'rect'}>] : [h as Extract<Geo, {kind: 'poly'}>, g];
  return segsOf(line).some(([p, q]) => segNearRect(p, q, area.r, line.w / 2 - SLACK));
}

/** The name of a part's group: its kind and label, and its DSL id when it has one (`class: 注文 [u1]`). */
export function partName(step: string): string {
  const s = parsePart(step)[0];
  if (!s) return step;
  const label = [...s.label].slice(0, 40).join('');
  return `${s.kind}${label ? `: ${label}` : ''}${s.key && !s.key.startsWith('#') ? ` [${s.key}]` : ''}`;
}

/** The shape's xml with another name (a part of one shape is that shape, named as the part). */
const renamed = (xml: string, name: string): string => xml.replace(/ name="[^"]*"/, ` name="${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"`);

/** The rectangle around shapes (at least 1 EMU wide and high, so a group of collinear lines has an extent). */
function around(ps: readonly Piece[]): Rect {
  const bs = ps.map(p => boxOf(p.geo)), x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  return {x, y, w: Math.max(1 / 9525, Math.max(...bs.map(b => b.x + b.w)) - x), h: Math.max(1 / 9525, Math.max(...bs.map(b => b.y + b.h)) - y)};
}

/** The pieces as xml in drawing order, the pieces of each part (at `depth`) gathered into a group. Also reports the pieces left out. */
export function assembleParts(pieces: readonly Piece[], next: () => number, depth = 0, left: Piece[] = []): string {
  const groups = new Map<string, Piece[]>();
  for (const p of pieces) { const k = p.part[depth]; if (k !== undefined) groups.set(k, [...(groups.get(k) ?? []), p]); }
  /** Where each group is written (the order of one of its pieces), and the pieces that stay out. */
  const at = new Map<string, number>(), out = new Set<Piece>();
  for (const [k, members] of groups) {
    if (members.length < 2) continue;
    const mine = new Set(members), others = pieces.filter(p => !mine.has(p));
    const clash = (anchor: number): Piece[] => members.filter(p => p.order !== anchor && others.some(q =>
      q.order > Math.min(p.order, anchor) && q.order < Math.max(p.order, anchor) && crosses(p.geo, q.geo)));
    const orders = members.map(p => p.order), candidates = [orders[orders.length - 1] as number, orders[0] as number, ...orders.slice(1, -1)];
    const best = candidates.map(a => ({a, c: clash(a)})).reduce((u, v) => v.c.length < u.c.length ? v : u);
    at.set(k, best.a);
    for (const p of best.c) { out.add(p); left.push(p); }
  }
  const xml: string[] = [];
  for (const p of pieces) {
    const k = p.part[depth];
    const members = k === undefined || out.has(p) ? undefined : (groups.get(k) ?? []).filter(m => !out.has(m));
    if (!members || members.length < 2 || k === undefined) {
      // a part of one shape: that shape, named as the part when it is the innermost one
      xml.push(members && k !== undefined && p.part.length === depth + 1 ? renamed(p.xml, partName(k)) : members && k !== undefined ? assembleParts([p], next, depth + 1, left) : p.xml);
      continue;
    }
    if (at.get(k) !== p.order) continue;
    xml.push(groupXml(next(), partName(k), around(members), assembleParts(members, next, depth + 1, left)));
  }
  return xml.join('');
}
