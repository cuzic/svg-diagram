// Spike for ADR 0077: the shared outline generator. It extends the rect-family code of PR #436's lib/comic/balloon-path.ts (same path text, same one-decimal
// rounding) with a radius option, an ellipse, a cloud and an Office base mode. Pure: numbers in, strings out, no imports.
export type Pt = readonly [number, number];
export interface Rect {x: number; y: number; w: number; h: number}
export type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface BalloonOpts {
  /** Corner radius of 'round' (box() uses 8). Default 8. */
  radius?: number;
  /** Half the width of the wedge on a side (rect / round). Default clamp(side/4, 12, 28) / 2. The comic passes 8 (its fixed 16px wedge). */
  halfWidth?: number;
  /** 'follow': the wedge slides along the side under the tip. 'office': the preset's fixed wedge (2/12..5/12 or 7/12..10/12 of the side). */
  base?: 'follow' | 'office';
}
export interface Balloon {
  /** The closed outline: body and (for rect / round / ellipse) the wedge tail in one path. For a cloud, the body only. */
  d: string;
  /** Where the tail leaves the outline (cloud: the point of the real outline the trail starts from, twice). Left out when there is no tail. */
  base?: [Pt, Pt];
  tip?: Pt;
  side?: Side;
  /** cloud: the trail of circles, body side first. */
  dots?: {c: Pt; r: number}[];
  /** From the middle of the base to the tip (cloud: from the outline to the tip). */
  length: number;
  /** cloud: the shortest tail whose three circles do not touch (first circle's clearance of the real outline included). */
  minLength?: number;
  /** The wedge's apex angle in degrees (cloud: 0). 180 = flat; small = a needle. */
  apex: number;
  /** The tip is inside the outline (no tail is drawn). */
  inside: boolean;
}

const f1 = (n: number): number => Math.round(n * 10) / 10;
const f2 = (n: number): number => Math.round(n * 100) / 100;
const DELTA = 11 * Math.PI / 180; // Office wedgeEllipseCallout: the base spans +-11 degrees of the ellipse parameter
const CLEAR_MIN = 4; // the base keeps at least this much of the straight part between itself and a corner arc (a rect has no arc)

export function balloonOutline(shape: BalloonShape, body: Rect, tip?: Pt, o: BalloonOpts = {}): Balloon {
  return shape === 'ellipse' ? ellipse(body, tip) : shape === 'cloud' ? cloud(body, tip) : wedgeRect(shape === 'round' ? Math.min(o.radius ?? 8, body.w / 2, body.h / 2) : 0, body, tip, o);
}

const insideRounded = (b: Rect, r: number, p: Pt): boolean => {
  const qx = Math.abs(p[0] - (b.x + b.w / 2)) - (b.w / 2 - r), qy = Math.abs(p[1] - (b.y + b.h / 2)) - (b.h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) < r;
};

function wedgeRect(r: number, body: Rect, tip: Pt | undefined, o: BalloonOpts): Balloon {
  const {x, y, w, h} = body, right = x + w, bottom = y + h;
  const arc = (px: number, py: number): string => r > 0 ? `A${r} ${r} 0 0 1 ${f1(px)} ${f1(py)}` : '';
  let wedge: {side: Side; base: [[number, number], [number, number]]; tip: [number, number]; half: number} | undefined;
  const dxc = tip ? tip[0] - (x + w / 2) : 0, dyc = tip ? tip[1] - (y + h / 2) : 0;
  const inside = tip ? insideRounded(body, r, tip) : false;
  if (tip && !inside) {
    // Office (dz > 0): top / bottom only when |dy| is strictly bigger than |dx| h / w; a tie leaves through a left / right side
    const side: Side = Math.abs(dyc) * w > Math.abs(dxc) * h ? (dyc > 0 ? 'bottom' : 'top') : (dxc > 0 ? 'right' : 'left');
    const along = side === 'top' || side === 'bottom', L = along ? w : h, o0 = along ? x : y;
    let half: number, t: number;
    if (o.base === 'office') {
      const pos = along ? dxc : dyc; // the fractions of the side, 2/12..5/12 (tip on the low side) or 7/12..10/12
      half = L / 8; t = o0 + (pos > 0 ? 8.5 : 3.5) / 12 * L;
    } else {
      half = o.halfWidth ?? Math.min(Math.max(L / 4, 12), 28) / 2;
      const clear = Math.max(r, CLEAR_MIN), lo = o0 + clear + half, hi = o0 + L - clear - half; // the wedge stays on the straight part
      t = Math.min(Math.max(along ? tip[0] : tip[1], Math.min(lo, hi)), Math.max(lo, hi));
    }
    const at = (c: number): [number, number] => side === 'top' ? [c, y] : side === 'bottom' ? [c, bottom] : side === 'left' ? [x, c] : [right, c];
    const [a, b] = side === 'top' || side === 'right' ? [at(t - half), at(t + half)] : [at(t + half), at(t - half)];
    wedge = {side, base: [a, b], tip: [tip[0], tip[1]], half};
  }
  const cut = (side: Side): string => wedge?.side === side ? `L${f1(wedge.base[0][0])} ${f1(wedge.base[0][1])}L${f1(wedge.tip[0])} ${f1(wedge.tip[1])}L${f1(wedge.base[1][0])} ${f1(wedge.base[1][1])}` : '';
  const d = `M${f1(x + r)} ${f1(y)}${cut('top')}H${f1(right - r)}${arc(right, y + r)}${cut('right')}V${f1(bottom - r)}${arc(right - r, bottom)}${cut('bottom')}H${f1(x + r)}${arc(x, bottom - r)}${cut('left')}V${f1(y + r)}${arc(x + r, y)}Z`;
  if (!wedge) return {d, length: 0, apex: 0, inside};
  const base: [Pt, Pt] = [[f1(wedge.base[0][0]), f1(wedge.base[0][1])], [f1(wedge.base[1][0]), f1(wedge.base[1][1])]];
  const mid: Pt = [(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2], length = Math.hypot(wedge.tip[0] - mid[0], wedge.tip[1] - mid[1]);
  return {d, base, tip: wedge.tip, side: wedge.side, length, apex: 2 * Math.atan2(wedge.half, length) * 180 / Math.PI, inside};
}

function ellipse(b: Rect, tip?: Pt): Balloon {
  const a = b.w / 2, c = b.h / 2, cx = b.x + a, cy = b.y + c;
  const at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)];
  const P = (p: Pt): string => `${f2(p[0])} ${f2(p[1])}`;
  if (!tip) return {d: `M${P(at(0))}A${f2(a)} ${f2(c)} 0 1 1 ${P(at(Math.PI))}A${f2(a)} ${f2(c)} 0 1 1 ${P(at(0))}Z`, length: 0, apex: 0, inside: false};
  const dx = tip[0] - cx, dy = tip[1] - cy, t = Math.atan2(dy * a, dx * c); // Office: pang = at2(dx h, dy w)
  const inside = (dx / a) ** 2 + (dy / c) ** 2 < 1;
  if (inside) return {d: `M${P(at(0))}A${f2(a)} ${f2(c)} 0 1 1 ${P(at(Math.PI))}A${f2(a)} ${f2(c)} 0 1 1 ${P(at(0))}Z`, length: 0, apex: 0, inside};
  const p1 = at(t + DELTA), p2 = at(t - DELTA), mid: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], length = Math.hypot(tip[0] - mid[0], tip[1] - mid[1]);
  const half = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / 2;
  return {d: `M${P(tip)}L${P(p1)}A${f2(a)} ${f2(c)} 0 1 1 ${P(p2)}Z`, base: [p1, p2], tip, length, apex: 2 * Math.atan2(half, length) * 180 / Math.PI, inside};
}

function cloudParams(b: Rect) {
  const a0 = b.w / 2, c0 = b.h / 2, per = Math.PI * (3 * (a0 + c0) - Math.sqrt((3 * a0 + c0) * (a0 + 3 * c0)));
  const n = Math.max(8, Math.round(per / 46)), chord = per / n, R = chord * 0.62, bulge = R - Math.sqrt(R * R - chord * chord / 4);
  return {n, R, a: a0 - bulge, c: c0 - bulge, cx: b.x + a0, cy: b.y + c0}; // the bumps stay inside the box
}
/** The ellipse the bump arcs start and end on (not the outline: the bumps protrude past it). */
export const cloudEnvelope = (b: Rect): Rect => { const {a, c, cx, cy} = cloudParams(b); return {x: cx - a, y: cy - c, w: 2 * a, h: 2 * c}; };
/** The real outline of a cloud as a polygon (the bump arcs sampled `per` points each). */
export function cloudPolygon(b: Rect, per = 16): Pt[] {
  const {n, R, a, c, cx, cy} = cloudParams(b), at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)], out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(2 * Math.PI * i / n), p1 = at(2 * Math.PI * (i + 1) / n), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    const cdx = p1[0] - p0[0], cdy = p1[1] - p0[1], cl = Math.hypot(cdx, cdy), hh = Math.sqrt(R * R - cl * cl / 4);
    let nx = -cdy / cl, ny = cdx / cl; if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    const ccx = mx - nx * hh, ccy = my - ny * hh, s0 = Math.atan2(p0[1] - ccy, p0[0] - ccx);
    let da = Math.atan2(p1[1] - ccy, p1[0] - ccx) - s0; while (da <= -Math.PI) da += 2 * Math.PI; while (da > Math.PI) da -= 2 * Math.PI;
    for (let k = 0; k < per; k++) out.push([ccx + R * Math.cos(s0 + da * k / per), ccy + R * Math.sin(s0 + da * k / per)]);
  }
  return out;
}
const inPoly = (p: Pt, poly: Pt[]): boolean => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, c = poly[j]!; if ((a[1] > p[1]) !== (c[1] > p[1]) && p[0] < (c[0] - a[0]) * (p[1] - a[1]) / (c[1] - a[1]) + a[0]) ins = !ins; } return ins; };
export const distToPolygon = (p: Pt, poly: Pt[]): number => { let best = 1e9; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, c = poly[(i + 1) % poly.length]!, vx = c[0] - a[0], vy = c[1] - a[1], t = Math.min(Math.max(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1), 0), 1); best = Math.min(best, Math.hypot(a[0] + vx * t - p[0], a[1] + vy * t - p[1])); } return best; };

/** Circle radii of the trail (Office g12, g25, g26) and the spacing the trail needs; the minimum tail length is 2 r1 + 2 r2 + r3 + 6 = 0.306 ss + 6 (Office's own g9 is 0.306 ss). */
export const cloudRadii = (ss: number): [number, number, number] => [ss / 12, ss / 18, ss / 36];
export const cloudMinLength = (ss: number): number => { const [r1, r2, r3] = cloudRadii(ss); return 2 * r1 + 2 * r2 + r3 + 6; };

function cloud(b: Rect, tip?: Pt): Balloon {
  const {n, R, a, c, cx, cy} = cloudParams(b), ss = Math.min(b.w, b.h), at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)];
  const P = (p: Pt): string => `${f2(p[0])} ${f2(p[1])}`, parts = [`M${P(at(0))}`];
  for (let i = 1; i <= n; i++) parts.push(`A${f2(R)} ${f2(R)} 0 0 1 ${P(at(2 * Math.PI * i / n))}`);
  const d = parts.join('') + 'Z';
  if (!tip) return {d, length: 0, apex: 0, inside: false};
  const poly = cloudPolygon(b), inside = inPoly(tip, poly);
  if (inside) return {d, length: 0, apex: 0, inside};
  // the point where the line from the centre to the tip leaves the REAL outline (the farthest crossing)
  const L = Math.hypot(tip[0] - cx, tip[1] - cy), ux = (tip[0] - cx) / L, uy = (tip[1] - cy) / L;
  let q = 0;
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i]!, p1 = poly[(i + 1) % poly.length]!, ex = p1[0] - p0[0], ey = p1[1] - p0[1], den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p0[0] - cx) * ey - (p0[1] - cy) * ex) / den, s = ((p0[0] - cx) * uy - (p0[1] - cy) * ux) / den;
    if (t > 0 && s >= 0 && s <= 1) q = Math.max(q, t);
  }
  const e: Pt = [cx + ux * q, cy + uy * q], length = L - q, [r1, r2, r3] = cloudRadii(ss);
  // the first circle clears the real outline by 2 px (a bump next to the exit point can reach into a radial circle: push it out until it clears)
  let s1 = r1 + 2;
  while (distToPolygon([e[0] + ux * s1, e[1] + uy * s1], poly) < r1 + 2 && s1 < 4 * r1) s1 += 0.25;
  const s3 = length, minLength = s1 + r1 + r2 + 2 + r2 + r3 + 2, s2 = Math.min(Math.max((s1 + s3) / 2, s1 + r1 + r2 + 2), s3);
  const dot = (s: number, r: number): {c: Pt; r: number} => ({c: [e[0] + ux * s, e[1] + uy * s], r});
  return {d, base: [e, e], tip, dots: [dot(s1, r1), dot(s2, r2), {c: tip, r: r3}], length, minLength, apex: 0, inside};
}

/** Office adj1 / adj2 for a tip: the offset from the centre in 1/100000 of the width / height. */
export const officeAdj = (b: Rect, tip: Pt): [number, number] => [Math.round((tip[0] - (b.x + b.w / 2)) / b.w * 100000), Math.round((tip[1] - (b.y + b.h / 2)) / b.h * 100000)];

/** SAT: does the triangle overlap the rectangle by more than `tol` px (the rectangle shrunk by tol on every side)? */
export function triangleHitsRect(tri: [Pt, Pt, Pt], r: Rect, tol = 0.5): boolean {
  const rx0 = r.x + tol, ry0 = r.y + tol, rx1 = r.x + r.w - tol, ry1 = r.y + r.h - tol;
  const rp: Pt[] = [[rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1]];
  const axes: Pt[] = [[1, 0], [0, 1]];
  for (let i = 0; i < 3; i++) { const a = tri[i]!, c = tri[(i + 1) % 3]!; axes.push([-(c[1] - a[1]), c[0] - a[0]]); }
  return axes.every(ax => {
    const pr = (ps: Pt[]) => { const v = ps.map(p => p[0] * ax[0] + p[1] * ax[1]); return [Math.min(...v), Math.max(...v)] as const; };
    const [a0, a1] = pr(tri), [b0, b1] = pr(rp);
    return a1 > b0 && b1 > a0;
  });
}
