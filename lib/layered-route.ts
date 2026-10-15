// Orthogonal routing of the edges of a layered layout (graph-layout.ts layoutLayered), shared by stateDiagram() and classDiagram().
// Everything here is in the layout's own ('right') axes: layers run along x. `place` moves a point into the figure (and transposes
// it for a 'down' diagram).
import {layoutLayered} from './graph-layout.ts';
import type {LayeredEdge, LayeredLayout, LayeredNode, LayeredOpts, Pt} from './graph-layout.ts';
import {scoreOf, simplify} from './polyline-metrics.ts';

export {simplify};

export const STUB = 18;
export const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export const gapFor = (n: number, chip = 0): number => Math.max(2 * STUB + LANE * Math.max(0, n - 1) + 16, chip + STUB + 26);
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
  const layerOf = (id: string): number => lay.layers.get(id)!;
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
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
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
      for (const [g, n] of count) mean.set(g, mean.get(g)! / n);
    }
    const key = (en: typeof list[number]): number => (en.end === 1 && groupOf && groupOf(en.edge) !== undefined ? mean.get(groupOf(en.edge)!)! : en.other);
    list.sort((p, q) => key(p) - key(q) || (p.end === 1 && groupOf ? (groupOf(p.edge) ?? -1) - (groupOf(q.edge) ?? -1) : 0) || p.other - q.other || p.edge - q.edge);
    list.forEach((en, k) => {
      const e = lay.edges[en.edge], id = en.end === 0 ? e.from : e.to, h = lay.nodes.get(id)!.h;
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
  const dy = (i: number): number => { const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return Math.abs((B.y + B.h / 2) - (A.y + A.h / 2)); };
  // arrows that go down and arrows that go up through the same gap are told apart too: the up group takes the lanes after the down group's
  const goesDown = (i: number): boolean => { const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return B.y + B.h / 2 >= A.y + A.h / 2; };
  // forward arrows (tail in the earlier layer) take lanes counted from the gap's left side, backward arrows (a return) from its right side,
  // so the two kinds never land on one lane (the gap is sized for all of them together, see gapFor)
  const forward = (i: number): boolean => layerOf(lay.edges[i].from) < layerOf(lay.edges[i].to);
  for (const all of corridors.values()) {
    for (const group of [all.filter(forward), all.filter(i => !forward(i))]) {
      let k = 0;
      for (const list of [group.filter(goesDown), group.filter(i => !goesDown(i))]) {
        const fanIn = new Set(list.map(i => lay.edges[i].to)).size === 1 && new Set(list.map(i => lay.edges[i].from)).size > 1;
        for (const i of [...list].sort((p, q) => (fanIn ? dy(p) - dy(q) : dy(q) - dy(p)) || p - q)) laneOf.set(i, k++ * LANE);
      }
    }
  }
  // returns in an outer lane (graph-layout.ts `outer`): each turns in the gap before its tail's layer and in the gap after its head's layer,
  // past the lanes of the direct arrows there (a tail counts from the gap's right side, a head from its left side)
  const gapBack = new Map<number, number>(), gapFwd = new Map<number, number>(), tailAt = new Map<number, number>(), headAt = new Map<number, number>();
  for (const e of lay.edges) {
    if (e.self || e.points.length !== 2) continue;
    const l1 = layerOf(e.from), l2 = layerOf(e.to), g = Math.min(l1, l2), m = l1 < l2 ? gapFwd : gapBack;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  const outerTurns = new Map<number, {tail: number; head: number}>();
  lay.edges.forEach((e, i) => {
    if (!e.outer) return;
    const gt = layerOf(e.from) - 1, gh = layerOf(e.to), kt = tailAt.get(gt) ?? 0, kh = headAt.get(gh) ?? 0;
    tailAt.set(gt, kt + 1); headAt.set(gh, kh + 1);
    outerTurns.set(i, {
      tail: (layerLeft.get(gt + 1) ?? 0) - STUB - ((gapBack.get(gt) ?? 0) + kt) * LANE,
      head: (layerRight.get(gh) ?? 0) + STUB + ((gapFwd.get(gh) ?? 0) + kh) * LANE,
    });
  });
  const out = new Map<number, Pt[]>();
  const longInto = new Map<string, number>(); // long arrows into one head, each with its own last turn
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get(`${i}:0`) ?? 0)};
    const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get(`${i}:1`) ?? 0)};
    const turns = outerTurns.get(i);
    if (turns) { // out of the tail's left side, out to the lane, back along it, into the head's right side
      const lane = e.points[1].y;
      out.set(i, simplify([start, {x: turns.tail, y: start.y}, {x: turns.tail, y: lane}, {x: turns.head, y: lane}, {x: turns.head, y: end.y}, end]).map(place));
      return;
    }
    // a direct arrow turns in a lane: a place in the gap between its two layers (from the left side for a forward arrow, from the right
    // side for a return), whatever the widths of the boxes it leaves and enters
    let turn: number | undefined;
    if (e.points.length === 2) {
      const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = layerRight.get(lo)!, gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB, gw = gr - gl;
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
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!;
    const k = `${Math.round(Math.min(A.x + A.w / 2, B.x + B.w / 2))}:${Math.round(Math.max(A.x + A.w / 2, B.x + B.w / 2))}`; // the same key as routeLayered's corridors: layers by their centres
    load.set(k, (load.get(k) ?? 0) + 1);
  }
  // the turns of the returns in an outer lane sit in the gaps too, beside the direct arrows
  const direct = new Map<number, number>(), outerIn = new Map<number, number>();
  for (const e of lay.edges) {
    if (e.self) continue;
    const l1 = lay.layers.get(e.from)!, l2 = lay.layers.get(e.to)!;
    if (e.outer) for (const g of [l1 - 1, l2]) outerIn.set(g, (outerIn.get(g) ?? 0) + 1);
    else if (e.points.length === 2) direct.set(Math.min(l1, l2), (direct.get(Math.min(l1, l2)) ?? 0) + 1);
  }
  return Math.max(1, ...load.values(), ...[...outerIn].map(([g, n]) => n + (direct.get(g) ?? 0)));
}

/**
 * layoutLayered, with the gap between layers wide enough for the arrows that share it: laid out once to see how many arrows go
 * through each gap (layers do not depend on the gap), then again with a gap that gives each its own lane.
 */
export function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]; back?: readonly number[]}, chip = 0): LayeredLayout {
  const first = layoutLayered(nodes, edges, opts);
  const need = gapFor(corridorLoad(first), chip);
  return need > (opts.levelGap ?? 0) ? layoutLayered(nodes, edges, {...opts, levelGap: need}) : first;
}

// ---- one attempt ------------------------------------------------------------------------------------------------------------

/** What the callers of layeredAttempt decide: how a point of the layout's own axes lands in the figure, and what counts as a width. */
export interface AttemptOpts {
  /** The step between arrows that meet one side of a box (routeLayered's `portStep`). */
  portStep?: number;
  /** The group of an input edge (by its index in `edges`): the arrows of one group (an AND) get one corridor (routeLayered's `groupOf`). */
  groupOf?: (edge: number) => number | undefined;
  /** The figure is the layout transposed (a vertical one): `size` swaps width and height. */
  transpose?: boolean;
  /** The widest the figure may be; `fits` says whether it is. Nothing is thrown here: the caller decides what a miss means. */
  maxAcross?: number;
  /** Moves a point of the layout's own axes into the figure; it may depend on the figure's size, hence a function of it. */
  place: (size: {w: number; h: number}) => (p: Pt) => Pt;
  /** Ids of the ANDs (or other groups) the routes leave undrawable. */
  looseOf?: (routes: Map<number, Pt[]>, lay: LayeredLayout) => string[];
  /** false: the plain layout only, no second candidate (the way back to the old figure). Default true. */
  straighten?: boolean;
  /** The second candidate also pulls source nodes toward their targets (graph-layout.ts `tighten`). Default false: a cause tree reads its causes at the first layer. */
  tighten?: boolean;
  /** Returns two layers or more long run in lanes outside the figure: 'all' of them, or only the 'declared' ones (`back`). Default none (through the layers). */
  returns?: 'all' | 'declared';
}

export interface Attempt {
  lay: LayeredLayout;
  routes: Map<number, Pt[]>;
  /** Corners and crossings of the routed arrows (placed points); lower is better. */
  score: {crossings: number; bends: number};
  /** The figure's width and height (transposed back when `transpose`). */
  size: {w: number; h: number};
  /** Whether `size.w` is within `maxAcross` (true when none is given). */
  fits: boolean;
  loose: string[];
}

/** How many arrows run through the inside of a box that is not one of their two ends (the boxes and routes are in the placed figure). */
function piercings(a: Attempt, place: (p: Pt) => Pt): number {
  const rects = new Map<string, {x0: number; x1: number; y0: number; y1: number}>();
  for (const [id, n] of a.lay.nodes) {
    const p = place({x: n.x, y: n.y}), q = place({x: n.x + n.w, y: n.y + n.h});
    rects.set(id, {x0: Math.min(p.x, q.x) + 1, x1: Math.max(p.x, q.x) - 1, y0: Math.min(p.y, q.y) + 1, y1: Math.max(p.y, q.y) - 1});
  }
  let count = 0;
  for (const [i, pts] of a.routes) {
    const e = a.lay.edges[i];
    for (const [id, r] of rects) {
      if (id === e.from || id === e.to) continue;
      if (pts.slice(1).some((q, k) => { const p = pts[k]; return Math.min(p.x, q.x) < r.x1 && Math.max(p.x, q.x) > r.x0 && Math.min(p.y, q.y) < r.y1 && Math.max(p.y, q.y) > r.y0; })) count++;
    }
  }
  return count;
}

/**
 * One layered layout with its routes, score, size and undrawable groups: the unit the callers (causeTree, stateDiagram, classDiagram,
 * the semantic networks) build a figure from. Two candidates are laid out: the plain one (centre each layer, relax toward the
 * neighbours) and a straightened one (Brandes-Köpf coordinates, crossing-minimal order, optionally tightened layers). The straightened one
 * is dropped when it leaves an AND undrawable that the plain one drew, runs an arrow through a box the plain one did not, or does
 * not fit a width the plain one fits. Of what is left it replaces the plain one only if (crossings, bends) is strictly better in the
 * lexicographic order, or if the plain one does not fit the width and it does. Nothing else moves a figure.
 */
export function layeredAttempt(nodes: LayeredNode[], edges: LayeredEdge[], layoutOpts: LayeredOpts & {start?: string[]; back?: readonly number[]}, o: AttemptOpts): Attempt {
  const build = (opts: typeof layoutOpts): Attempt => {
    const lay = layoutWithLanes(nodes, edges, o.returns ? {...opts, outer: {which: o.returns, gap: STUB, step: LANE}} : opts);
    const size = {w: o.transpose ? lay.h : lay.w, h: o.transpose ? lay.w : lay.h};
    const groupOf = o.groupOf;
    const routes = routeLayered(lay, o.place(size), o.portStep, groupOf && (i => groupOf(lay.edges[i].index)));
    return {lay, routes, score: scoreOf([...routes.values()]), size, fits: o.maxAcross === undefined || size.w <= o.maxAcross, loose: o.looseOf ? o.looseOf(routes, lay) : []};
  };
  const plain = build(layoutOpts);
  if (o.straighten === false || !edges.some(e => e.from !== e.to)) return plain;
  const cand = build({...layoutOpts, coord: 'bk', transpose: true, ...(o.tighten ? {tighten: true} : {})});
  if (cand.loose.length > plain.loose.length) return plain;
  if (piercings(cand, o.place(cand.size)) > piercings(plain, o.place(plain.size))) return plain;
  if (!plain.fits) return cand.fits || cand.size.w < plain.size.w && better(cand.score, plain.score) ? cand : plain;
  if (!cand.fits) return plain;
  return better(cand.score, plain.score) ? cand : plain;
}

/** (crossings, bends) in lexicographic order: strictly better only. */
const better = (a: {crossings: number; bends: number}, b: {crossings: number; bends: number}): boolean => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);
