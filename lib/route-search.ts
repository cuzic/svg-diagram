// The way around the boxes with the fewest bends, for one long arrow of a layered layout (layered-route.ts). Pure geometry in the layout's own
// axes (layers run along x): a search over the grid of lines that run beside the boxes, so a long arrow turns where there is room, not half-way
// between the way points of the layering.
import {must} from './must.ts';
import type {P} from './polyline-metrics.ts';

export interface Rect {x: number; y: number; w: number; h: number}
export interface SearchOpts {
  /** The room kept between a run and a box (also where the runs go: a line this far off each side of a box). */
  margin?: number;
  /** The first run leaves the tail this far before it may turn; the last run is this long before the head. */
  stub?: number;
  tail?: number;
  /** Costs, in length units: a bend, a crossing of another arrow's run, a run along another arrow's. */
  bend?: number;
  cross?: number;
  along?: number;
  /** A run across another arrow's last run this close to its tip (inside its arrowhead and the room for a hop beside it) costs this much: it reads as a join. */
  head?: number;
  /** The most steps of the search (a state's neighbours tried); over it the search gives up (undefined), so the time per arrow is bounded. */
  budget?: number;
}

/** How far before its tip another arrow's last run is kept clear of a crossing: the arrowhead (12) and the bump of a hop (6) beside it, and a margin. */
export const HEAD_REACH = 22;

/** The crossings of a run across the layers with the last run of another arrow, within `HEAD_REACH` of its tip: they read as joins, and `hop` skips them. */
export function headCrossings(paths: readonly P[][]): number {
  let n = 0;
  for (const [i, p] of paths.entries()) {
    if (p.length < 2) continue;
    const tip = p[p.length - 1], from = p[p.length - 2];
    if (!tip || !from || tip.y !== from.y) continue; // an arrow comes into a box along the layers (the layout's axes)
    for (const [j, q] of paths.entries()) {
      if (j === i) continue;
      for (let k = 1; k < q.length; k++) {
        const a = q[k - 1], b = q[k];
        if (!a || !b || a.x !== b.x) continue; // a run across the layers
        if (a.x < Math.min(from.x, tip.x) - 0.5 || a.x > Math.max(from.x, tip.x) + 0.5 || Math.abs(a.x - tip.x) > HEAD_REACH) continue;
        if (tip.y > Math.min(a.y, b.y) + 0.5 && tip.y < Math.max(a.y, b.y) - 0.5) n++;
      }
    }
  }
  return n;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * A polyline from `start` to `end` (both on box sides; the arrow runs toward larger x) that keeps `margin` off every box in `boxes`, stays in `bounds`, and costs least in
 * length, bends, crossings of `others` and runs along them. Undefined when there is none.
 */
export function searchRoute(start: P, end: P, boxes: readonly Rect[], others: readonly P[][], bounds: Rect, o: SearchOpts = {}): P[] | undefined {
  const m = o.margin ?? 8, stub = o.stub ?? 18, tail = o.tail ?? 26, BEND = o.bend ?? 30, CROSS = o.cross ?? 25, ALONG = o.along ?? 200, HEAD = o.head ?? 300, BUDGET = o.budget ?? 60000;
  const r2 = (v: number): number => Math.round(v * 64) / 64; // grid lines a hair apart are one line
  const s = {x: r2(start.x + stub), y: start.y}, g = {x: r2(end.x - tail), y: end.y};
  if (g.x < s.x) return undefined;
  const xs = new Set<number>([s.x, g.x]), ys = new Set<number>([s.y, g.y, r2(bounds.y + m), r2(bounds.y + bounds.h - m)]);
  for (const b of boxes) { xs.add(r2(b.x - m)); xs.add(r2(b.x + b.w + m)); ys.add(r2(b.y - m)); ys.add(r2(b.y + b.h + m)); }
  const X = [...xs].filter(x => x >= s.x - 0.01 && x <= g.x + 0.01 && x >= bounds.x && x <= bounds.x + bounds.w).sort((a, b) => a - b);
  const Y = [...ys].filter(y => y >= bounds.y && y <= bounds.y + bounds.h).sort((a, b) => a - b);
  const xi = new Map(X.map((x, i) => [x, i])), yi = new Map(Y.map((y, i) => [y, i]));
  if (!xi.has(s.x) || !yi.has(s.y) || !xi.has(g.x) || !yi.has(g.y)) return undefined;
  // the grid lines lie on the sides of every box widened by the margin, so a step between two neighbouring points is wholly inside a widened box or wholly outside it: a point
  // and a step are blocked when the point / the middle of the step is inside one (worked out once: the search asks for them again and again)
  const nx = X.length, ny = Y.length;
  const inBox = (x: number, y: number): boolean => boxes.some(b => x > b.x - m + 0.01 && x < b.x + b.w + m - 0.01 && y > b.y - m + 0.01 && y < b.y + b.h + m - 0.01);
  const blockedPt = new Uint8Array(nx * ny), blockedRight = new Uint8Array(nx * ny), blockedDown = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const xv = must(X[i]), yv = must(Y[j]); // i < nx, j < ny
    blockedPt[j * nx + i] = inBox(xv, yv) ? 1 : 0;
    if (i + 1 < nx) blockedRight[j * nx + i] = inBox((xv + must(X[i + 1])) / 2, yv) ? 1 : 0;
    if (j + 1 < ny) blockedDown[j * nx + i] = inBox(xv, (yv + must(Y[j + 1])) / 2) ? 1 : 0;
  }
  const stepBlocked = (i: number, j: number, nd: number): boolean => nd === 0 ? blockedRight[j * nx + i] === 1 : nd === 1 ? blockedRight[j * nx + i - 1] === 1 : nd === 2 ? blockedDown[j * nx + i] === 1 : blockedDown[(j - 1) * nx + i] === 1;
  // the other arrows' runs, by direction; the last run of each (its tip) for the arrowheads
  const hor: [P, P][] = [], ver: [P, P][] = [], tips: {x: number; y: number}[] = [];
  for (const p of others) {
    for (let k = 1; k < p.length; k++) { const a = p[k - 1], b = p[k]; if (a && b) (b.y === a.y ? hor : ver).push([a, b]); }
    const tip = p[p.length - 1], before = p[p.length - 2];
    if (tip && before && tip.y === before.y) tips.push(tip);
  }
  /** The cost of the step a -> b (one grid step, along an axis): length, and the crossings of other arrows and the runs along them. A crossing at the step's far end counts (the near end belongs to the step before). */
  const stepCost = (a: P, b: P): number => {
    let c = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const h = a.y === b.y, along = h ? hor : ver, across = h ? ver : hor;
    const t0 = h ? a.x : a.y, t1 = h ? b.x : b.y, lo = Math.min(t0, t1), hi = Math.max(t0, t1), up = t1 > t0, fixed = h ? a.y : a.x;
    for (const [p, q] of along) { // along: the same line (within 4px), overlapping
      const [u, v] = h ? ['x', 'y'] as const : ['y', 'x'] as const;
      if (Math.abs(p[v] - fixed) < 4 && Math.min(hi, Math.max(p[u], q[u])) - Math.max(lo, Math.min(p[u], q[u])) > 1) c += ALONG;
    }
    for (const [p, q] of across) { // a crossing: strictly inside the other run, and in this step (the far end counts, the near end does not)
      const pos = h ? p.x : p.y, f0 = h ? Math.min(p.y, q.y) : Math.min(p.x, q.x), f1 = h ? Math.max(p.y, q.y) : Math.max(p.x, q.x);
      if (!(fixed > f0 + 0.5 && fixed < f1 - 0.5)) continue;
      if (!(up ? pos > lo + 0.01 && pos <= hi + 0.01 : pos >= lo - 0.01 && pos < hi - 0.01)) continue;
      c += CROSS;
    }
    if (!h) for (const t of tips) if (Math.abs(fixed - t.x) <= HEAD_REACH && t.y > lo + 0.01 && t.y < hi - 0.01) c += HEAD;
    return c;
  };
  // A* over (column, row, direction); a step's cost is cached (it does not depend on the direction it was reached in). The estimate is the length that is left.
  const key = (i: number, j: number, d: number): number => (j * nx + i) * 4 + d;
  const dist = new Float64Array(nx * ny * 4).fill(Infinity), prev = new Int32Array(nx * ny * 4).fill(-1), cached = new Float64Array(nx * ny * 4).fill(-1);
  const i0 = must(xi.get(s.x)), j0 = must(yi.get(s.y)), ig = must(xi.get(g.x)), jg = must(yi.get(g.y)); // checked above
  const xg = must(X[ig]), yg = must(Y[jg]);
  const left = (i: number, j: number): number => Math.abs(xg - must(X[i])) + Math.abs(yg - must(Y[j]));
  const heap: [number, number][] = []; // [estimated total, key]
  const push = (c: number, k: number): void => { heap.push([c, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1, hp = must(heap[p]), hi = must(heap[i]); if (hp[0] <= hi[0]) break; heap[p] = hi; heap[i] = hp; i = p; } };
  const pop = (): [number, number] => { const top = must(heap[0]), last = must(heap.pop()); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m2 = i; if (l < heap.length && must(heap[l])[0] < must(heap[m2])[0]) m2 = l; if (r < heap.length && must(heap[r])[0] < must(heap[m2])[0]) m2 = r; if (m2 === i) break; const hm = must(heap[m2]), hi = must(heap[i]); heap[m2] = hi; heap[i] = hm; i = m2; } } return top; };
  const k0 = key(i0, j0, 0);
  dist[k0] = stepCost(start, s); push(dist[k0] + left(i0, j0), k0);
  // the last run g -> end, and the bend into it unless the search arrives along the layers: added when a state at g is popped; the search goes on until nothing cheaper is left
  const finish = stepCost(g, end);
  let goal = -1, bestTotal = Infinity, steps = 0, over = false;
  while (heap.length) {
    const [f, k] = pop();
    const d = k % 4, cell = (k - d) / 4, i = cell % nx, j = (cell - i) / nx, c = must(dist[k]);
    if (f > c + left(i, j) + 1e-9) continue; // stale
    if (f + finish >= bestTotal) break; // every way ends with the last run
    if (i === ig && j === jg) { const total = c + (d === 0 ? 0 : BEND) + finish; if (total < bestTotal) { bestTotal = total; goal = k; } }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d ^ 1)) continue; // no turning back
      const dir = must(DIRS[nd]), ni = i + dir[0], nj = j + dir[1];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      if (++steps > BUDGET) { if (goal < 0) return undefined; over = true; break; } // over the budget: the way found so far (not proved the best), or none
      if (blockedPt[nj * nx + ni] || stepBlocked(i, j, nd)) continue;
      const ck = key(i, j, nd);
      let sc = must(cached[ck]);
      if (sc < 0) { sc = stepCost({x: must(X[i]), y: must(Y[j])}, {x: must(X[ni]), y: must(Y[nj])}); cached[ck] = sc; }
      const nc = c + sc + (nd === d ? 0 : BEND), nk = key(ni, nj, nd);
      if (nc < must(dist[nk])) { dist[nk] = nc; prev[nk] = k; push(nc + left(ni, nj), nk); }
    }
    if (over) break;
  }
  if (goal < 0) return undefined;
  const pts: P[] = [];
  for (let k = goal; k >= 0; k = prev[k] ?? -1) { const cell = (k - (k % 4)) / 4, i = cell % nx; pts.push({x: must(X[i]), y: must(Y[(cell - i) / nx])}); }
  pts.reverse();
  return [start, ...pts, end];
}
