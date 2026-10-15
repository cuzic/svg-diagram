// Bends, crossings and length of polylines: pure functions of points (ADR 0016 D6). The layered layout's candidate score
// (layered-route.ts) and the `edge-bends` / `edge-crossings` checks (rules.ts) count with these, so a drawing layer never reads a check.

export interface P {x: number; y: number}

const same = (a: P, b: P): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
export function simplify<T extends P>(pts: T[]): T[] {
  const out: T[] = [];
  for (const p of pts) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** The bends of a polyline: the inner points where the line turns (a repeated point or a point in the middle of a straight run is not one). */
export const bendsOf = (points: P[]): number => Math.max(0, simplify(points).length - 2);

/** The length of a polyline. */
export function totalLength(points: P[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return n;
}

export interface CrossOpts {
  /** How far inside the other segment's span a crossing has to be to count (default 0: strictly inside). */
  margin?: number;
  /** A segment this close to level (or plumb) counts as horizontal (or vertical). Default 0: exactly level or plumb. */
  tol?: number;
}

/**
 * The places where two different polylines properly cross at a right angle: a horizontal run against a vertical one. Touching and
 * overlapping do not count, nor does a polyline crossing itself. Diagonal segments are not counted.
 */
export function crossingsOf(paths: P[][], o: CrossOpts = {}): number {
  const m = o.margin ?? 0, tol = o.tol ?? 0;
  const level = (a: P, b: P): boolean => a.y === b.y || Math.abs(a.y - b.y) < tol;
  const plumb = (a: P, b: P): boolean => a.x === b.x || Math.abs(a.x - b.x) < tol;
  const segs = paths.map(p => p.slice(1).map((q, i) => [p[i], q] as const));
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) for (const s of segs[i]) for (const t of segs[j]) {
    const sh = level(s[0], s[1]), sv = plumb(s[0], s[1]), th = level(t[0], t[1]), tv = plumb(t[0], t[1]);
    if (!((sh && tv) || (sv && th))) continue;
    const [h, v] = sh ? [s, t] : [t, s];
    const x = v[0].x, y = h[0].y;
    if (x > Math.min(h[0].x, h[1].x) + m && x < Math.max(h[0].x, h[1].x) - m && y > Math.min(v[0].y, v[1].y) + m && y < Math.max(v[0].y, v[1].y) - m) n++;
  }
  return n;
}

/** The candidate score of routed arrows: crossings and bends (lower is better; compared crossings first). */
export const scoreOf = (paths: P[][]): {crossings: number; bends: number} => ({crossings: crossingsOf(paths), bends: paths.reduce((n, p) => n + bendsOf(p), 0)});
