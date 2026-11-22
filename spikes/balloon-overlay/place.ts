// ADR 0078 spike (round 2): deterministic auto placement of overlay balloons over an existing figure (read from the SVG the library draws).
// Not part of lib/. Text rectangles are ESTIMATED from the SVG <text> (no measurer: CJK = 1em, other = 0.55em); the real implementation takes them from
// a content inventory produced by the layout (ADR 0078 D3 / U0). The scene reads rect boxes, closed outlines (diamonds), circles, arrowheads and open
// connector paths from the SVG; anything else (chart marks, icons, images, badges) is NOT an obstacle here. The body is a rectangle.
import {balloonPath} from '../../lib/comic/balloon-path.ts';
import {clipArea, inflate, lengthInPoly, rectPoly, type Pt, type Rect} from './geom.ts';

export interface Scene {w: number; h: number; boxes: Rect[]; shapes: Pt[][]; heads: Pt[][]; texts: Rect[]; lines: Pt[][]; svg: string}
const num = (s: string, k: string): number => Number(new RegExp(`${k}="([-\\d.]+)"`).exec(s)?.[1] ?? NaN);
const unesc = (s: string): string => s.replace(/&[a-z]+;/g, 'x');
const pathPts = (d: string): Pt[] => [...d.matchAll(/[ML]\s*([-\d.]+)[, ]([-\d.]+)/g)].map(q => [Number(q[1]), Number(q[2])] as Pt);

export function sceneOf(svg: string): Scene {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!, w = Number(vb[1]), h = Number(vb[2]);
  const boxes: Rect[] = [], texts: Rect[] = [], lines: Pt[][] = [], shapes: Pt[][] = [], heads: Pt[][] = [];
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
    if (/fill="none"/.test(attrs)) lines.push(pts);
    else if (closed && !/stroke=/.test(attrs)) heads.push(pts);       // an arrowhead (filled, no stroke)
    else if (closed && /stroke=/.test(attrs) && pts.length >= 3) shapes.push(pts); // a diamond / polygon node (convex)
  }
  for (const m of svg.matchAll(/<(circle|ellipse)\s[^>]*>/g)) { const t = m[0], cx = num(t, 'cx'), cy = num(t, 'cy'), rx = num(t, m[1] === 'circle' ? 'r' : 'rx'), ry = num(t, m[1] === 'circle' ? 'r' : 'ry'); if (rx > 6) shapes.push(Array.from({length: 16}, (_, i) => [cx + rx * Math.cos(i * Math.PI / 8), cy + ry * Math.sin(i * Math.PI / 8)] as Pt)); }
  return {w, h, boxes, shapes, heads, texts, lines, svg};
}

export interface Anchor {side: 'top' | 'right' | 'bottom' | 'left'; at: number} // 0077 D3: `id.side@at`
export interface Balloon {text: string; target: Rect; id: string; anchor?: Anchor}
export interface Cand {i: number; dir: string; d: number; diag: boolean; angle: number; body: Rect; tip: Pt; tri: Pt[]}
export interface Score {content: number; ends: number; other: number; diag: number; d: number; cross: number; i: number}
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
    const bp = balloonPath(body, 'say', {tip, halfWidth: 8});
    const ang = bp.base ? tailAngle(bp.base, tip) : 0;
    out.push({i: i++, dir, d, diag: ux !== 0 && uy !== 0, angle: ang, body, tip, tri: bp.base ? [bp.base[0], tip, bp.base[1]] : []});
  }
  return out;
}

export interface Obstacles {texts: Rect[]; boxes: Rect[]; shapes: Pt[][]; heads: Pt[][]; lines: Pt[][]; w: number; h: number}
const LINE_W = 12; // px^2 charged per px of connector covered
/** The footprint = body + tail + the halo (3px, ADR 0078 D2 / D3): the polygons every coverage rule uses. */
export const footprint = (c: Cand): Pt[][] => [rectPoly({x: c.body.x - HALO, y: c.body.y - HALO, w: c.body.w + 2 * HALO, h: c.body.h + 2 * HALO}), inflate(c.tri, HALO)];
export function score(c: Cand, o: Obstacles): Score | undefined {
  const pts = [...rectPoly(c.body), c.tip];
  if (c.tri.length === 0 || pts.some(p => p[0] < 0 || p[1] < 0 || p[0] > o.w || p[1] > o.h)) return undefined;
  const fp = footprint(c), bodyOnly = rectPoly(c.body);
  const cov = (poly: Pt[]): number => fp.reduce((s, f) => s + clipArea(f, poly), 0);
  const content = o.texts.reduce((s, r) => s + cov(rectPoly(r)), 0) + o.shapes.reduce((s, p) => s + cov(p), 0);
  const ends = o.heads.filter(p => cov(p) > 0.5).length;
  const other = o.boxes.reduce((s, r) => s + clipArea(bodyOnly, rectPoly(r)), 0) + LINE_W * o.lines.reduce((s, l) => s + fp.reduce((t, f) => t + lengthInPoly(l, f), 0), 0);
  const cross = o.lines.filter(l => lengthInPoly(l, c.tri) > 0).length;
  return {content, ends, other, diag: c.diag ? 1 : 0, d: c.d, cross, i: c.i};
}
/** Lexicographic. Tiers 1 and 3 compare within `eps` px^2 (tier 3 too: a sub-pixel change in a box or line must not reorder). A tail leaving its edge at under MIN_ANGLE degrees is dropped unless nothing else is left. */
export function best(cs: Cand[], o: Obstacles, eps: number): {c: Cand; s: Score} | undefined {
  const sc = cs.map(c => ({c, s: score(c, o)})).filter((q): q is {c: Cand; s: Score} => !!q.s);
  const ok = sc.filter(q => q.c.angle >= MIN_ANGLE), pool = ok.length ? ok : sc;
  let win: {c: Cand; s: Score} | undefined;
  const less = (a: Score, b: Score): boolean => {
    if (Math.abs(a.content - b.content) > eps) return a.content < b.content;
    if (a.ends !== b.ends) return a.ends < b.ends;
    if (Math.abs(a.other - b.other) > eps * 4) return a.other < b.other;
    if (a.diag !== b.diag) return a.diag < b.diag;
    if (a.d !== b.d) return a.d < b.d;
    if (a.cross !== b.cross) return a.cross < b.cross;
    return a.i < b.i;
  };
  for (const q of pool) if (!win || less(q.s, win.s)) win = q;
  return win;
}
export function placeAll(sc: Scene, bs: Balloon[], eps: number): ({c: Cand; s: Score} | undefined)[] {
  const o: Obstacles = {texts: [...sc.texts], boxes: [...sc.boxes], shapes: sc.shapes, heads: sc.heads, lines: sc.lines, w: sc.w, h: sc.h}, res: ({c: Cand; s: Score} | undefined)[] = [];
  for (const b of bs) {
    const r = best(candidates(b), o, eps); res.push(r);
    if (r) { const bw = r.c.body; o.boxes.push(bw); o.texts.push({x: bw.x + 12, y: bw.y + 8, w: bw.w - 24, h: bw.h - 16}); }
  }
  return res;
}
