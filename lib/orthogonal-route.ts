// An orthogonal route that keeps clear of boxes, found by search: the last resort of a router that tries a fixed list of
// shapes (bpmn.ts). The search runs on the grid made by the boxes' (inflated) edges and the given hint lines, so it finds a
// route whenever the boxes leave a channel open; it prefers few bends, short runs and not riding on other flows.
import type {Pt} from './graph-layout.ts';

export interface RouteRect {x: number; y: number; w: number; h: number}
export interface RouteOpts {
  from: RouteRect; to: RouteRect;
  /** every box the route must keep out of (the two ends included) */
  boxes: RouteRect[];
  /** the figure: the route stays inside it */
  bounds: RouteRect;
  /** flows already drawn: crossing one costs a little, riding along one costs a lot */
  others?: Pt[][];
  /** lines the route may turn on besides the boxes' edges (the gaps between columns, the margins of lanes) */
  xs?: number[]; ys?: number[];
  /** clearance from a box (default 6) and length of the straight run into / out of a box (default 14) */
  margin?: number; stub?: number;
}

const BEND = 30, CROSS = 25, RIDE = 150;
type Dir = 0 | 1 | 2 | 3; // right, down, left, up
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

function ports(r: RouteRect, stub: number): {edge: Pt; out: Pt; dir: Dir}[] {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return [
    {edge: {x: r.x + r.w, y: cy}, out: {x: r.x + r.w + stub, y: cy}, dir: 0},
    {edge: {x: cx, y: r.y + r.h}, out: {x: cx, y: r.y + r.h + stub}, dir: 1},
    {edge: {x: r.x, y: cy}, out: {x: r.x - stub, y: cy}, dir: 2},
    {edge: {x: cx, y: r.y}, out: {x: cx, y: r.y - stub}, dir: 3},
  ];
}

/** The cheapest route from a side of `from` to a side of `to` that touches no other box, or null when the boxes close every way. */
export function routeClear(o: RouteOpts): Pt[] | null {
  const m = o.margin ?? 6, stub = o.stub ?? 14, b = o.bounds;
  const solid = o.boxes.map(r => ({x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m}));
  const pa = ports(o.from, stub), pb = ports(o.to, stub);
  const inside = (p: Pt): boolean => solid.some(r => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
  const xset = new Set<number>(), yset = new Set<number>();
  const addX = (v: number): void => { if (v >= b.x && v <= b.x + b.w) xset.add(Math.round(v * 2) / 2); };
  const addY = (v: number): void => { if (v >= b.y && v <= b.y + b.h) yset.add(Math.round(v * 2) / 2); };
  for (const r of solid) { addX(r.x); addX(r.x + r.w); addY(r.y); addY(r.y + r.h); }
  for (const p of [...pa, ...pb]) { addX(p.out.x); addY(p.out.y); }
  for (const v of o.xs ?? []) addX(v);
  for (const v of o.ys ?? []) addY(v);
  addX(b.x + 2); addX(b.x + b.w - 2); addY(b.y + 2); addY(b.y + b.h - 2);
  const xs = [...xset].sort((p, q) => p - q), ys = [...yset].sort((p, q) => p - q);
  const nx = xs.length, ny = ys.length, X = (i: number): number => xs[i] ?? 0, Y = (j: number): number => ys[j] ?? 0;
  const free = Array.from({length: nx * ny}, (_, k) => !inside({x: X(k % nx), y: Y(Math.floor(k / nx))}));
  // a run between two neighbouring grid points: blocked by a box it cuts, dearer for the flows it crosses or rides on
  const step = (i: number, j: number, d: Dir): number | null => {
    const i2 = i + DX[d]!, j2 = j + DY[d]!;
    if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny || !free[j2 * nx + i2]) return null;
    const x1 = Math.min(X(i), X(i2)), x2 = Math.max(X(i), X(i2)), y1 = Math.min(Y(j), Y(j2)), y2 = Math.max(Y(j), Y(j2)), horiz = d % 2 === 0;
    if (solid.some(r => horiz ? r.y < y1 && y1 < r.y + r.h && x1 < r.x + r.w && x2 > r.x : r.x < x1 && x1 < r.x + r.w && y1 < r.y + r.h && y2 > r.y)) return null;
    let cost = x2 - x1 + y2 - y1;
    for (const e of o.others ?? []) for (let k = 1; k < e.length; k++) {
      const p = e[k - 1]!, q = e[k]!, ph = p.y === q.y, ex1 = Math.min(p.x, q.x), ex2 = Math.max(p.x, q.x), ey1 = Math.min(p.y, q.y), ey2 = Math.max(p.y, q.y);
      if (ph === horiz) { if ((horiz ? p.y === y1 : p.x === x1) && (horiz ? Math.min(x2, ex2) - Math.max(x1, ex1) : Math.min(y2, ey2) - Math.max(y1, ey1)) > 0) cost += RIDE; }
      else if (horiz ? ex1 > x1 && ex1 < x2 && y1 > ey1 && y1 < ey2 : ey1 > y1 && ey1 < y2 && x1 > ex1 && x1 < ex2) cost += CROSS;
    }
    return cost;
  };
  const at = (p: Pt): [number, number] => [xs.indexOf(Math.round(p.x * 2) / 2), ys.indexOf(Math.round(p.y * 2) / 2)];
  // Dijkstra over (grid point, direction of the last run); the sources are the four sides of `from`, leaving outward
  const key = (i: number, j: number, d: number): number => (j * nx + i) * 4 + d;
  const dist = new Map<number, number>(), prev = new Map<number, number>(), srcPort = new Map<number, number>();
  const queue: [number, number][] = [];
  pa.forEach((p, k) => { const [i, j] = at(p.out); if (i < 0 || j < 0 || !free[j * nx + i]) return; dist.set(key(i, j, p.dir), 0); srcPort.set(key(i, j, p.dir), k); queue.push([0, key(i, j, p.dir)]); });
  const goal = new Map<number, number>(); // the grid point in front of a side of `to` -> that side
  pb.forEach((p, k) => { const [i, j] = at(p.out); if (i >= 0 && j >= 0 && free[j * nx + i]) goal.set(j * nx + i, k); });
  let best: {k: number; cost: number} | null = null;
  while (queue.length) {
    queue.sort((p, q) => q[0] - p[0]);
    const [c, s] = queue.pop()!;
    if (c > (dist.get(s) ?? Infinity)) continue;
    if (best && c >= best.cost) break;
    const d = (s % 4) as Dir, cell = Math.floor(s / 4), i = cell % nx, j = Math.floor(cell / nx);
    if (goal.has(cell)) { const side = pb[goal.get(cell)!]!; const tc = c + (d === (side.dir + 2) % 4 ? 0 : BEND); if (!best || tc < best.cost) best = {k: s, cost: tc}; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;
      const w = step(i, j, nd as Dir); if (w === null) continue;
      const k2 = key(i + DX[nd]!, j + DY[nd]!, nd), c2 = c + w + (nd === d ? 0 : BEND);
      if (c2 < (dist.get(k2) ?? Infinity)) { dist.set(k2, c2); prev.set(k2, s); queue.push([c2, k2]); }
    }
  }
  if (!best) return null;
  const path: Pt[] = [];
  let s: number | undefined = best.k, first = s;
  for (; s !== undefined; s = prev.get(s)) { first = s; const cell = Math.floor(s / 4); path.push({x: X(cell % nx), y: Y(Math.floor(cell / nx))}); }
  path.reverse();
  const end = pb[goal.get(Math.floor(best.k / 4))!]!, start = pa[srcPort.get(first)!]!;
  return [start.edge, ...path, end.edge];
}
