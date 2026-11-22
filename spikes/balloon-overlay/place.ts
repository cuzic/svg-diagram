// ADR 0078 spike (round 2): deterministic auto placement of overlay balloons over an existing figure (read from the SVG the library draws).
// Not part of lib/. Text rectangles are ESTIMATED from the SVG <text> (no measurer: CJK = 1em, other = 0.55em); the real implementation takes them from
// a content inventory produced by the layout (ADR 0078 D3 / U0). The scene reads rect boxes, closed outlines (diamonds), circles, arrowheads and open
// connector paths from the SVG; anything else (chart marks, icons, images, badges) is NOT an obstacle here. The body is a rectangle.
import {balloonPath} from '../../lib/comic/balloon-path.ts';
import {clipArea, inflate, lengthInPoly, rectPoly, type Pt, type Rect} from './geom.ts';

export interface Scene {w: number; h: number; boxes: Rect[]; shapes: Pt[][]; heads: Pt[][]; texts: Rect[]; lines: Pt[][]; dividers: Pt[][]; svg: string}
const num = (s: string, k: string): number => Number(new RegExp(`${k}="([-\\d.]+)"`).exec(s)?.[1] ?? NaN);
const unesc = (s: string): string => s.replace(/&[a-z]+;/g, 'x');
/** The points of an M / L / H / V path (absolute commands only; the library writes those). */
const pathPts = (d: string): Pt[] => {
  const out: Pt[] = []; let x = 0, y = 0;
  for (const m of d.matchAll(/([MLHV])\s*([-\d.]+)(?:[, ]([-\d.]+))?/g)) {
    const c = m[1]!, a = Number(m[2]), b = Number(m[3]);
    if (c === 'M' || c === 'L') { x = a; y = b; } else if (c === 'H') x = a; else y = a;
    out.push([x, y]);
  }
  return out;
};

export function sceneOf(svg: string): Scene {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!, w = Number(vb[1]), h = Number(vb[2]);
  const boxes: Rect[] = [], texts: Rect[] = [], lines: Pt[][] = [], dividers: Pt[][] = [], shapes: Pt[][] = [], heads: Pt[][] = [];
  for (const m of svg.matchAll(/<rect [^>]*>/g)) { const t = m[0], r = {x: num(t, 'x'), y: num(t, 'y'), w: num(t, 'width'), h: num(t, 'height')}; if (r.w >= w - 1 && r.h >= h - 1) continue; if (/stroke=/.test(t)) boxes.push(r); }
  for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = m[1]!, size = num(a, 'font-size') || 14, s = unesc(m[2]!);
    let tw = 0; for (const ch of s) tw += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.55;
    const x = num(a, 'x'), y = num(a, 'y'), anchor = /text-anchor="(\w+)"/.exec(a)?.[1] ?? 'start';
    texts.push({x: anchor === 'middle' ? x - tw / 2 : anchor === 'end' ? x - tw : x, y: y - size * 0.85, w: tw, h: size * 1.1});
  }
  for (const m of svg.matchAll(/<path d="([^"]*)"([^>]*)>/g)) {
    const pts = pathPts(m[1]!), closed = /[zZ]\s*$/.test(m[1]!), attrs = m[2]!;
    if (pts.length < 2) continue;
    if (/fill="none"/.test(attrs)) lines.push(pts);                                          // a connector: D3's link rules (arrowheads, legs 50% / 40px)
    else if (!closed && /stroke=/.test(attrs) && !/fill=/.test(attrs)) dividers.push(pts);     // a line drawn by a band (lane divider, visibility line): connector-like for the soft cost and the advice, never a problem
    else if (closed && !/stroke=/.test(attrs)) { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); if (Math.max(...xs) - Math.min(...xs) <= 16 && Math.max(...ys) - Math.min(...ys) <= 16) heads.push(pts); } // an arrowhead (small, filled, no stroke); a big filled shape is a background, not an arrowhead
    else if (closed && /stroke=/.test(attrs) && pts.length >= 3) shapes.push(pts); // a diamond / polygon node (convex)
  }
  for (const m of svg.matchAll(/<(circle|ellipse)\s[^>]*>/g)) { const t = m[0], cx = num(t, 'cx'), cy = num(t, 'cy'), rx = num(t, m[1] === 'circle' ? 'r' : 'rx'), ry = num(t, m[1] === 'circle' ? 'r' : 'ry'); if (rx > 6) shapes.push(Array.from({length: 16}, (_, i) => [cx + rx * Math.cos(i * Math.PI / 8), cy + ry * Math.sin(i * Math.PI / 8)] as Pt)); }
  return {w, h, boxes, shapes, heads, texts, lines, dividers, svg};
}

export interface Anchor {side: 'top' | 'right' | 'bottom' | 'left'; at: number} // 0077 D3: `id.side@at`
export interface Balloon {text: string; target: Rect; id: string; anchor?: Anchor}
export interface Cand {i: number; dir: string; d: number; diag: boolean; angle: number; body: Rect; tip: Pt; tri: Pt[]}
export interface Score {content: number; links: number; ends: number; legs: number; legsExact: number; other: number; flat: number; diag: number; d: number; cross: number; i: number}
export const DIRS: [string, number, number][] = [['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0], ['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1]];
export const DISTS = [12, 28, 48];
export const GAP = 4, HALO = 3, MIN_ANGLE = 30, CORNER = 8;
const snap = (n: number): number => Math.round(n / 4) * 4;
export const bodySize = (text: string): {w: number; h: number} => ({w: snap([...text].length * 15 + 24 + 3), h: 36});

/** The tip: the author's anchor point (0077 D3: anchor + outward normal * gap) when `@at` is written; else on the side the body faces, at least CORNER px from a corner. */
function tipOf(T: Rect, body: Rect, anchor?: Anchor): Pt {
  if (anchor) {
    const {side, at} = anchor;
    return side === 'top' ? [T.x + T.w * at, T.y - GAP] : side === 'bottom' ? [T.x + T.w * at, T.y + T.h + GAP] : side === 'left' ? [T.x - GAP, T.y + T.h * at] : [T.x + T.w + GAP, T.y + T.h * at];
  }
  const cx = body.x + body.w / 2, cy = body.y + body.h / 2, dx = (cx - (T.x + T.w / 2)) / (T.w / 2), dy = (cy - (T.y + T.h / 2)) / (T.h / 2);
  const mx = Math.min(CORNER, T.w / 2), my = Math.min(CORNER, T.h / 2), cl = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  if (Math.abs(dx) >= Math.abs(dy)) return [dx > 0 ? T.x + T.w + GAP : T.x - GAP, cl(cy, T.y + my, T.y + T.h - my)];
  return [cl(cx, T.x + mx, T.x + T.w - mx), dy > 0 ? T.y + T.h + GAP : T.y - GAP];
}
/** The angle (degrees) between the tail's axis (middle of the base -> tip) and the edge of the body it leaves. */
const tailAngle = (base: [Pt, Pt], tip: Pt): number => { const ex = base[1][0] - base[0][0], ey = base[1][1] - base[0][1], mx = (base[0][0] + base[1][0]) / 2, my = (base[0][1] + base[1][1]) / 2; const vx = tip[0] - mx, vy = tip[1] - my; const a = Math.abs(Math.atan2(ex * vy - ey * vx, ex * vx + ey * vy)) * 180 / Math.PI; return a > 90 ? 180 - a : a; };

export function candidates(b: Balloon, dists = DISTS): Cand[] {
  const {w: bw, h: bh} = bodySize(b.text), T = b.target, out: Cand[] = []; let i = 0;
  for (const d of dists) for (const [dir, ux, uy] of DIRS) {
    const x = ux > 0 ? T.x + T.w + d : ux < 0 ? T.x - d - bw : T.x + T.w / 2 - bw / 2, y = uy > 0 ? T.y + T.h + d : uy < 0 ? T.y - d - bh : T.y + T.h / 2 - bh / 2;
    const body = {x: snap(x), y: snap(y), w: bw, h: bh}, tip = tipOf(T, body, b.anchor);
    const bp = balloonPath(body, 'shout', {tip, halfWidth: 8});
    const ang = bp.base ? tailAngle(bp.base, tip) : 0;
    out.push({i: i++, dir, d, diag: ux !== 0 && uy !== 0, angle: ang, body, tip, tri: bp.base ? [bp.base[0], tip, bp.base[1]] : []});
  }
  return out;
}

export interface Obstacles {texts: Rect[]; boxes: Rect[]; shapes: Pt[][]; heads: Pt[][]; lines: Pt[][]; dividers: Pt[][]; w: number; h: number}
const LINE_W = 12; // px^2 charged per px of connector covered
/** The footprint = body + tail + the halo (3px, ADR 0078 D2 / D3): the polygons every coverage rule uses. */
export const footprint = (c: Cand): Pt[][] => [rectPoly({x: c.body.x - HALO, y: c.body.y - HALO, w: c.body.w + 2 * HALO, h: c.body.h + 2 * HALO}), inflate(c.tri, HALO)];
/** The placement keeps a margin below D3's thresholds (0.5px of length, 1px of the 40px) so that it never lands on the cliff; the checks (and `problemsOf`) use the exact thresholds. */
const LEG_MARGIN = 0.5;
const LEG_FRAC = 0.5, LEG_PX = 40; // D3: a connector leg hidden by >= 50% of its length, or >= 40px, is a problem
/** The length of one segment inside the footprint (the pieces summed, capped at the segment: a point in both the body halo and the tail halo counts once). */
const hiddenLen = (a: Pt, b: Pt, fp: Pt[][]): number => Math.min(Math.hypot(b[0] - a[0], b[1] - a[1]), fp.reduce((t, f) => t + lengthInPoly([a, b], f), 0));
export function score(c: Cand, o: Obstacles): Score | undefined {
  const pts = [...rectPoly(c.body), c.tip];
  if (c.tri.length === 0 || pts.some(p => p[0] < 0 || p[1] < 0 || p[0] > o.w || p[1] > o.h)) return undefined;
  const fp = footprint(c), bodyOnly = rectPoly(c.body);
  const cov = (poly: Pt[]): number => fp.reduce((s, f) => s + clipArea(f, poly), 0);
  const content = o.texts.reduce((s, r) => s + cov(rectPoly(r)), 0) + o.shapes.reduce((s, p) => s + cov(p), 0);
  const ends = o.heads.filter(p => cov(p) > 0.5).length;
  let legs = 0, legsExact = 0, conn = 0;
  for (const l of o.lines) for (let k = 0; k + 1 < l.length; k++) { const L = Math.hypot(l[k + 1]![0] - l[k]![0], l[k + 1]![1] - l[k]![1]), h = hiddenLen(l[k]!, l[k + 1]!, fp); conn += h; if (L > 0 && (h >= LEG_FRAC * L - LEG_MARGIN || h >= LEG_PX - LEG_MARGIN * 2)) legs++; if (L > 0 && (h >= LEG_FRAC * L || h >= LEG_PX)) legsExact++; }
  for (const l of o.dividers) for (let k = 0; k + 1 < l.length; k++) conn += hiddenLen(l[k]!, l[k + 1]!, fp); // dividers: the soft cost only
  const other = o.boxes.reduce((s, r) => s + clipArea(bodyOnly, rectPoly(r)), 0) + LINE_W * conn;
  const cross = o.lines.filter(l => lengthInPoly(l, c.tri) > 0).length;
  return {content, links: ends + legs, ends, legs, legsExact, other, flat: c.angle < MIN_ANGLE ? 1 : 0, diag: c.diag ? 1 : 0, d: c.d, cross, i: c.i};
}
/** D3's own problem rules applied to a footprint: what the checks of U3 would report (content area > 0.5px^2, a hidden arrowhead, a hidden connector leg). Chart marks are not in the spike's scene. */
export const problemsOf = (s: Score): {content: boolean; ends: number; legs: number; any: boolean} => ({content: s.content > 0.5, ends: s.ends, legs: s.legsExact, any: s.content > 0.5 || s.ends > 0 || s.legsExact > 0});
/** Lexicographic; every D3 problem has a tier of its own ahead of anything soft (the 30-degree tail rule is a tier after them, not a filter). Areas / lengths within `eps` are equal. */
export function best(cs: Cand[], o: Obstacles, eps: number): {c: Cand; s: Score} | undefined {
  const pool = cs.map(c => ({c, s: score(c, o)})).filter((q): q is {c: Cand; s: Score} => !!q.s);
  let win: {c: Cand; s: Score} | undefined;
  const less = (a: Score, b: Score): boolean => {
    if (Math.abs(a.content - b.content) > eps) return a.content < b.content;       // 1 content (text, shapes, marks)
    if (a.links !== b.links) return a.links < b.links;                             // 2 other D3 problems: arrowheads, tips, hidden legs
    if (Math.abs(a.other - b.other) > eps * 4) return a.other < b.other;          // 3 soft: box fill + connector length
    if (a.flat !== b.flat) return a.flat < b.flat;                                 // 4 a tail under 30 degrees to its edge
    if (a.diag !== b.diag) return a.diag < b.diag;                                 // 5 diagonal after orthogonal
    if (a.d !== b.d) return a.d < b.d;                                             // 6 distance
    if (a.cross !== b.cross) return a.cross < b.cross;                             // 7 connectors crossing the tail
    return a.i < b.i;                                                              // 8 fixed order
  };
  for (const q of pool) if (!win || less(q.s, win.s)) win = q;
  return win;
}
export function placeAll(sc: Scene, bs: Balloon[], eps: number): ({c: Cand; s: Score} | undefined)[] {
  const o: Obstacles = {texts: [...sc.texts], boxes: [...sc.boxes], shapes: sc.shapes, heads: sc.heads, lines: sc.lines, dividers: sc.dividers, w: sc.w, h: sc.h}, res: ({c: Cand; s: Score} | undefined)[] = [];
  for (const b of bs) {
    const r = best(candidates(b), o, eps); res.push(r);
    if (r) { const bw = r.c.body; o.boxes.push(bw); o.texts.push({x: bw.x + 12, y: bw.y + 8, w: bw.w - 24, h: bw.h - 16}); }
  }
  return res;
}
