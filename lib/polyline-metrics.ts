// Bends, crossings and length of polylines: pure functions of points (ADR 0016 D6). The layered layout's candidate score
// (layered-route.ts) and the `edge-bends` / `edge-crossings` checks (rules.ts) count with these, so a drawing layer never reads a check.

export interface P {x: number; y: number}

const same = (a: P, b: P): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
export function simplify<T extends P>(pts: T[]): T[] {
  const out: T[] = [];
  for (const p of pts) { const last = out[out.length - 1]; if (!last || !same(last, p)) out.push(p); }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    if (!a || !b) return true;
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** The bends of a polyline: the inner points where the line turns (a repeated point or a point in the middle of a straight run is not one). */
export const bendsOf = (points: P[]): number => Math.max(0, simplify(points).length - 2);

/** The length of a polyline. */
export function totalLength(points: P[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) { const a = points[i], b = points[i - 1]; if (a && b) n += Math.hypot(a.x - b.x, a.y - b.y); }
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
  // each polyline's horizontal and vertical runs, worked out once (a run that is both level and plumb is a point: it is a run of both kinds, as before)
  type H = {y: number; lo: number; hi: number}; // a level run: its height and its span
  type V = {x: number; lo: number; hi: number};
  const hs: H[][] = [], vs: V[][] = [];
  for (const p of paths) {
    const h: H[] = [], v: V[] = [];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (!a || !b) continue;
      if (level(a, b)) h.push({y: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x)});
      if (plumb(a, b)) v.push({x: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y)});
    }
    hs.push(h); vs.push(v);
  }
  let n = 0;
  for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
    for (const [h, v] of [[hs[i] ?? [], vs[j] ?? []], [hs[j] ?? [], vs[i] ?? []]] as const) for (const a of h) for (const b of v) {
      if (b.x > a.lo + m && b.x < a.hi - m && a.y > b.lo + m && a.y < b.hi - m) n++;
    }
  }
  return n;
}

/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). */
export function crossingsWith(path: P[], others: readonly P[][], o: CrossOpts = {}): number {
  return crossingsOf([path, ...others], o) - crossingsOf([...others], o);
}

/** The candidate score of routed arrows: crossings and bends (lower is better; compared crossings first). */
export const scoreOf = (paths: P[][]): {crossings: number; bends: number} => ({crossings: crossingsOf(paths), bends: paths.reduce((n, p) => n + bendsOf(p), 0)});

/** Two runs of arrows side by side (under 4px apart, over 4px long together): they read as one line. Shared by the verifier (`cause-parallel`) and the router (ADR 0016 D11). */
export function runsTogether(a: {p: P; q: P}, b: {p: P; q: P}): boolean {
  const aH = a.p.y === a.q.y;
  if (aH !== (b.p.y === b.q.y)) return false;
  const [c, d] = aH ? ['x', 'y'] as const : ['y', 'x'] as const;
  return Math.abs(a.p[d] - b.p[d]) < 4 && Math.min(Math.max(a.p[c], a.q[c]), Math.max(b.p[c], b.q[c])) - Math.max(Math.min(a.p[c], a.q[c]), Math.min(b.p[c], b.q[c])) > 4;
}
