// ADR 0078 spike: deterministic auto placement of overlay balloons over an existing figure (read from the SVG the library draws).
// Not part of lib/. Text rectangles are estimated from the SVG <text> (no measurer: CJK = 1em, other = 0.55em), which is enough to
// test the scoring; in lib/ they come from the layout. The balloon body is a rectangle here (the real outline is the ADR 0077 path).
import {balloonPath} from '../../lib/comic/balloon-path.ts';
import {clipArea, lengthIn, rectPoly, type Pt, type Rect} from './geom.ts';

export interface Scene {w: number; h: number; boxes: Rect[]; texts: Rect[]; lines: Pt[][]; svg: string}
const num = (s: string, k: string): number => Number(new RegExp(`${k}="([-\\d.]+)"`).exec(s)?.[1] ?? NaN);
const unesc = (s: string): string => s.replace(/&[a-z]+;/g, 'x');

export function sceneOf(svg: string): Scene {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!, w = Number(vb[1]), h = Number(vb[2]);
  const boxes: Rect[] = [], texts: Rect[] = [], lines: Pt[][] = [];
  for (const m of svg.matchAll(/<rect [^>]*>/g)) { const t = m[0], r = {x: num(t, 'x'), y: num(t, 'y'), w: num(t, 'width'), h: num(t, 'height')}; if (r.w >= w - 1 && r.h >= h - 1) continue; if (/stroke=/.test(t)) boxes.push(r); }
  for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = m[1]!, size = num(a, 'font-size') || 14, s = unesc(m[2]!);
    let tw = 0; for (const ch of s) tw += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.55;
    const x = num(a, 'x'), y = num(a, 'y'), anchor = /text-anchor="(\w+)"/.exec(a)?.[1] ?? 'start';
    texts.push({x: anchor === 'middle' ? x - tw / 2 : anchor === 'end' ? x - tw : x, y: y - size * 0.85, w: tw, h: size * 1.1});
  }
  for (const m of svg.matchAll(/<path d="([^"]*)"[^>]*fill="none"[^>]*>/g)) {
    const pts = [...m[1]!.matchAll(/[ML]\s*([-\d.]+)[, ]([-\d.]+)/g)].map(q => [Number(q[1]), Number(q[2])] as Pt); if (pts.length >= 2) lines.push(pts);
  }
  return {w, h, boxes, texts, lines, svg};
}

export interface Balloon {text: string; target: Rect; id: string}
export interface Cand {i: number; dir: string; d: number; body: Rect; tip: Pt; tri: Pt[]}
export interface Score {text: number; other: number; d: number; cross: number; i: number}
export const DIRS: [string, number, number][] = [['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0], ['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1]];
export const DISTS = [12, 28, 48];
const GAP = 4, snap = (n: number): number => Math.round(n / 4) * 4;
export const bodySize = (text: string): {w: number; h: number} => ({w: snap([...text].length * 15 + 24 + 3) , h: 36});

export function candidates(b: Balloon): Cand[] {
  const {w: bw, h: bh} = bodySize(b.text), T = b.target, out: Cand[] = []; let i = 0;
  for (const d of DISTS) for (const [dir, ux, uy] of DIRS) {
    const x = ux > 0 ? T.x + T.w + d : ux < 0 ? T.x - d - bw : T.x + T.w / 2 - bw / 2, y = uy > 0 ? T.y + T.h + d : uy < 0 ? T.y - d - bh : T.y + T.h / 2 - bh / 2;
    const body = {x: snap(x), y: snap(y), w: bw, h: bh}, cx = body.x + bw / 2, cy = body.y + bh / 2;
    const px = Math.min(Math.max(cx, T.x), T.x + T.w), py = Math.min(Math.max(cy, T.y), T.y + T.h), L = Math.hypot(cx - px, cy - py) || 1;
    const tip: Pt = [px + (cx - px) / L * GAP, py + (cy - py) / L * GAP];
    const bp = balloonPath(body, 'say', {tip, halfWidth: 8});
    out.push({i: i++, dir, d, body, tip, tri: bp.base ? [bp.base[0], tip, bp.base[1]] : []});
  }
  return out;
}

export interface Obstacles {texts: Rect[]; boxes: Rect[]; lines: Pt[][]; w: number; h: number}
const LINE_W = 12; // px² charged per px of connector covered (a 2px line + its 10px of clear space)
export function score(c: Cand, o: Obstacles): Score | undefined {
  const pts = [...rectPoly(c.body), c.tip];
  if (c.tri.length === 0 || pts.some(p => p[0] < 0 || p[1] < 0 || p[0] > o.w || p[1] > o.h)) return undefined; // balloon-out-of-bounds: not a candidate
  const bp = rectPoly(c.body);
  const cov = (r: Rect): number => clipArea(bp, rectPoly(r)) + clipArea(c.tri, rectPoly(r));
  const text = o.texts.reduce((s, r) => s + cov(r), 0);
  // the target itself is not "covered" by its own tail: only the body is charged for boxes, and a box the tail merely touches is free
  const other = o.boxes.reduce((s, r) => s + clipArea(bp, rectPoly(r)), 0) + LINE_W * o.lines.reduce((s, l) => s + lengthIn(l, c.body), 0);
  const cross = o.lines.filter(l => lengthIn(l, {x: Math.min(...c.tri.map(p => p[0])), y: Math.min(...c.tri.map(p => p[1])), w: 1e-6 + Math.max(...c.tri.map(p => p[0])) - Math.min(...c.tri.map(p => p[0])), h: 1e-6 + Math.max(...c.tri.map(p => p[1])) - Math.min(...c.tri.map(p => p[1]))}) > 0).length;
  return {text, other, d: c.d, cross, i: c.i};
}
/** Lexicographic: covered text (areas within `eps` px² are equal), covered other things, distance, tail crossings, the fixed order. */
export function best(cs: Cand[], o: Obstacles, eps: number): {c: Cand; s: Score} | undefined {
  let win: {c: Cand; s: Score} | undefined;
  for (const c of cs) {
    const s = score(c, o); if (!s) continue;
    if (!win) { win = {c, s}; continue; }
    const t = s.text - win.s.text; if (Math.abs(t) > eps ? t < 0 : (s.other !== win.s.other ? s.other < win.s.other : s.d !== win.s.d ? s.d < win.s.d : s.cross !== win.s.cross ? s.cross < win.s.cross : s.i < win.s.i)) win = {c, s};
  }
  return win;
}
/** Place balloons in declaration order; each placed balloon (its text and body) is an obstacle for the next. */
export function placeAll(sc: Scene, bs: Balloon[], eps: number): ({c: Cand; s: Score} | undefined)[] {
  const o: Obstacles = {texts: [...sc.texts], boxes: [...sc.boxes], lines: sc.lines, w: sc.w, h: sc.h}, res: ({c: Cand; s: Score} | undefined)[] = [];
  for (const b of bs) {
    const r = best(candidates(b), o, eps); res.push(r);
    if (r) { const bw = r.c.body; o.boxes.push(bw); o.texts.push({x: bw.x + 12, y: bw.y + 8, w: bw.w - 24, h: bw.h - 16}); }
  }
  return res;
}
