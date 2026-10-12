// Orthogonal routing of the edges of a layered layout (graph-layout.ts layoutLayered), shared by stateDiagram() and classDiagram().
// Everything here is in the layout's own ('right') axes: layers run along x. `place` moves a point into the figure (and transposes
// it for a 'down' diagram).
import type {LayeredLayout, Pt} from './graph-layout.ts';

export const STUB = 18;
export const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export const gapFor = (n: number, chip = 0): number => Math.max(2 * STUB + LANE * Math.max(0, n - 1) + 16, chip + STUB + 26);
const same = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/**
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). A direct arrow turns `STUB + lane` after
 * its tail, which leaves a long straight run into the head for its label; `lane` keeps arrows through one gap apart.
 */
export function elbows(pts: Pt[], lane: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.y !== q.y) {
      const mx = pts.length === 2 ? p.x + Math.sign(q.x - p.x || 1) * Math.min(STUB + lane, Math.abs(q.x - p.x) / 2) : (p.x + q.x) / 2;
      out.push({x: mx, y: p.y}, {x: mx, y: q.y});
    }
    out.push(q);
  }
  return simplify(out);
}


/**
 * The polyline of every non-self edge (by its index in `lay.edges`), from the tail's box edge to the head's.
 * ports: the edges that meet one side of a box fan out along it (ordered by where the other end is, so they do not cross);
 * lanes: direct arrows through one gap between two layers take separate vertical runs.
 */
export function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14): Map<number, Pt[]> {
  // ports: the edges that meet one side of a state fan out along it (ordered by where the other end is, so they do not cross)
  // lanes: direct arrows through one gap between two layers take separate vertical runs
  const portOf = new Map<string, number>(), laneOf = new Map<number, number>();
  const ends: {key: string; edge: number; end: 0 | 1; other: number}[] = [];
  const corridors = new Map<string, number[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    ends.push({key: `${e.from}:${first.x >= ca.x ? 'r' : 'l'}`, edge: i, end: 0, other: first.y}, {key: `${e.to}:${last.x <= cb.x ? 'l' : 'r'}`, edge: i, end: 1, other: last.y});
    if (e.points.length === 2) { // direct arrows through one gap between two layers, in groups that go down / go up
      const k = `${Math.round(Math.min(ca.x, cb.x))}:${Math.round(Math.max(ca.x, cb.x))}:${cb.y >= ca.y ? 'd' : 'u'}`;
      corridors.set(k, [...(corridors.get(k) ?? []), i]);
    }
  });
  const byKey = new Map<string, typeof ends>();
  for (const en of ends) byKey.set(en.key, [...(byKey.get(en.key) ?? []), en]);
  for (const list of byKey.values()) {
    list.sort((p, q) => p.other - q.other || p.edge - q.edge);
    list.forEach((en, k) => {
      const e = lay.edges[en.edge], id = en.end === 0 ? e.from : e.to, h = lay.nodes.get(id)!.h;
      const step = list.length > 1 ? Math.min(portStep, (h - 12) / (list.length - 1)) : 0;
      portOf.set(`${en.edge}:${en.end}`, (k - (list.length - 1) / 2) * step);
    });
  }
  // the arrow that goes farthest turns first (the lane nearest its tail), so no vertical run crosses another arrow's last run
  const dy = (i: number): number => { const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return Math.abs((B.y + B.h / 2) - (A.y + A.h / 2)); };
  for (const list of corridors.values()) [...list].sort((p, q) => dy(q) - dy(p) || p - q).forEach((i, k) => laneOf.set(i, k * LANE));
  const out = new Map<number, Pt[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get(`${i}:0`) ?? 0)};
    const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get(`${i}:1`) ?? 0)};
    out.set(i, elbows([start, ...e.points.slice(1, -1), end], laneOf.get(i) ?? 0).map(place));
  });
  return out;
}
