// ADR 0078 spike: small convex-polygon helpers (area of intersection by Sutherland-Hodgman) shared by place.ts and comic.ts. Pure, no imports.
export type Pt = [number, number];
export interface Rect {x: number; y: number; w: number; h: number}
export const rectPoly = (r: Rect): Pt[] => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
export const area = (p: Pt[]): number => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const orient = (p: Pt[]): Pt[] => area(p) < 0 ? [...p].reverse() : p;
/** The area of the intersection of two convex polygons. */
export function clipArea(subject: Pt[], clip: Pt[]): number {
  let out = orient(subject); const c = orient(clip);
  for (let i = 0; i < c.length && out.length; i++) {
    const a = c[i]!, b = c[(i + 1) % c.length]!, inside = (p: Pt): boolean => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const cut = (p: Pt, q: Pt): Pt => { const dx = q[0] - p[0], dy = q[1] - p[1], ex = b[0] - a[0], ey = b[1] - a[1], t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / (ex * dy - ey * dx || 1e-12); return [p[0] + t * dx, p[1] + t * dy]; };
    const inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j]!, q = inp[(j + 1) % inp.length]!;
      if (inside(q)) { if (!inside(p)) out.push(cut(p, q)); out.push(q); } else if (inside(p)) out.push(cut(p, q));
    }
  }
  return out.length < 3 ? 0 : Math.abs(area(out));
}
/** Length of the polyline `pts` inside a convex polygon (exact: each segment is clipped by the polygon's edges, Cyrus-Beck). */
export function lengthInPoly(pts: Pt[], poly: Pt[]): number {
  const c = orient(poly); let len = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, dx = b[0] - a[0], dy = b[1] - a[1]; let t0 = 0, t1 = 1;
    for (let j = 0; j < c.length && t0 < t1; j++) {
      const p = c[j]!, q = c[(j + 1) % c.length]!, ex = q[0] - p[0], ey = q[1] - p[1];
      const num = ex * (a[1] - p[1]) - ey * (a[0] - p[0]), den = ex * dy - ey * dx; // inside: num + t*den >= 0
      if (Math.abs(den) < 1e-12) { if (num < 0) t0 = t1; continue; }
      const t = -num / den; if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
    if (t1 > t0) len += (t1 - t0) * Math.hypot(dx, dy);
  }
  return len;
}
export const lengthIn = (pts: Pt[], r: Rect): number => lengthInPoly(pts, rectPoly(r));
/** The polygon pushed outwards by `d` px (vertices move away from the centroid; exact for a rectangle's corners only up to the corner shape: the spike's stand-in for an offset curve). */
export function inflate(poly: Pt[], d: number): Pt[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(p => { const L = Math.hypot(p[0] - cx, p[1] - cy) || 1; return [p[0] + (p[0] - cx) / L * d, p[1] + (p[1] - cy) / L * d] as Pt; });
}
/** A rounded rectangle as a convex polygon (4 points per corner). */
export function roundPoly(r: Rect, rad: number): Pt[] {
  const k = Math.min(rad, r.w / 2, r.h / 2); if (k <= 0) return rectPoly(r);
  const out: Pt[] = [], cs: [number, number, number][] = [[r.x + r.w - k, r.y + k, -90], [r.x + r.w - k, r.y + r.h - k, 0], [r.x + k, r.y + r.h - k, 90], [r.x + k, r.y + k, 180]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * Math.PI / 180; out.push([cx + k * Math.cos(a), cy + k * Math.sin(a)]); }
  return out;
}
