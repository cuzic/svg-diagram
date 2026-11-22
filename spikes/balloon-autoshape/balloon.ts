// Spike for ADR 0077: one pure outline generator (balloon body + tail as one outline). No imports; numbers in, a path string out.
export type Pt = readonly [number, number];
export interface Rect {x: number; y: number; w: number; h: number}
export type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud';
export interface BalloonOpts {
  /** Corner radius of 'round'. Default min(w,h)/6 (Office: adj3 16667 of ss). */
  radius?: number;
  /** 'follow': the base slides along the side under the tip. 'office': the base is the Office preset's (2/12..5/12 or 7/12..10/12 of the side). */
  baseMode?: 'follow' | 'office';
  /** Base width on a side (follow mode). Default clamp(side/4, 12, 28). */
  baseWidth?: number;
}
export interface Balloon {
  d: string;
  /** The two points where the tail leaves the body outline (cloud: the point of the outline the trail starts from, twice). */
  base: [Pt, Pt];
  tip: Pt;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** cloud: the trail of circles, body side first. */
  dots?: {c: Pt; r: number}[];
  /** Distance from the tip to the middle of the base. */
  length: number;
  /** The tip is inside the body outline (no tail can be drawn). */
  inside: boolean;
}

const f = (n: number): string => String(Math.round(n * 100) / 100);
const P = (p: Pt): string => `${f(p[0])} ${f(p[1])}`;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const DELTA = 11 * Math.PI / 180; // Office wedgeEllipseCallout: the base spans +-11 degrees of the ellipse parameter

export function balloon(shape: BalloonShape, b: Rect, tip: Pt, o: BalloonOpts = {}): Balloon {
  return shape === 'ellipse' ? ellipse(b, tip) : shape === 'cloud' ? cloud(b, tip) : wedgeRect(shape === 'round', b, tip, o);
}

function wedgeRect(round: boolean, b: Rect, tip: Pt, o: BalloonOpts): Balloon {
  const {x, y, w, h} = b, cx = x + w / 2, cy = y + h / 2, dx = tip[0] - cx, dy = tip[1] - cy;
  const r = round ? Math.min(o.radius ?? Math.min(w, h) / 6, w / 2, h / 2) : 0;
  const inside = Math.abs(dx) < w / 2 && Math.abs(dy) < h / 2;
  const vertical = Math.abs(dy) > Math.abs(dx * h / w); // Office: dz > 0
  const side = vertical ? (dy < 0 ? 'top' : 'bottom') : (dx < 0 ? 'left' : 'right');
  const si = SIDES.indexOf(side), L = vertical ? w : h;
  // position along the side, clockwise from the side's start corner
  const pt = (s: number, a: number): Pt => s === 0 ? [x + a, y] : s === 1 ? [x + w, y + a] : s === 2 ? [x + w - a, y + h] : [x, y + h - a];
  const along = (s: number, p: Pt): number => s === 0 ? p[0] - x : s === 1 ? p[1] - y : s === 2 ? x + w - p[0] : y + h - p[1];
  let a0: number, a1: number;
  if (o.baseMode === 'office') {
    const pos = vertical ? dx : dy, abs0 = (pos > 0 ? 7 : 2) / 12 * L, abs1 = (pos > 0 ? 10 : 5) / 12 * L;
    const c0 = si >= 2 ? L - abs0 : abs0, c1 = si >= 2 ? L - abs1 : abs1;
    a0 = Math.min(c0, c1); a1 = Math.max(c0, c1);
  } else {
    const clear = r + 4, room = Math.max(L - 2 * clear, 2), bw = Math.min(o.baseWidth ?? Math.min(Math.max(L / 4, 12), 28), room);
    const mid = Math.min(Math.max(along(si, tip), clear + bw / 2), L - clear - bw / 2);
    a0 = mid - bw / 2; a1 = mid + bw / 2;
  }
  const seg: string[] = [`M${P(pt(0, r))}`];
  for (let s = 0; s < 4; s++) {
    const len = s % 2 === 0 ? w : h;
    if (s === si) seg.push(`L${P(pt(s, a0))}`, `L${P(tip)}`, `L${P(pt(s, a1))}`);
    seg.push(`L${P(pt(s, len - r))}`);
    if (r > 0) seg.push(`A${f(r)} ${f(r)} 0 0 1 ${P(pt((s + 1) % 4, r))}`);
  }
  seg.push('Z');
  const base: [Pt, Pt] = [pt(si, a0), pt(si, a1)];
  const mid: Pt = [(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2];
  return {d: seg.join(''), base, tip, side, length: Math.hypot(tip[0] - mid[0], tip[1] - mid[1]), inside};
}

function ellipse(b: Rect, tip: Pt): Balloon {
  const a = b.w / 2, c = b.h / 2, cx = b.x + a, cy = b.y + c, dx = tip[0] - cx, dy = tip[1] - cy;
  const t = Math.atan2(dy * a, dx * c); // Office: pang = at2(dx*h, dy*w)
  const at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)];
  const p1 = at(t + DELTA), p2 = at(t - DELTA);
  // from p1 the long way round (increasing parameter = clockwise on screen) to p2
  const d = `M${P(tip)}L${P(p1)}A${f(a)} ${f(c)} 0 1 1 ${P(p2)}Z`;
  const mid: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  return {d, base: [p1, p2], tip, length: Math.hypot(tip[0] - mid[0], tip[1] - mid[1]), inside: (dx / a) ** 2 + (dy / c) ** 2 < 1};
}

function cloudParams(b: Rect) {
  const a0 = b.w / 2, c0 = b.h / 2, per = Math.PI * (3 * (a0 + c0) - Math.sqrt((3 * a0 + c0) * (a0 + 3 * c0)));
  const n = Math.max(8, Math.round(per / 46)), chord = per / n, R = chord * 0.62, bulge = R - Math.sqrt(R * R - chord * chord / 4);
  return {n, R, a: a0 - bulge, c: c0 - bulge}; // the bumps stay inside the box
}
/** The ellipse the cloud's bump arcs start and end on. */
export const cloudEnvelope = (b: Rect): Rect => { const {a, c} = cloudParams(b); return {x: b.x + b.w / 2 - a, y: b.y + b.h / 2 - c, w: 2 * a, h: 2 * c}; };

function cloud(b: Rect, tip: Pt): Balloon {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, ss = Math.min(b.w, b.h), {n, R, a, c} = cloudParams(b);
  const at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)];
  const parts = [`M${P(at(0))}`];
  for (let i = 1; i <= n; i++) parts.push(`A${f(R)} ${f(R)} 0 0 1 ${P(at(2 * Math.PI * i / n))}`);
  parts.push('Z');
  const dx = tip[0] - cx, dy = tip[1] - cy, t = Math.atan2(dy * a, dx * c), e = at(t);
  const len = Math.hypot(tip[0] - e[0], tip[1] - e[1]), ux = len ? (tip[0] - e[0]) / len : 0, uy = len ? (tip[1] - e[1]) / len : 0;
  const r1 = ss / 12, r2 = ss / 18, r3 = ss / 36; // Office cloudCallout: g12, g25, g26
  const s1 = r1 + 3, s3 = len, s2 = Math.max((s1 + s3) / 2, s1 + r1 + r2 + 2);
  const dot = (s: number, r: number): {c: Pt; r: number} => ({c: [e[0] + ux * s, e[1] + uy * s], r});
  const dots = [dot(s1, r1), dot(Math.min(s2, s3), r2), {c: tip, r: r3}];
  return {d: parts.join('') + dots.map(({c: q, r}) => `M${f(q[0] + r)} ${f(q[1])}A${f(r)} ${f(r)} 0 1 1 ${f(q[0] - r)} ${f(q[1])}A${f(r)} ${f(r)} 0 1 1 ${f(q[0] + r)} ${f(q[1])}Z`).join(''), base: [e, e], tip, dots, length: len, inside: (dx / a) ** 2 + (dy / c) ** 2 < 1};
}

/** Office adj1 / adj2 for a tip: the offset from the centre in 1/100000 of the width / height. */
export const officeAdj = (b: Rect, tip: Pt): [number, number] => [Math.round((tip[0] - (b.x + b.w / 2)) / b.w * 100000), Math.round((tip[1] - (b.y + b.h / 2)) / b.h * 100000)];
