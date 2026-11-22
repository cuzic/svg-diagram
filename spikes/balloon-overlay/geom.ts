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
/** Length of the polyline `pts` that lies inside the rectangle (sampled every 0.5px). */
export function lengthIn(pts: Pt[], r: Rect): number {
  let len = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) len += L / n; }
  }
  return len;
}
/** A rounded rectangle as a convex polygon (4 points per corner). */
export function roundPoly(r: Rect, rad: number): Pt[] {
  const k = Math.min(rad, r.w / 2, r.h / 2); if (k <= 0) return rectPoly(r);
  const out: Pt[] = [], cs: [number, number, number][] = [[r.x + r.w - k, r.y + k, -90], [r.x + r.w - k, r.y + r.h - k, 0], [r.x + k, r.y + r.h - k, 90], [r.x + k, r.y + k, 180]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * Math.PI / 180; out.push([cx + k * Math.cos(a), cy + k * Math.sin(a)]); }
  return out;
}
