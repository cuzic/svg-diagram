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

/** A polyline's level and plumb runs, as `crossingsWith` reads them (worked out once for a polyline that is compared with many). */
export interface Runs {h: {at: number; lo: number; hi: number}[]; v: {at: number; lo: number; hi: number}[]}

export function runsOfPath(p: P[], o: CrossOpts = {}): Runs {
  const tol = o.tol ?? 0;
  const h: Runs['h'] = [], v: Runs['v'] = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    if (!a || !b) continue;
    if (a.y === b.y || Math.abs(a.y - b.y) < tol) h.push({at: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x)});
    if (a.x === b.x || Math.abs(a.x - b.x) < tol) v.push({at: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y)});
  }
  return {h, v};
}

/** The crossings of two polylines from their runs (what `crossingsWith(a, [b])` counts). */
export function crossingsOfRuns(a: Runs, b: Runs, o: CrossOpts = {}): number {
  const m = o.margin ?? 0;
  const cross = (h: Runs['h'], v: Runs['v']): number => { let n = 0; for (const x of h) for (const y of v) if (y.at > x.lo + m && y.at < x.hi - m && x.at > y.lo + m && x.at < y.hi - m) n++; return n; };
  return cross(a.h, b.v) + cross(b.h, a.v);
}

/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). Only its own pairs are compared: the others are not counted against each other. */
export function crossingsWith(path: P[], others: readonly P[][], o: CrossOpts = {}): number {
  const mine = runsOfPath(path, o);
  let n = 0;
  for (const other of others) n += crossingsOfRuns(mine, runsOfPath(other, o), o);
  return n;
}

const samePath = (a: P[], b: P[]): boolean => a === b || (a.length === b.length && a.every((p, k) => { const q = b[k] as P; return p.x === q.x && p.y === q.y; }));

/**
 * `scoreOf(next)`, from the score of `prev` and the routes that differ: a local search tries one change after another, and a change moves a few
 * routes, so counting every pair of routes again for each try is most of its cost. The same numbers as counting afresh (test/polyline-metrics.test.ts).
 */
export function rescore<K>(prev: ReadonlyMap<K, P[]>, prevScore: {crossings: number; bends: number}, next: ReadonlyMap<K, P[]>): {crossings: number; bends: number} {
  if (prev.size !== next.size || [...next.keys()].some(k => !prev.has(k))) return scoreOf([...next.values()]);
  const before: P[][] = [], after: P[][] = [], rest: P[][] = [];
  for (const [k, r] of next) { const old = prev.get(k) as P[]; if (samePath(old, r)) rest.push(r); else { before.push(old); after.push(r); } }
  if (!after.length) return prevScore;
  const against = (moved: P[][]): number => crossingsOf(moved) + moved.reduce((n, r) => n + crossingsWith(r, rest), 0);
  return {
    crossings: prevScore.crossings - against(before) + against(after),
    bends: prevScore.bends - before.reduce((n, r) => n + bendsOf(r), 0) + after.reduce((n, r) => n + bendsOf(r), 0),
  };
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

/** One pair of side-by-side runs (`parallelRuns`): the routes by index, how far apart the runs are and how long they go together. */
export interface ParallelRun {a: number; b: number; gap: number; overlap: number}

/**
 * The runs of two different routes on one axis (level with level, plumb with plumb; either direction) that are under `sep` apart and
 * over 4px long together (ADR 0070 D2). Routes that share an end count too. Each route's corners are taken first (`simplify`), so a
 * straight run is one run however many points it has; a slanted segment is not a run. `runsTogether` is the case `sep = 4` for two
 * single runs, and keeps its own definition (the verifier's `cause-parallel` and the router's ADR 0016 D11 read it).
 */
export function parallelRuns(routes: readonly P[][], sep: number): ParallelRun[] {
  const runs = routes.map(r => runsOfRoute(r)), out: ParallelRun[] = [];
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    for (const r of runs[i] ?? []) for (const s of runs[j] ?? []) {
      if (r.level !== s.level) continue;
      const gap = Math.abs(r.at - s.at), overlap = Math.min(r.hi, s.hi) - Math.max(r.lo, s.lo);
      if (gap < sep && overlap > 4) out.push({a: i, b: j, gap, overlap});
    }
  }
  return out;
}

/** One run of a route (`parallelRuns`): level or plumb, where it lies across, and its span. */
export interface RouteRun {level: boolean; at: number; lo: number; hi: number}

/** A route's runs, its corners first (`simplify`): a straight run is one however many points it has; a point and a slanted segment are not runs. */
export function runsOfRoute(pts: P[]): RouteRun[] {
  const s = simplify(pts), out: RouteRun[] = [];
  for (let i = 1; i < s.length; i++) {
    const p = s[i - 1] as P, q = s[i] as P;
    const level = Math.abs(p.y - q.y) < 0.5, plumb = Math.abs(p.x - q.x) < 0.5;
    if (level === plumb) continue;
    out.push(level ? {level, at: p.y, lo: Math.min(p.x, q.x), hi: Math.max(p.x, q.x)} : {level, at: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y)});
  }
  return out;
}

/**
 * The ways two routes lie against each other (ADR 0070 U4c): `level` / `plumb` is in the set when a run of one and a run of the other, both level
 * (or both plumb), are side by side (on one axis under `sep` apart, over 4px long together: `parallelRuns`' pair) or on one line with their ends
 * under `sep` apart (a pair `parallelRuns` leaves out: two runs that read as one, ADR 0070 U4b's `touch`).
 */
export function runPairWays(a: readonly RouteRun[], b: readonly RouteRun[], sep: number): {level: boolean; plumb: boolean} {
  let level = false, plumb = false;
  for (const r of a) for (const s of b) {
    if (r.level !== s.level || (r.level ? level : plumb)) continue;
    const gap = Math.abs(r.at - s.at), overlap = Math.min(r.hi, s.hi) - Math.max(r.lo, s.lo);
    if (overlap > 4 ? gap < sep : gap < 0.5 && overlap > -sep) { if (r.level) level = true; else plumb = true; }
  }
  return {level, plumb};
}

/** A route's runs with the box it lies in (a pair of runs under `sep` apart needs the two boxes within `sep` of each other). */
export interface RoutedRuns {runs: RouteRun[]; x0: number; x1: number; y0: number; y1: number}

/** The runs of a route and its box, worked out once per array in `cache` (the caller's, so no module holds state). */
export function routedRuns(r: P[], cache: WeakMap<P[], RoutedRuns>): RoutedRuns {
  let e = cache.get(r);
  if (!e) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of r) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    e = {runs: runsOfRoute(r), x0, x1, y0, y1};
    cache.set(r, e);
  }
  return e;
}

/**
 * Does `next` lie against another route in a way `prev` did not (`runPairWays`)? Only the routes that differ are asked: for each, the other routes
 * it lies against, level or plumb. A pair that was there stays allowed (it may be a bit nearer); a new pair, or the same two routes the other
 * way (a plumb pair for a level one), is a gain. `cache` holds the runs of the routes by their arrays.
 */
export function gainsRunPairs<K>(prev: ReadonlyMap<K, P[]>, next: ReadonlyMap<K, P[]>, sep: number, cache: WeakMap<P[], RoutedRuns>): boolean {
  const near = (a: RoutedRuns, b: RoutedRuns): boolean => a.x0 - sep - 1 <= b.x1 && b.x0 - sep - 1 <= a.x1 && a.y0 - sep - 1 <= b.y1 && b.y0 - sep - 1 <= a.y1;
  for (const [k, r] of next) {
    const old = prev.get(k);
    if (!old || samePath(old, r)) continue;
    const was0 = routedRuns(old, cache), now0 = routedRuns(r, cache);
    for (const [o, ro] of next) {
      if (o === k) continue;
      const oldO = prev.get(o) ?? ro, other = routedRuns(samePath(oldO, ro) ? oldO : ro, cache), otherWas = routedRuns(oldO, cache); // an unchanged route's runs are those of its old array
      const was = near(was0, otherWas) ? runPairWays(was0.runs, otherWas.runs, sep) : NONE, now = near(now0, other) ? runPairWays(now0.runs, other.runs, sep) : NONE;
      if ((now.level && !was.level) || (now.plumb && !was.plumb)) return true;
    }
  }
  return false;
}
const NONE = {level: false, plumb: false};
