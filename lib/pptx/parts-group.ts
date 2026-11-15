// The shapes of one part as a group (ADR 0054 D3). A shape carries the steps of its part (the `data-part` of the element it came from),
// outside in; the shapes of one part become a group, named after the part, nested as the steps are.
//
// The shapes of a part need not be drawn one after another (most figures draw all lines, then all boxes, then all texts). A group is written
// in one place, so gathering its shapes changes what is drawn over what. The place is chosen so that this never shows: at the part's last
// shape, else its first, else one between, wherever no moved shape crosses a shape outside the part that is drawn between its own place and
// the group's. When there is no such place, the shapes that cross are left out of the group, drawn where they were (and when a shape of
// the part would then move past one left out that it crosses, the part is not grouped at all).
//
// One exception is visible: parts of one kind (two series, two classes) may change places with each other. Where two series cross, or a
// line passes another series' marker, which is on top can differ from the svg; that is how PowerPoint's own charts draw their series, one
// after another, line and markers together (ADR 0054 D3).
import type {Pt} from './geom.ts';
import {groupXml} from './shapes.ts';
import {parsePart} from '../parts.ts';
import type {Rect} from './xml.ts';

/** Where a shape draws: an area (a box, a text, a filled outline), or a line of some width (an open or closed polyline). */
export type Geo = {kind: 'rect'; r: Rect} | {kind: 'poly'; pts: Pt[]; w: number; closed?: boolean};

/** A shape as written: its place in drawing order, its xml, its part's steps and where it draws. */
export interface Piece {order: number; xml: string; part: readonly string[]; geo: Geo; /** A text, or a shape holding one (a label on its plate): it keeps its order against every other part (ADR 0054 D9.1). */ text?: boolean}

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

const kindOf = (step: string): string => step.slice(0, step.indexOf(':'));
/** Kinds whose parts never change places with one another (D3's exception is for parts of data: series, rows, classes). */
const ORDERED_KINDS: ReadonlySet<string> = new Set(['axis', 'axes']);

/** A hidden scope on a part's next step (from the outer step it was left out of): kept in the key, never in the name. */
const SCOPE = '\u001f';
const scoped = (rest: readonly string[], outer: string): string[] => rest.length ? [`${rest[0]}${SCOPE}${outer}`, ...rest.slice(1)] : [];

/** The name of a part's group: its kind and label, and its DSL id when it has one (`class: 注文 [u1]`). */
export function partName(step: string): string {
  const s = parsePart(step.split(SCOPE)[0] as string)[0];
  if (!s) return step;
  const label = [...s.label].slice(0, 40).join('');
  return `${s.kind}${label ? `: ${label}` : ''}${s.key && !s.index ? ` [${s.key}]` : ''}`;
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
    // a part of the same kind (another series, another class) may change places with this one: one series drawn over another where they
    // cross is how a chart draws its series (one after another), so only the shapes of no such part keep their order against this one
    // (a text, or a shape holding one, keeps its order against every part: a label's plate is meant to cover the other series' lines)
    const kind = kindOf(k), mine = new Set(members), others = pieces.filter(p => !mine.has(p));
    // (axes are not data: a chart's x and y axes cross, and which is on top shows, so they keep their order against each other)
    const keeps = (p: Piece, q: Piece): boolean => q.part[depth] === undefined || kindOf(q.part[depth]) !== kind || ORDERED_KINDS.has(kind) || !!p.text || !!q.text;
    const clash = (anchor: number): Piece[] => members.filter(p => p.order !== anchor && others.some(q =>
      q.order > Math.min(p.order, anchor) && q.order < Math.max(p.order, anchor) && keeps(p, q) && crosses(p.geo, q.geo)));
    const orders = members.map(p => p.order), candidates = [orders[orders.length - 1] as number, orders[0] as number, ...orders.slice(1, -1)];
    const best = candidates.map(a => ({a, c: clash(a)})).reduce((u, v) => v.c.length < u.c.length ? v : u);
    // a shape left out stays where it was: a shape of its own part that moves past it must not cross it either, or there is no group
    const kept = members.filter(p => !best.c.includes(p));
    const passes = (l: Piece, m: Piece): boolean => m.order !== best.a && (m.order < l.order) !== (best.a < l.order) && crosses(l.geo, m.geo);
    const lost = best.c.length && best.c.some(l => kept.some(m => passes(l, m))) ? members : best.c;
    at.set(k, best.a);
    for (const p of lost) { out.add(p); left.push(p); }
  }
  // each part chose its place looking only at the shapes drawn between its own; two parts that move past each other (one written earlier,
  // one later) can still swap two shapes that cross. So the places are checked together: where two crossing shapes come out in the other
  // order, and D3 does not allow it, the one that moved farther is left out, and the level is assembled again
  if (!out.size) {
    const placed = (p: Piece): number => { const k = p.part[depth]; return k !== undefined && at.has(k) ? at.get(k) as number : p.order; };
    const before = (p: Piece, q: Piece): boolean => { const a = placed(p), b = placed(q); return a !== b ? a < b : p.order < q.order; };
    const swaps = (p: Piece, q: Piece): boolean => {
      const a = p.part[depth], b = q.part[depth];
      return !!a && !!b && kindOf(a) === kindOf(b) && !ORDERED_KINDS.has(kindOf(a)) && !p.text && !q.text;
    };
    const moved = pieces.filter(p => placed(p) !== p.order);
    for (const p of moved) {
      for (const q of pieces) {
        if (q === p || p.part[depth] === q.part[depth] || out.has(p) || out.has(q)) continue;
        if ((p.order < q.order) === before(p, q) || swaps(p, q) || !crosses(p.geo, q.geo)) continue;
        const l = Math.abs(placed(q) - q.order) > Math.abs(placed(p) - p.order) ? q : p;
        out.add(l); left.push(l);
      }
    }
  }
  // the pieces left out of a part are gathered again by their inner parts: a part that cannot be one group keeps the groups inside it
  // (ADR 0054 D9.1); the step left out is dropped from their path, and the level is assembled again (each round drops a step, so it ends)
  // (the inner step keeps the dropped step as a hidden scope, so the pieces of two outer parts never merge under one inner key)
  if (out.size) return assembleParts(pieces.map(p => out.has(p) ? {...p, part: [...p.part.slice(0, depth), ...scoped(p.part.slice(depth + 1), p.part[depth] as string)]} : p), next, depth, left);
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
