// Orthogonal routing of the edges of a layered layout (graph-layout.ts layoutLayered), shared by stateDiagram() and classDiagram().
// Everything here is in the layout's own ('right') axes: layers run along x. `place` moves a point into the figure (and transposes
// it for a 'down' diagram).
import {layoutLayered} from './graph-layout.ts';
import type {LayeredEdge, LayeredLayout, LayeredNode, LayeredOpts, Pt} from './graph-layout.ts';

import {must} from './must.ts';
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
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). A direct arrow turns at `turn` (an x in the gap
 * between its two layers, from routeLayered); the others turn half-way between their points.
 */
export function elbows(pts: Pt[], turn?: number, lastTurn?: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.y !== q.y) {
      const mx = pts.length === 2 && turn !== undefined ? turn : i + 2 === pts.length && lastTurn !== undefined ? lastTurn : (p.x + q.x) / 2;
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
export function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14, groupOf?: (edge: number) => number | undefined): Map<number, Pt[]> {
  // ports: the edges that meet one side of a state fan out along it (ordered by where the other end is, so they do not cross)
  // lanes: direct arrows through one gap between two layers take separate vertical runs
  const portOf = new Map<string, number>(), laneOf = new Map<number, number>();
  // the gap between layer l and l+1 runs from the right edge of the widest box of l to the left edge of the leftmost box of l+1
  const layerOf = (id: string): number => must(lay.layers.get(id));
  const layerRight = new Map<number, number>(), layerLeft = new Map<number, number>();
  for (const [id, n] of lay.nodes) {
    const l = layerOf(id);
    if (l === undefined) continue;
    layerRight.set(l, Math.max(layerRight.get(l) ?? -Infinity, n.x + n.w));
    layerLeft.set(l, Math.min(layerLeft.get(l) ?? Infinity, n.x));
  }
  const ends: {key: string; edge: number; end: 0 | 1; other: number}[] = [];
  const corridors = new Map<string, number[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)), ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    ends.push({key: `${e.from}:${first.x >= ca.x ? 'r' : 'l'}`, edge: i, end: 0, other: first.y}, {key: `${e.to}:${last.x <= cb.x ? 'l' : 'r'}`, edge: i, end: 1, other: last.y});
    if (e.points.length === 2) { // direct arrows through one gap between two layers, in groups that go down / go up
      const k = `${Math.round(Math.min(ca.x, cb.x))}:${Math.round(Math.max(ca.x, cb.x))}`;
      corridors.set(k, [...(corridors.get(k) ?? []), i]);
    }
  });
  const byKey = new Map<string, typeof ends>();
  for (const en of ends) byKey.set(en.key, [...(byKey.get(en.key) ?? []), en]);
  for (const list of byKey.values()) {
    // the arrows of one group (an AND) arrive side by side: they sort by where the group as a whole comes from, then among themselves
    const mean = new Map<number, number>(), count = new Map<number, number>();
    if (groupOf) {
      for (const en of list) { const g = en.end === 1 ? groupOf(en.edge) : undefined; if (g !== undefined) { mean.set(g, (mean.get(g) ?? 0) + en.other); count.set(g, (count.get(g) ?? 0) + 1); } }
      for (const [g, n] of count) mean.set(g, must(mean.get(g)) / n);
    }
    const key = (en: typeof list[number]): number => (en.end === 1 && groupOf && groupOf(en.edge) !== undefined ? must(mean.get(must(groupOf(en.edge)))) : en.other);
    list.sort((p, q) => key(p) - key(q) || (p.end === 1 && groupOf ? (groupOf(p.edge) ?? -1) - (groupOf(q.edge) ?? -1) : 0) || p.other - q.other || p.edge - q.edge);
    list.forEach((en, k) => {
      const e = lay.edges[en.edge], id = en.end === 0 ? e.from : e.to, h = must(lay.nodes.get(id)).h;
      const step = list.length > 1 ? Math.min(portStep, (h - 12) / (list.length - 1)) : 0;
      // the ports of one side keep an even step (a tail and a head on one side are never closer than a step). The ports of every box's
      // left side sit half a step lower than those of its right side: a tail port of one box and a head port of the next (same layer
      // pair) otherwise share a height and their runs line up as one line. A lone port stays in the middle (a straight arrow stays straight).
      const room = h / 2 - 6, span = (list.length - 1) / 2 * step; // how far the outer ports are from the middle
      const slack = Math.min(step / 2, room - span); // as much of half a step as still keeps the whole side inside the box
      const lower = en.key.endsWith(':l') && list.length > 1 && slack >= 3 ? slack : 0;
      portOf.set(`${en.edge}:${en.end}`, (k - (list.length - 1) / 2) * step + lower);    });
  }
  // fan-out (one tail): the arrow that goes farthest turns first (the lane nearest the tail), so no vertical run crosses another arrow's
  // last run. fan-in (one head, several tails): the other way round, the nearest tail turns first.
  const dy = (i: number): number => { const e = lay.edges[i], A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)); return Math.abs((B.y + B.h / 2) - (A.y + A.h / 2)); };
  // arrows that go down and arrows that go up through the same gap are told apart too: the up group takes the lanes after the down group's
  const goesDown = (i: number): boolean => { const e = lay.edges[i], A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)); return B.y + B.h / 2 >= A.y + A.h / 2; };
  // forward arrows (tail in the earlier layer) take lanes counted from the gap's left side, backward arrows (a return) from its right side,
  // so the two kinds never land on one lane (the gap is sized for all of them together, see gapFor)
  const forward = (i: number): boolean => layerOf(must(lay.edges[i]).from) < layerOf(must(lay.edges[i]).to);
  for (const all of corridors.values()) {
    for (const group of [all.filter(forward), all.filter(i => !forward(i))]) {
      let k = 0;
      for (const list of [group.filter(goesDown), group.filter(i => !goesDown(i))]) {
        const fanIn = new Set(list.map(i => must(lay.edges[i]).to)).size === 1 && new Set(list.map(i => must(lay.edges[i]).from)).size > 1;
        for (const i of [...list].sort((p, q) => (fanIn ? dy(p) - dy(q) : dy(q) - dy(p)) || p - q)) laneOf.set(i, k++ * LANE);
      }
    }
  }
  const out = new Map<number, Pt[]>();
  const longInto = new Map<string, number>(); // long arrows into one head, each with its own last turn
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)), ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get(`${i}:0`) ?? 0)};
    const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get(`${i}:1`) ?? 0)};
    // a direct arrow turns in a lane: a place in the gap between its two layers (from the left side for a forward arrow, from the right
    // side for a return), whatever the widths of the boxes it leaves and enters
    let turn: number | undefined;
    if (e.points.length === 2) {
      const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = must(layerRight.get(lo)), gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB, gw = gr - gl;
      const d = Math.min(STUB + (laneOf.get(i) ?? 0), Math.max(gw / 2, gw - 22)); // the last run keeps room for the arrowhead
      turn = forward(i) ? gl + d : gr - d;
    }
    // a long arrow into a grouped head (an AND) makes its last turn a fixed distance before the head, clear of the lanes of the direct arrows
    // (which are counted from the gap's left side), so the two kinds never run side by side
    let lastTurn: number | undefined;
    if (groupOf && e.points.length > 2 && forward(i)) {
      const lo = layerOf(e.to) - 1, gl = layerRight.get(lo), gr = layerLeft.get(lo + 1);
      if (gl !== undefined && gr !== undefined) { const k = longInto.get(e.to) ?? 0; longInto.set(e.to, k + 1); lastTurn = Math.max(gl + STUB, gr - 26 - k * LANE); }
    }
    out.set(i, elbows([start, ...e.points.slice(1, -1), end], turn, lastTurn).map(place));
  });
  return out;
}

/** The most direct arrows that pass through one gap between two layers (each needs its own lane there). */
export function corridorLoad(lay: LayeredLayout): number {
  const load = new Map<string, number>();
  for (const e of lay.edges) {
    if (e.self || e.points.length !== 2) continue;
    const A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to));
    const k = `${Math.round(Math.min(A.x + A.w / 2, B.x + B.w / 2))}:${Math.round(Math.max(A.x + A.w / 2, B.x + B.w / 2))}`; // the same key as routeLayered's corridors: layers by their centres
    load.set(k, (load.get(k) ?? 0) + 1);
  }
  return Math.max(1, ...load.values());
}

/**
 * layoutLayered, with the gap between layers wide enough for the arrows that share it: laid out once to see how many arrows go
 * through each gap (layers do not depend on the gap), then again with a gap that gives each its own lane.
 */
export function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]}, chip = 0): LayeredLayout {
  const first = layoutLayered(nodes, edges, opts);
  const need = gapFor(corridorLoad(first), chip);
  return need > (opts.levelGap ?? 0) ? layoutLayered(nodes, edges, {...opts, levelGap: need}) : first;
}
