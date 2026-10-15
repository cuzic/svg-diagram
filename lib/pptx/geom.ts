// Fit a PowerPoint connector (prstGeom + xfrm + adj) to an orthogonal polyline, and evaluate one back.
// The evaluator follows ECMA-376 presetShapeDefinitions (bentConnector2..5, straightConnector1) and the DrawingML
// transform order (flip about the box centre, then rotate clockwise about the box centre).
import {EMU, emu, type Rect} from './xml.ts';

export interface Pt {x: number; y: number}

const MIN_EXT = 12700; // 1pt: the smallest ext a degenerate (zero-width) U shape gets

export interface ConnXfrm {
  prst: 'straightConnector1' | 'bentConnector2' | 'bentConnector3' | 'bentConnector4' | 'bentConnector5';
  /** EMU */
  offX: number; offY: number; extX: number; extY: number;
  rot: 0 | 5400000;
  flipH: boolean; flipV: boolean;
  /** 1/100000, in avLst order (adj1..adj3) */
  adj: number[];
}

const near = (a: number, b: number, eps = 0.01): boolean => Math.abs(a - b) <= eps;

/** Drop repeated points and the middle point of a straight run. */
export function simplify(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) if (!out.length || !near(p.x, out[out.length - 1]!.x) || !near(p.y, out[out.length - 1]!.y)) out.push(p);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!, b = out[i]!, c = out[i + 1]!;
      if ((near(a.x, b.x) && near(b.x, c.x)) || (near(a.y, b.y) && near(b.y, c.y))) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}

export type FitResult = {ok: true; x: ConnXfrm} | {ok: false; why: string};

export function fitConnector(raw: Pt[]): FitResult {
  const pts = simplify(raw);
  const n = pts.length - 1; // segments
  if (n < 1) return {ok: false, why: 'degenerate'};
  const p0 = pts[0]!, pn = pts[n]!;
  if (n === 1) {
    const dx = pn.x - p0.x, dy = pn.y - p0.y;
    const x: ConnXfrm = {prst: 'straightConnector1', offX: emu(Math.min(p0.x, pn.x)), offY: emu(Math.min(p0.y, pn.y)), extX: emu(Math.abs(dx)), extY: emu(Math.abs(dy)), rot: 0, flipH: dx < 0, flipV: dy < 0, adj: []};
    return {ok: true, x};
  }
  if (n > 5) return {ok: false, why: `${n} segments (max 5)`};
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (!near(a.x, b.x) && !near(a.y, b.y)) return {ok: false, why: 'diagonal segment'};
  }
  const firstHorizontal = near(pts[0]!.y, pts[1]!.y);
  const rot: 0 | 5400000 = firstHorizontal ? 0 : 5400000;
  // e_i: the points in the unflipped, unrotated local frame (clockwise rotation by `rot` undone), anchored at p0
  const e = pts.map(p => {
    const dx = p.x - p0.x, dy = p.y - p0.y;
    return rot === 0 ? {x: dx, y: dy} : {x: dy, y: -dx}; // undo a clockwise 90deg: (x,y) -> (y,-x)
  });
  const en = e[n]!;
  const flipH = en.x < -0.01, flipV = en.y < -0.01;
  const d = e.map(q => ({x: flipH ? -q.x : q.x, y: flipV ? -q.y : q.y}));
  // segments alternate local x, y, x, ...
  for (let i = 1; i <= n; i++) {
    const alongX = i % 2 === 1;
    const seg = {x: d[i]!.x - d[i - 1]!.x, y: d[i]!.y - d[i - 1]!.y};
    if (alongX ? !near(seg.y, 0) : !near(seg.x, 0)) return {ok: false, why: 'segments do not alternate'};
  }
  let W = emu(d[n]!.x), H = emu(d[n]!.y);
  if (W < MIN_EXT && n >= 3) W = MIN_EXT;
  if (H < MIN_EXT && n >= 4) H = MIN_EXT;
  const frac = (v: number, total: number): number => Math.round((emu(v) / total) * 100000);
  const adj: number[] = [];
  if (n === 3) adj.push(frac(d[1]!.x, W));
  if (n === 4) adj.push(frac(d[1]!.x, W), frac(d[2]!.y, H));
  if (n === 5) adj.push(frac(d[1]!.x, W), frac(d[2]!.y, H), frac(d[3]!.x, W));
  // centre such that local (0,0) -- after the flip -- lands on p0
  const l0 = {x: flipH ? W : 0, y: flipV ? H : 0};
  const v = {x: l0.x - W / 2, y: l0.y - H / 2};
  const rv = rot === 0 ? v : {x: -v.y, y: v.x}; // clockwise 90deg: (x,y) -> (-y,x)
  const cx = emu(p0.x) - rv.x, cy = emu(p0.y) - rv.y;
  const x: ConnXfrm = {prst: (['', '', 'bentConnector2', 'bentConnector3', 'bentConnector4', 'bentConnector5'] as const)[n] as ConnXfrm['prst'], offX: Math.round(cx - W / 2), offY: Math.round(cy - H / 2), extX: W, extY: H, rot, flipH, flipV, adj};
  return {ok: true, x};
}

/** The polyline (px) a connector draws, from its xfrm + preset. */
export function evalConnector(c: ConnXfrm): Pt[] {
  const W = c.extX, H = c.extY;
  const a = (i: number): number => (c.adj[i] ?? 50000) / 100000;
  let local: Pt[];
  switch (c.prst) {
    case 'straightConnector1': local = [{x: 0, y: 0}, {x: W, y: H}]; break;
    case 'bentConnector2': local = [{x: 0, y: 0}, {x: W, y: 0}, {x: W, y: H}]; break;
    case 'bentConnector3': { const x1 = W * a(0); local = [{x: 0, y: 0}, {x: x1, y: 0}, {x: x1, y: H}, {x: W, y: H}]; break; }
    case 'bentConnector4': { const x1 = W * a(0), y2 = H * a(1); local = [{x: 0, y: 0}, {x: x1, y: 0}, {x: x1, y: y2}, {x: W, y: y2}, {x: W, y: H}]; break; }
    case 'bentConnector5': { const x1 = W * a(0), y2 = H * a(1), x3 = W * a(2); local = [{x: 0, y: 0}, {x: x1, y: 0}, {x: x1, y: y2}, {x: x3, y: y2}, {x: x3, y: H}, {x: W, y: H}]; break; }
  }
  const cx = c.offX + W / 2, cy = c.offY + H / 2;
  return local.map(q => {
    const f = {x: c.flipH ? W - q.x : q.x, y: c.flipV ? H - q.y : q.y};
    const v = {x: f.x - W / 2, y: f.y - H / 2};
    const r = c.rot === 0 ? v : {x: -v.y, y: v.x};
    return {x: (cx + r.x) / EMU, y: (cy + r.y) / EMU};
  });
}

/** Largest distance between the two polylines, vertex by vertex (both simplified first); Infinity when the vertex counts differ. */
export function maxDeviation(a: Pt[], b: Pt[]): number {
  const sa = simplify(a), sb = simplify(b);
  if (sa.length !== sb.length) return Infinity;
  return Math.max(...sa.map((p, i) => Math.hypot(p.x - sb[i]!.x, p.y - sb[i]!.y)));
}

const SIDE_IDX = {top: 0, left: 1, bottom: 2, right: 3} as const;

/** The connection site (0 top, 1 left, 2 bottom, 3 right) of a rectangle a route end belongs to: the side named in the label (`"id:top"`), else the nearest. */
export function siteIndex(box: Rect, p: Pt, label: string): number {
  const side = /^[^:]+:(top|left|bottom|right)/.exec(label)?.[1] as keyof typeof SIDE_IDX | undefined;
  if (side !== undefined) return SIDE_IDX[side];
  const sites = [{x: box.x + box.w / 2, y: box.y}, {x: box.x, y: box.y + box.h / 2}, {x: box.x + box.w / 2, y: box.y + box.h}, {x: box.x + box.w, y: box.y + box.h / 2}];
  return sites.map((c, idx) => ({idx, dist: Math.hypot(c.x - p.x, c.y - p.y)})).sort((a, b) => a.dist - b.dist)[0]!.idx;
}
