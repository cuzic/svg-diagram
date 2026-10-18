// The way around the boxes with the fewest bends, for one long arrow of a layered layout (layered-route.ts). Pure geometry in the layout's own
// axes (layers run along x): a search over the grid of lines that run beside the boxes, so a long arrow turns where there is room, not half-way
// between the way points of the layering.
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
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * A polyline from `start` to `end` (both on box sides; the arrow runs toward larger x) that keeps `margin` off every box in `boxes`, stays in `bounds`, and costs least in
 * length, bends, crossings of `others` and runs along them. Undefined when there is none.
 */
export function searchRoute(start: P, end: P, boxes: readonly Rect[], others: readonly P[][], bounds: Rect, o: SearchOpts = {}): P[] | undefined {
  const m = o.margin ?? 8, stub = o.stub ?? 18, tail = o.tail ?? 26, BEND = o.bend ?? 30, CROSS = o.cross ?? 25, ALONG = o.along ?? 200;
  const s = {x: start.x + stub, y: start.y}, g = {x: end.x - tail, y: end.y};
  if (g.x < s.x) return undefined;
  const xs = new Set<number>([s.x, g.x]), ys = new Set<number>([s.y, g.y, bounds.y + m, bounds.y + bounds.h - m]);
  for (const b of boxes) { xs.add(b.x - m); xs.add(b.x + b.w + m); ys.add(b.y - m); ys.add(b.y + b.h + m); }
  const X = [...xs].filter(x => x >= s.x - 0.01 && x <= g.x + 0.01 && x >= bounds.x && x <= bounds.x + bounds.w).sort((a, b) => a - b);
  const Y = [...ys].filter(y => y >= bounds.y && y <= bounds.y + bounds.h).sort((a, b) => a - b);
  const xi = new Map(X.map((x, i) => [x, i])), yi = new Map(Y.map((y, i) => [y, i]));
  if (!xi.has(s.x) || !yi.has(s.y) || !xi.has(g.x) || !yi.has(g.y)) return undefined;
  const inside = (x: number, y: number): boolean => boxes.some(b => x > b.x - m + 0.01 && x < b.x + b.w + m - 0.01 && y > b.y - m + 0.01 && y < b.y + b.h + m - 0.01);
  const crossesBox = (a: P, b: P): boolean => boxes.some(r => Math.max(a.x, b.x) > r.x - m + 0.01 && Math.min(a.x, b.x) < r.x + r.w + m - 0.01 && Math.max(a.y, b.y) > r.y - m + 0.01 && Math.min(a.y, b.y) < r.y + r.h + m - 0.01);
  const segs = others.flatMap(p => p.slice(1).map((q, k) => [p[k], q] as const));
  const stepCost = (a: P, b: P): number => {
    let c = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const h = a.y === b.y;
    for (const [p, q] of segs) {
      const ph = p.y === q.y;
      if (ph === h) { // along: the same line (within 4px), overlapping
        const [u, v] = h ? ['x', 'y'] as const : ['y', 'x'] as const;
        if (Math.abs(p[v] - a[v]) < 4 && Math.min(Math.max(a[u], b[u]), Math.max(p[u], q[u])) - Math.max(Math.min(a[u], b[u]), Math.min(p[u], q[u])) > 1) c += ALONG;
      } else { // a crossing, strictly inside both
        const [hs, ve] = h ? [[a, b], [p, q]] : [[p, q], [a, b]];
        const x = ve[0].x, y = hs[0].y;
        if (x > Math.min(hs[0].x, hs[1].x) + 0.5 && x < Math.max(hs[0].x, hs[1].x) - 0.5 && y > Math.min(ve[0].y, ve[1].y) + 0.5 && y < Math.max(ve[0].y, ve[1].y) - 0.5) c += CROSS;
      }
    }
    return c;
  };
  // Dijkstra over (column, row, direction)
  const nx = X.length, ny = Y.length, key = (i: number, j: number, d: number): number => (j * nx + i) * 4 + d;
  const dist = new Float64Array(nx * ny * 4).fill(Infinity), prev = new Int32Array(nx * ny * 4).fill(-1);
  const heap: [number, number][] = []; // [cost, key]
  const push = (c: number, k: number): void => { heap.push([c, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = (): [number, number] => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m2 = i; if (l < heap.length && heap[l][0] < heap[m2][0]) m2 = l; if (r < heap.length && heap[r][0] < heap[m2][0]) m2 = r; if (m2 === i) break; [heap[m2], heap[i]] = [heap[i], heap[m2]]; i = m2; } } return top; };
  const i0 = xi.get(s.x)!, j0 = yi.get(s.y)!, ig = xi.get(g.x)!, jg = yi.get(g.y)!;
  const k0 = key(i0, j0, 0);
  dist[k0] = stepCost(start, s); push(dist[k0], k0);
  let goal = -1;
  while (heap.length) {
    const [c, k] = pop();
    if (c > dist[k]) continue;
    const d = k % 4, cell = (k - d) / 4, i = cell % nx, j = (cell - i) / nx;
    if (i === ig && j === jg) { goal = k; dist[k] = c + (d === 0 ? 0 : BEND); break; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d ^ 1)) continue; // no turning back
      const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const a = {x: X[i], y: Y[j]}, b = {x: X[ni], y: Y[nj]};
      if (inside(b.x, b.y) || crossesBox(a, b)) continue;
      const nc = c + stepCost(a, b) + (nd === d ? 0 : BEND), nk = key(ni, nj, nd);
      if (nc < dist[nk]) { dist[nk] = nc; prev[nk] = k; push(nc, nk); }
    }
  }
  if (goal < 0) return undefined;
  const pts: P[] = [];
  for (let k = goal; k >= 0; k = prev[k]) { const cell = (k - (k % 4)) / 4, i = cell % nx; pts.push({x: X[i], y: Y[(cell - i) / nx]}); }
  pts.reverse();
  return [start, ...pts, end];
}
