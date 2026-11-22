// Orthogonal routing of the edges of a layered layout (graph-layout.ts layoutLayered), shared by stateDiagram() and classDiagram().
// Everything here is in the layout's own ('right') axes: layers run along x. `place` moves a point into the figure (and transposes
// it for a 'down' diagram).
import {layoutLayered} from './graph-layout.ts';
import type {LayeredEdge, LayeredEdgeOut, LayeredLayout, LayeredNode, LayeredOpts, Placed, Pt} from './graph-layout.ts';
import {bendsOf, crossingsOf, crossingsOfRuns, crossingsWith, gainsRunPairs, pairsOf, runPairGain, rescore, runsOfPath, runsTogether, scoreOf, simplify} from './polyline-metrics.ts';
import type {RoutedRuns, Runs} from './polyline-metrics.ts';
import {headCrossings, searchRoute} from './route-search.ts';
import {moveApart} from './route-apart.ts';
import {must} from './must.ts';

/** The element of a list at an index the caller knows is inside it. */
const at = <T>(a: readonly T[], i: number): T => must(a[i]);

export {simplify};

export const STUB = 18;
export const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export const gapFor = (n: number, chip = 0, space = 1, scale = 1): number => {
  const unit = space * scale; // ADR 0070 D7: the lines' scale (a cause tree on a canvas) on top of the gaps' (`density`)
  return Math.max(2 * stubOf(unit) + laneStepOf(unit) * Math.max(0, n - 1) + Math.round(16 * unit), chip + stubOf(unit) + Math.round(26 * scale));
};
/** The stub and the lane step at a scale of the gaps (`WrapEnv.space`: 1, or 0.75 for `density: 'compact'`). */
export const stubOf = (space = 1): number => Math.round(STUB * space);
export const laneStepOf = (space = 1): number => Math.round(LANE * space);
/**
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). `turns[k]` is the x where the run from point k to
 * point k + 1 turns (a direct arrow's lane, a long arrow's last turn or its track in a gap, from routeLayered); a run with none turns
 * half-way between its points.
 */
export function elbows(pts: Pt[], turns: readonly (number | undefined)[] = []): Pt[] {
  const out: Pt[] = pts.slice(0, 1);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = must(pts[i]), q = must(pts[i + 1]);
    if (p.y !== q.y) {
      const mx = turns[i] ?? (p.x + q.x) / 2;
      out.push({x: mx, y: p.y}, {x: mx, y: q.y});
    }
    out.push(q);
  }
  return simplify(out);
}


/** A turn across a gap, by the across positions of its two runs along the layers: the one on the gap's left side and the one on its right. */
export interface Legs {left: number; right: number}

/**
 * ADR 0070 D4 (U4b): the order of the turns across one gap (left to right along the layers) that crosses none of them where that can be
 * done. A turn's run along the layers on the gap's left side reaches its track from the left: when it lies within the span of another
 * turn's run across the gap (or under `sep` from it), that other turn must take a track to its right, else its run across crosses it (or
 * the two runs along the layers lie side by side, under `sep` apart).
 * Likewise a run on the right side asks the other turn to take a track to its left. These are the vertical constraints of channel routing;
 * fan-in, fan-out and gaps with arrows into different heads all follow from them. A pair that asks both ways crosses whichever way it
 * goes (no constraint is added for it; other constraints may still put it in either order), and so does a pair whose constraint would close a cycle (the constraints are taken in `rank`'s order
 * of their pairs, and one that closes a cycle is left out). The rest goes by `rank` (the order as it was).
 */
export function constrainedOrder<T>(items: readonly T[], legsOf: (t: T) => Legs, rank: (t: T) => number, sep = 1, memo?: Map<string, number[]>): T[] {
  const n = items.length;
  if (n < 2) return [...items];
  const legs = items.map(legsOf), ranks = items.map(rank);
  // the answer depends on the legs, the ranks and `sep` alone: a caller that asks again and again (the figure is routed again for every trial) passes a `memo`
  const memoKey = memo && `${sep}|${legs.map((l, k) => `${l.left},${l.right},${ranks[k]}`).join(';')}`;
  const known = memoKey === undefined ? undefined : memo?.get(memoKey);
  if (known) return known.map(k => at(items, k));
  const order = orderOf(legs, ranks, sep);
  if (memo && memoKey !== undefined) memo.set(memoKey, order);
  return order.map(k => at(items, k));
}

/** `constrainedOrder` on the turns' legs and ranks: the indexes in the order the turns go. */
function orderOf(legs: readonly Legs[], ranks: readonly number[], sep: number): number[] {
  const n = legs.length;
  const within = (y: number, l: Legs, tol: number): boolean => y > Math.min(l.left, l.right) - tol && y < Math.max(l.left, l.right) + tol;
  // does turn a have to come before turn b (a's left run in b's span, or b's right run in a's span; never by a run on the line of the same side's run)
  const first = (a: number, b: number, tol: number): boolean => {
    const la = at(legs, a), lb = at(legs, b);
    return (within(la.left, lb, tol) && Math.abs(la.left - lb.left) >= 0.5) || (within(lb.right, la, tol) && Math.abs(lb.right - la.right) >= 0.5);
  };
  const after = Array.from({length: n}, () => new Set<number>()); // a -> the turns that must come after it
  const reaches = (from: number, to: number): boolean => {
    const seen = new Set([from]), stack = [from];
    while (stack.length) { const x = must(stack.pop()); if (x === to) return true; for (const y of at(after, x)) if (!seen.has(y)) { seen.add(y); stack.push(y); } }
    return false;
  };
  const byRank = legs.map((_t, k) => k).sort((p, q) => at(ranks, p) - at(ranks, q) || p - q);
  const tols = sep > 1 ? [1, sep] : [1];
  // most gaps already go in an order no constraint breaks: then that order is the answer (no cycle to look for)
  const broken = byRank.some((a, x) => {
    for (let y = x + 1; y < n; y++) {
      const b = at(byRank, y);
      if (first(a, b, 1) && first(b, a, 1)) continue;
      if (tols.some(tol => first(b, a, tol) && !first(a, b, tol))) return true;
    }
    return false;
  });
  if (!broken) return byRank;
  // the constraints against a crossing first (a run within the other's span), then those against runs side by side (under `sep` from it)
  for (const tol of tols) {
    for (const [x, a] of byRank.entries()) for (const b of byRank.slice(x + 1)) {
      if (first(a, b, 1) && first(b, a, 1)) continue; // crossing either way
      const ab = first(a, b, tol), ba = first(b, a, tol);
      if (ab === ba) continue; // free, or side by side either way
      const [u, v] = ab ? [a, b] : [b, a];
      if (!at(after, u).has(v) && !reaches(v, u)) at(after, u).add(v);
    }
  }
  // the constraints' order, the earliest by rank first among the turns free to go
  const ins = new Array<number>(n).fill(0);
  for (const s of after) for (const v of s) ins[v] = at(ins, v) + 1;
  const out: number[] = [], done = new Set<number>();
  while (out.length < n) {
    const k = must(byRank.find(j => !done.has(j) && at(ins, j) === 0));
    done.add(k); out.push(k);
    for (const v of at(after, k)) ins[v] = at(ins, v) - 1;
  }
  return out;
}

/**
 * ADR 0073 D3 rule 6: whether a moved tail is kept. (i) (crossings, bends) strictly better; (ii) the new straight line is not along another arrow's run (`along`); (iii) no pair of runs added
 * when no crossing went away (`gains`); (iv) the AND's own arrows do not cross more (`groupGrowth`, the crossings among them after minus before). The checks after (i) are asked only when it holds.
 */
export function tailMoveKept(before: {crossings: number; bends: number}, after: {crossings: number; bends: number}, along: () => boolean, gains: () => boolean, groupGrowth: () => number): boolean {
  if (!(after.crossings < before.crossings || (after.crossings === before.crossings && after.bends < before.bends))) return false;
  return !along() && !gains() && groupGrowth() <= 0;
}

/** The crossings among the arrows of each AND (the arrows of one group into one head), summed: the AND's arc reads wrongly over arrows that cross (ADR 0015). */
function groupCrossings(routes: Map<number, Pt[]>, groupOf?: (edge: number) => number | undefined): number {
  if (!groupOf) return 0;
  const groups = new Map<number, Pt[][]>();
  for (const [i, r] of routes) { const g = groupOf(i); if (g !== undefined) groups.set(g, [...groups.get(g) ?? [], r]); }
  let n = 0;
  for (const rs of groups.values()) n += crossingsOf(rs);
  return n;
}

/** The pairs of arrows with runs along one line (they read as one): what spreading the lanes is for, so it may not make more. */
function alongEach(routes: Map<number, Pt[]>): number {
  const segs = [...routes.values()].map(r => r.slice(1).map((q, k) => ({p: at(r, k), q})));
  // two runs lie together only when they go the same way under 4px apart (runsTogether): each is filed under its across coordinate in 4px buckets,
  // and only the buckets beside its own are looked at (ADR 0053's index, as in route-apart.ts)
  type Seg = {p: Pt; q: Pt};
  const bucketOf = (s: Seg): [string, number] => s.p.y === s.q.y ? ['h', Math.floor(s.p.y / 4)] : ['v', Math.floor(s.p.x / 4)];
  const filed = new Map<string, {x: number; s: Seg}[]>();
  segs.forEach((list, x) => { for (const s of list) { const [kind, b] = bucketOf(s), k = `${kind}${b}`; let l = filed.get(k); if (!l) filed.set(k, l = []); l.push({x, s}); } });
  let n = 0;
  segs.forEach((list, x) => {
    const found = new Set<number>();
    for (const u of list) {
      const [kind, b] = bucketOf(u);
      for (const nb of [b - 1, b, b + 1]) for (const e of filed.get(`${kind}${nb}`) ?? []) if (e.x > x && !found.has(e.x) && runsTogether(u, e.s)) found.add(e.x);
    }
    n += found.size;
  });
  return n;
}

/** Room before the heads (ADR 0070 D3・D8; a cause tree's band only, the others leave it empty and keep the old values). */
export interface HeadRoom {
  /** The shortest last run into a head (direct arrows, the returns' last turn, D13's candidates). Default 22. */
  headRun?: number;
  /** How far before the head a long arrow makes its last turn (`lastTurn`), and the last run of a route found around the boxes (`detour`'s `tail`). Default 26. */
  turnRun?: number;
  /** The ports next to an AND group (between two groups, or a group and another arrow) are two steps apart; the rest keep one step. Default false. */
  andPorts?: boolean;
  /** ADR 0073 D3: the tail of an arrow into an AND's head is moved onto its head's height. Only where `andPorts` is (a cause tree's own band); false switches it off (the order search judges without it). Default true. */
  tailAlign?: boolean;
  /** Tests only: the bits of the hash a gap's stage is remembered by (0: every stage has the same key), to check that a collision plays back nothing. */
  stageHashBits?: number;
}

/**
 * routeOnce twice: with the lanes of a gap at the fixed step, and spread over the room the gap has (`laneIn`). The spread routes are kept
 * only when (crossings, bends) is no worse: the order of the lanes is the same, but where they sit decides which runs cross.
 */
export function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten = true, laneShare = false, aside = false, detour = false, lonePorts = detour, space = 1, laneHeads = false, heads: HeadRoom = {}, tracks = false, scale = 1): Map<number, Pt[]> {
  const fixed = routeOnce(lay, place, portStep, groupOf, round, straighten, laneShare, aside, detour, lonePorts, space, laneHeads, false, heads, tracks, scale);
  const spread = routeOnce(lay, place, portStep, groupOf, round, straighten, laneShare, aside, detour, lonePorts, space, laneHeads, true, heads, tracks, scale);
  const a = scoreOf([...fixed.values()]), b = scoreOf([...spread.values()]);
  // with tracks (ADR 0070 D4), by the placing's own measure: a pair of arrows on one line weighs as one crossing, then the bends. Without, as
  // it always was (the overlaps decide alone, before the crossings)
  if (tracks) {
    // the arrows into the heads of ANDs first (ADR 0070 D4, U4c): the lanes' step moves tracks by a few px, and the AND arrows must not cross each other more than they did
    const xa = groupCrossings(fixed, groupOf), xb = groupCrossings(spread, groupOf);
    if (xa !== xb) return xb < xa ? spread : fixed;
    const ca = a.crossings + alongEach(fixed), cb = b.crossings + alongEach(spread);
    return cb < ca || (cb === ca && b.bends <= a.bends) ? spread : fixed;
  }
  return b.crossings <= a.crossings && b.bends <= a.bends && alongEach(spread) <= alongEach(fixed) ? spread : fixed;
}

/**
 * The polyline of every non-self edge (by its index in `lay.edges`), from the tail's box edge to the head's.
 * ports: the edges that meet one side of a box fan out along it (ordered by where the other end is, so they do not cross);
 * lanes: direct arrows through one gap between two layers take separate vertical runs.
 * straightening (ADR 0016 D3): a direct arrow whose two boxes overlap across the layer axis becomes one straight line when that does not make
 * the drawing worse; `round` names the nodes that are not rectangles (a circle, a hexagon), whose arrows keep to the middle of the side.
 */
function routeOnce(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten = true, laneShare = false, aside = false, detour = false, lonePorts = detour, space = 1, laneHeads = false, spread = true, heads: HeadRoom = {}, tracks = false, scale = 1): Map<number, Pt[]> {
  // ADR 0070 D7: `unit` is the scale of every distance between lines (the gaps' scale `space` times the lines' `scale`, a cause tree on a canvas:
  // 1 elsewhere). The stub, the lane step and the 16 beside the lanes already had `space`; the bare numbers below (`sc`) take `scale` alone, so
  // that a figure with no canvas keeps its old numbers under `density: 'compact'` too
  const unit = space * scale, sc = (n: number): number => Math.round(n * scale);
  const STUB = stubOf(unit), LANE = laneStepOf(unit); // this figure's stub and lane step (they shadow the module's)
  // the last run into a head keeps room for the arrowhead (22; a long arrow's last turn 26). A head that an AND arrives at keeps the room
  // its arc needs (`heads`, ADR 0070 D8); the other heads keep the old room
  const andHeads = new Set<string>();
  if (groupOf) lay.edges.forEach((e, i) => { if (!e.self && groupOf(i) !== undefined) andHeads.add(e.to); });
  const headRunOf = (to: string): number => andHeads.has(to) ? heads.headRun ?? 22 : 22;
  const turnRunOf = (to: string): number => andHeads.has(to) ? heads.turnRun ?? 26 : 26;
  // ports: the edges that meet one side of a state fan out along it (ordered by where the other end is, so they do not cross)
  // lanes: direct arrows through one gap between two layers take separate vertical runs
  const edgeAt = (i: number): LayeredEdgeOut => at(lay.edges, i);
  const nodeOf = (id: string): Placed => must(lay.nodes.get(id));
  const laneY = (i: number): number => at(edgeAt(i).points, 1).y; // the lane of a return in an outer lane (its second point)
  const portOf = new Map<number, number>(), laneOf = new Map<number, number>();
  const slotOf = new Map<number, {list: {edge: number; end: 0 | 1}[]; k: number; before: number; after: number}>(); // where each arrow end sits among the ends of its box side
  // the gap between layer l and l+1 runs from the right edge of the widest box of l to the left edge of the leftmost box of l+1
  const layerOf = (id: string): number => must(lay.layers.get(id));
  const layerRight = new Map<number, number>(), layerLeft = new Map<number, number>();
  for (const [id, n] of lay.nodes) {
    const l = layerOf(id);
    if (l === undefined) continue;
    layerRight.set(l, Math.max(layerRight.get(l) ?? -Infinity, n.x + n.w));
    layerLeft.set(l, Math.min(layerLeft.get(l) ?? Infinity, n.x));
  }
  // the gap (the one after layer g) an x along the layers lies in, if any
  const gapMemo = new Map<number, number | undefined>();
  const gapAt = (x: number): number | undefined => {
    if (gapMemo.has(x)) return gapMemo.get(x);
    let found: number | undefined;
    for (const [g, gl] of layerRight) { const gr = layerLeft.get(g + 1); if (gr !== undefined && x > gl - 0.5 && x < gr + 0.5) { found = g; break; } }
    gapMemo.set(x, found);
    return found;
  };
  // laneHeads: a return in an outer lane ends on the face of its head that looks at the lane (the bottom or the top), not on the head's right side,
  // where it would cross the arrows that leave that side. Only where the run from the lane to the face passes no other box.
  const faceOf = new Map<number, {x: number; y: number}>();
  if (laneHeads) {
    // the returns into one face of one box take places along it, a step apart; a box with a self-loop keeps its returns on the side (the loop is drawn outside the routes, on that face)
    const byFace = new Map<string, number[]>();
    lay.edges.forEach((e, i) => {
      if (e.self || !e.outer || lay.edges.some(l => l.self && l.from === e.to)) return;
      const B = nodeOf(e.to), key = `${e.to}:${laneY(i) > B.y + B.h / 2 ? 'b' : 't'}`;
      byFace.set(key, [...(byFace.get(key) ?? []), i]);
    });
    for (const list of byFace.values()) {
      const B = nodeOf(edgeAt(at(list, 0)).to), lane = laneY(at(list, 0)), y = lane > B.y + B.h / 2 ? B.y + B.h : B.y;
      const step = list.length > 1 ? Math.min(portStep, (B.w - 12) / (list.length - 1)) : 0;
      // the tails are on the far side of the head, so the lane nearest the head takes the place nearest them (the right): a farther lane's vertical run then never crosses a nearer lane's run
      const order = list.toSorted((p, q) => Math.abs(laneY(p) - y) - Math.abs(laneY(q) - y) || p - q);
      order.forEach((i, k) => {
        const x = B.x + B.w / 2 + ((order.length - 1) / 2 - k) * step, lane = laneY(i), lo = Math.min(lane, y), hi = Math.max(lane, y);
        if ([...lay.nodes].some(([id, n]) => id !== edgeAt(i).to && x > n.x - 0.5 && x < n.x + n.w + 0.5 && hi > n.y - 0.5 && lo < n.y + n.h + 0.5)) return;
        faceOf.set(i, {x, y});
      });
    }
  }
  // The step between the lanes of one gap: the lanes of a gap are counted from its sides at LANE apart, which leaves a gap wider than they need with its lanes
  // crowded at the sides. They spread over the room the gap has left, up to twice the step; a gap with no room keeps LANE. Direct arrows, the long arrows into an AND
  // and the turns of the returns in an outer lane all use the step of their gap, so their order and the way they share the gap do not change.
  // a direct arrow whose two ports are at one height is a straight line: it has no vertical run, so it takes no lane (without `spread` the lanes are the old ones: every direct arrow has one)
  const level = (i: number): boolean => { if (!spread) return false; const e = edgeAt(i), A = nodeOf(e.from), B = nodeOf(e.to); return Math.abs(A.y + A.h / 2 + (portOf.get((i * 2)) ?? 0) - (B.y + B.h / 2 + (portOf.get((i * 2 + 1)) ?? 0))) < 0.5; };
  let crowded: Map<number, number> | undefined; // the lanes that meet in a gap (the gap after layer g); counted at the first use, when the ports are set
  const crowdOf = (): Map<number, number> => {
    if (crowded) return crowded;
    const crowd = crowded = new Map<number, number>();
    lay.edges.forEach((e, i) => {
      if (e.self) return;
      const l1 = layerOf(e.from), l2 = layerOf(e.to);
      for (const g of e.outer ? [l1 - 1, l2] : e.points.length === 2 ? (level(i) ? [] : [Math.min(l1, l2)]) : l1 < l2 && groupOf ? [l2 - 1] : []) crowd.set(g, (crowd.get(g) ?? 0) + 1);
    });
    return crowd;
  };
  const laneIn = (g: number): number => {
    const n = crowdOf().get(g) ?? 0, gl = layerRight.get(g), gr = layerLeft.get(g + 1);
    if (!spread || n < 2 || gl === undefined || gr === undefined) return LANE;
    return Math.min(2 * LANE, Math.max(LANE, Math.floor((gr - gl - 2 * STUB - Math.round(16 * unit)) / (n - 1))));
  };
  const ends: {key: string; edge: number; end: 0 | 1; other: number}[] = [];
  const corridors = new Map<string, number[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)), ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    ends.push({key: `${e.from}:${first.x >= ca.x ? 'r' : 'l'}`, edge: i, end: 0, other: first.y});
    if (!faceOf.has(i)) ends.push({key: `${e.to}:${last.x <= cb.x ? 'l' : 'r'}`, edge: i, end: 1, other: last.y});
    if (e.points.length === 2) { // direct arrows through one gap between two layers, in groups that go down / go up
      const k = `${Math.round(Math.min(ca.x, cb.x))}:${Math.round(Math.max(ca.x, cb.x))}`;
      corridors.set(k, [...(corridors.get(k) ?? []), i]);
    }
  });
  const byKey = new Map<string, typeof ends>();
  for (const en of ends) byKey.set(en.key, [...(byKey.get(en.key) ?? []), en]);
  // an AND whose arrows arrive on more than one side of the head draws no arc (toc.ts `andEnds`): its ports are not widened (ADR 0070 D3)
  const groupSides = new Map<number, Set<string>>();
  if (groupOf) for (const en of ends) { const g = en.end === 1 ? groupOf(en.edge) : undefined; if (g !== undefined) groupSides.set(g, (groupSides.get(g) ?? new Set()).add(en.key)); }
  for (const list of byKey.values()) {
    // the arrows of one group (an AND) arrive side by side: they sort by where the group as a whole comes from, then among themselves
    const mean = new Map<number, number>(), count = new Map<number, number>();
    if (groupOf) {
      for (const en of list) { const g = en.end === 1 ? groupOf(en.edge) : undefined; if (g !== undefined) { mean.set(g, (mean.get(g) ?? 0) + en.other); count.set(g, (count.get(g) ?? 0) + 1); } }
      for (const [g, n] of count) mean.set(g, must(mean.get(g)) / n);
    }
    const key = (en: typeof list[number]): number => (en.end === 1 && groupOf && groupOf(en.edge) !== undefined ? must(mean.get(must(groupOf(en.edge)))) : en.other);
    list.sort((p, q) => key(p) - key(q) || (p.end === 1 && groupOf ? (groupOf(p.edge) ?? -1) - (groupOf(q.edge) ?? -1) : 0) || p.other - q.other || p.edge - q.edge);
    // ADR 0070 D3 (`andPorts`): the boundary between an AND group and its neighbour (another group, or an arrow of no group) is two steps
    // wide, so that the two arcs (or the arc and the lone arrow) stay apart; inside a group and between ungrouped arrows it stays one step
    const groupAt = (en: typeof list[number]): number | undefined => { const g = en.end === 1 && groupOf ? groupOf(en.edge) : undefined; return g !== undefined && groupSides.get(g)?.size === 1 ? g : undefined; };
    const units = list.map((en, k): number => {
      if (k === 0) return 0;
      const a = groupAt(must(list[k - 1])), b = groupAt(en);
      return heads.andPorts && a !== b && (a !== undefined || b !== undefined) ? 2 : 1;
    });
    const total = units.reduce((s, u) => s + u, 0); // the side's span in steps
    const offsets = units.map((_u, k) => units.slice(0, k + 1).reduce((s, u) => s + u, 0)); // each port's place in steps from the first
    list.forEach((en, k) => {
      const e = edgeAt(en.edge), id = en.end === 0 ? e.from : e.to, h = must(lay.nodes.get(id)).h;
      const step = list.length > 1 ? Math.min(portStep, (h - 12) / total) : 0;
      // the ports of one side keep an even step (a tail and a head on one side are never closer than a step). The ports of every box's
      // left side sit half a step lower than those of its right side: a tail port of one box and a head port of the next (same layer
      // pair) otherwise share a height and their runs line up as one line. A lone port stays in the middle (a straight arrow stays straight).
      const room = h / 2 - 6, span = total / 2 * step; // how far the outer ports are from the middle
      const slack = Math.min(step / 2, room - span); // as much of half a step as still keeps the whole side inside the box
      const lower = en.key.endsWith(':l') && list.length > 1 && slack >= 3 ? slack : 0;
      portOf.set((en.edge * 2 + en.end), (must(offsets[k]) - total / 2) * step + lower);
      slotOf.set((en.edge * 2 + en.end), {list, k, before: (units[k] ?? 0) * step, after: (units[k + 1] ?? 0) * step});
    });
  }
  // fan-out (one tail): the arrow that goes farthest turns first (the lane nearest the tail), so no vertical run crosses another arrow's
  // last run. fan-in (one head, several tails): the other way round, the nearest tail turns first.
  const dy = (i: number): number => { const e = edgeAt(i), A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)); return Math.abs((B.y + B.h / 2) - (A.y + A.h / 2)); };
  // arrows that go down and arrows that go up through the same gap are told apart too: the up group takes the lanes after the down group's
  const goesDown = (i: number): boolean => { const e = edgeAt(i), A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to)); return B.y + B.h / 2 >= A.y + A.h / 2; };
  // forward arrows (tail in the earlier layer) take lanes counted from the gap's left side, backward arrows (a return) from its right side,
  // so the two kinds never land on one lane (the gap is sized for all of them together, see gapFor)
  const forward = (i: number): boolean => layerOf(edgeAt(i).from) < layerOf(edgeAt(i).to);
  // ADR 0016 D11: a long arrow into a grouped head (an AND) takes the first lanes of the gap before the head, so its last turn lies on the tail side of the direct arrows' turns
  // and the two never run side by side; the direct arrows' lanes come after. Only when asked (the caller keeps it when the figure gets no worse).
  const longLane = new Map<number, number>(), longIn = new Map<number, number>();
  if (laneShare && groupOf) lay.edges.forEach((e, i) => {
    if (e.self || e.points.length <= 2 || groupOf(i) === undefined || !forward(i)) return;
    const lo = layerOf(e.to) - 1, k = longIn.get(lo) ?? 0;
    longIn.set(lo, k + 1); longLane.set(i, k);
  });
  /** A direct arrow's runs along the layers, at its two ports: the one on the gap's left side, and the one on its right. */
  const legsOf = (i: number): Legs => {
    const e = edgeAt(i), A = nodeOf(e.from), B = nodeOf(e.to);
    const ya = A.y + A.h / 2 + (portOf.get((i * 2)) ?? 0), yb = B.y + B.h / 2 + (portOf.get((i * 2 + 1)) ?? 0);
    return A.x < B.x ? {left: ya, right: yb} : {left: yb, right: ya};
  };
  const orders = new Map<string, number[]>(); // constrainedOrder's answers: the same turns are ordered again in every trial
  let reordered = false; // a gap's lanes took another order than the old one
  let constrainLanes = true; // with tracks: the lanes in the order of the vertical constraints (else the old order)
  const assignLanes = (): void => {
  laneOf.clear(); reordered = false;
  for (const all0 of corridors.values()) {
    const all = all0.filter(i => !level(i));
    if (!all.length) continue;
    const gapOf = Math.min(layerOf(edgeAt(at(all, 0)).from), layerOf(edgeAt(at(all, 0)).to));
    for (const group of [all.filter(forward), all.filter(i => !forward(i))]) {
      let k = group.length && forward(at(group, 0)) ? longIn.get(gapOf) ?? 0 : 0;
      const old = [group.filter(goesDown), group.filter(i => !goesDown(i))].flatMap(list => {
        const fanIn = new Set(list.map(i => edgeAt(i).to)).size === 1 && new Set(list.map(i => edgeAt(i).from)).size > 1;
        return list.toSorted((p, q) => (fanIn ? dy(p) - dy(q) : dy(q) - dy(p)) || p - q);
      });
      // ADR 0070 D4 (U4b, `tracks`): the order that crosses none of the gap's arrows where it can (the vertical constraints, whatever their
      // heads), the order above where it is free. A forward arrow's lanes count from the gap's left side, a return's from its right side
      const back = group.length > 0 && !forward(at(group, 0));
      const order = !tracks || !constrainLanes ? old : back ? constrainedOrder(old, legsOf, i => -old.indexOf(i), LANE, orders).reverse() : constrainedOrder(old, legsOf, i => old.indexOf(i), LANE, orders);
      if (order.some((v, m) => v !== old[m])) reordered = true;
      for (const i of order) laneOf.set(i, k++ * laneIn(gapOf));
    }
  }
  };
  assignLanes();
  // returns in an outer lane (graph-layout.ts `outer`): each turns in the gap before its tail's layer and in the gap after its head's layer,
  // past the lanes of the direct arrows there (a tail counts from the gap's right side, a head from its left side)
  const gapBack = new Map<number, number>(), gapFwd = new Map<number, number>(), tailAt = new Map<number, number>(), headAt = new Map<number, number>();
  const outerTurns = new Map<number, {tail: number; head: number}>();
  const turnOuter = (): void => {
  tailAt.clear(); headAt.clear(); gapBack.clear(); gapFwd.clear();
  lay.edges.forEach((e, i) => { // the direct arrows that have a lane there now (counted again whenever the lanes are laid again)
    if (e.self || e.points.length !== 2 || level(i)) return;
    const l1 = layerOf(e.from), l2 = layerOf(e.to), g = Math.min(l1, l2), m = l1 < l2 ? gapFwd : gapBack;
    m.set(g, (m.get(g) ?? 0) + 1);
  });
  const within = (g: number, x: number, head?: string): number => { if (!spread) return x; const gl = layerRight.get(g), gr = layerLeft.get(g + 1); return gl === undefined || gr === undefined ? x : Math.min(gr - STUB, Math.max(gl + (head !== undefined ? Math.max(STUB, headRunOf(head)) : STUB), x)); }; // a turn stays inside its gap; the last run into a head keeps room for the arrowhead
  lay.edges.forEach((e, i) => {
    if (!e.outer) return;
    const gt = layerOf(e.from) - 1, gh = layerOf(e.to), kt = tailAt.get(gt) ?? 0, kh = headAt.get(gh) ?? 0;
    tailAt.set(gt, kt + 1); headAt.set(gh, kh + 1);
    outerTurns.set(i, {
      tail: within(gt, (layerLeft.get(gt + 1) ?? 0) - STUB - ((gapBack.get(gt) ?? 0) + kt) * laneIn(gt)),
      head: within(gh, (layerRight.get(gh) ?? 0) + STUB + ((gapFwd.get(gh) ?? 0) + kh) * laneIn(gh), e.to),
    });
  });
  };
  turnOuter();
  // the routes for the ports as they stand (in the layout's own axes)
  const shiftOf = new Map<number, number>(); // a long arrow's way points moved across the layers (ADR 0016 D12)
  const turnAt = new Map<number, number>(); // a direct arrow's turn moved to another x in its gap (ADR 0016 D13)
  const detours = new Map<number, Pt[]>(); // a long arrow's route found by searching around the boxes (`detour`): kept when the routes are built again
  /** homes: where main put a turn that placeTracks may move (a long arrow's last turn into an AND, `lastTurn`): the place to beat. */
  type Pending = {i: number; pts: Pt[]; turns: (number | undefined)[]; homes: (number | undefined)[]; mark: number};
  /** One arrow's stretches of runs near a cluster, with their box (4px wider) and their runs. */
  type Arrow = {st: Pt[][]; box: {x0: number; x1: number; y0: number; y1: number}; segs?: {p: Pt; q: Pt}[]; runs?: Runs[]};
  const segsOf = (st: Pt[][]): {p: Pt; q: Pt}[] => st.flatMap(r => r.slice(1).map((q, k) => ({p: at(r, k), q})));
  const arrowOf = (st: Pt[][]): Arrow => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of st) for (const p of r) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return {st, box: {x0: x0 - 4, x1: x1 + 4, y0: y0 - 4, y1: y1 + 4}};
  };
  /** cross: the crossings of a cluster's arrows with each other and the rest, plus the pairs of arrows that lie on one line (under 4px apart,
   *  once per pair): such a pair hides how the two pass each other, so it weighs as one crossing and may be traded for one.
   *  par: the pairs of arrows with runs side by side under a lane step (ADR 0070 D2's measure, once per pair).
   *  real: the crossings alone.
   *  touch: the pairs of arrows with two runs on one line whose ends are under a lane step apart (they read as one line too; not counted in cross). */
  type Score = {cross: number; par: number; real: number; touch: number};
  /** Two runs on one axis under a lane step apart and over 4px together (`parallelRuns`' pair, for one run of each). */
  const beside = (u: {p: Pt; q: Pt}, v: {p: Pt; q: Pt}): boolean => {
    const lu = u.p.y === u.q.y, lv = v.p.y === v.q.y;
    if (lu !== lv || (lu ? u.p.x === u.q.x : u.p.y === u.q.y)) return false;
    const gap = lu ? Math.abs(u.p.y - v.p.y) : Math.abs(u.p.x - v.p.x);
    const a0 = lu ? Math.min(u.p.x, u.q.x) : Math.min(u.p.y, u.q.y), a1 = lu ? Math.max(u.p.x, u.q.x) : Math.max(u.p.y, u.q.y);
    const b0 = lu ? Math.min(v.p.x, v.q.x) : Math.min(v.p.y, v.q.y), b1 = lu ? Math.max(v.p.x, v.q.x) : Math.max(v.p.y, v.q.y);
    return gap < LANE && Math.min(a1, b1) - Math.max(a0, b0) > 4;
  };
  /** Two runs on one line (under 0.5px apart) whose ends are under a lane step apart, or overlap. */
  const endToEnd = (u: {p: Pt; q: Pt}, v: {p: Pt; q: Pt}): boolean => {
    const lu = u.p.y === u.q.y, lv = v.p.y === v.q.y;
    if (lu !== lv || (lu ? u.p.x === u.q.x : u.p.y === u.q.y)) return false;
    if ((lu ? Math.abs(u.p.y - v.p.y) : Math.abs(u.p.x - v.p.x)) >= 0.5) return false;
    const a0 = lu ? Math.min(u.p.x, u.q.x) : Math.min(u.p.y, u.q.y), a1 = lu ? Math.max(u.p.x, u.q.x) : Math.max(u.p.y, u.q.y);
    const b0 = lu ? Math.min(v.p.x, v.q.x) : Math.min(v.p.y, v.q.y), b1 = lu ? Math.max(v.p.x, v.q.x) : Math.max(v.p.y, v.q.y);
    return Math.max(a0, b0) - Math.min(a1, b1) < LANE;
  };
  const scoreOf2 = (mine: Arrow[], rest: Arrow[]): Score => {
    let cross = 0, par = 0, real = 0, touch = 0;
    mine.forEach((x, k) => {
      for (const y of mine.slice(k + 1).concat(rest)) {
        if (!(x.box.x0 <= y.box.x1 && y.box.x0 <= x.box.x1 && x.box.y0 <= y.box.y1 && y.box.y0 <= x.box.y1)) continue;
        let c = 0;
        const xr = x.runs ??= x.st.map(r => runsOfPath(r)), yr = y.runs ??= y.st.map(r => runsOfPath(r)); // worked out when first compared
        for (const rx of xr) for (const ry of yr) c += crossingsOfRuns(rx, ry);
        cross += c; real += c;
        const xs = x.segs ??= segsOf(x.st), ys = y.segs ??= segsOf(y.st); // worked out when first compared
        if (xs.some(u => ys.some(v => runsTogether(u, v)))) cross++;
        else if (xs.some(u => ys.some(v => endToEnd(u, v)))) touch++;
        if (xs.some(u => ys.some(v => beside(u, v)))) par++;
      }
    });
    return {cross, par, real, touch};
  };
  const lastInit = new Map<number, {pts: Pt[]; turns: (number | undefined)[]; route: Pt[]; sg: {x0: number; x1: number; h: number}}>(); // each pending arrow's route as it was made at the start of the last placing
  const crossCache = new WeakMap<Pt[], Runs>(); // the runs of the routes by their arrays, for the crossings of one route against the others (the same routes try after try)
  const stageMemo = new Map<string, {raw: (number | undefined)[]; touched: number[]; input: Float64Array}>(); // a gap's turns after one stage, by everything the stage reads (a gap with the same inputs is placed the same: the figure is routed again for every trial)
  const trackMemo = new Map<string, number[] | null>(); // a cluster's place, by everything it was chosen from (build() runs again and again)
  /**
   * ADR 0070 D4 (`tracks`): the turns of each gap get tracks, in two passes over the same placing.
   * U4a: the turns of the long arrows that no one placed (they turned half-way across their gap, so long arrows through one gap turned on
   * one line and lay along each other) get a track each. In each gap, the runs across it of the turns already placed (the direct arrows'
   * lanes, the returns' turns in an outer lane, the routes found around the boxes) stay where they are. The long arrows' turns whose spans,
   * each made longer by a lane step at both ends, overlap form a cluster: its turns take tracks a lane apart (`laneIn`, else LANE), in the
   * order of the vertical constraints (`constrainedOrder`; turns that do not overlap may share a track: left-edge), and the cluster is
   * shifted from where its turns were so that every track is inside its gap and a lane step from the runs already there. Of those places
   * (the nearest on each side, keeping each turn on the side of each run it was on, else on either side), the one with the fewest crossings
   * of the cluster's arrows is taken (a pair of arrows on one line counts as one: a hidden crossing, so an overlap may be traded for a real
   * crossing), then the fewest pairs side by side under a lane step, and none when every place scores more than the turns half-way: the
   * tracks add no crossings + overlaps where they move a run. A turn that overlaps nothing and is clear stays half-way.
   * U4b: then every turn of a gap (the direct arrows' lanes, the long arrows' turns, their last turns into a head) is one cluster's turn:
   * where the turns' order across the gap breaks a vertical constraint (two of them cross where they need not), the cluster takes the
   * order of the constraints and the place of the fewest crossings + overlaps, then pairs side by side, only when that is strictly fewer
   * than where they are. A last turn into a head stays `headRun` (the AND's arc) from it. The places are memoised by everything they are
   * chosen from (build() runs again for every trial).
   */
  const placeTracks = (pending: Pending[], out: Map<number, Pt[]>): ((o: Pending) => Pt[]) => {
    type Run = {x: number; lo: number; hi: number};
    type Ask = {own: Pending; p: Pt; q: Pt; lo: number; hi: number; min: number; max: number; home: number | undefined; cur: () => number; raw: () => number | undefined; set: (x: number | undefined) => void};
    const madeRuns = new Map<number, Run[]>(), given = new Map<number, Run[]>(), held = new Map<number, Run[]>();
    const asks = new Map<number, Ask[]>(), all = new Map<number, Ask[]>();
    const add = <T>(m: Map<number, T[]>, g: number, v: T): void => { const l = m.get(g); if (l) l.push(v); else m.set(g, [v]); };
    const made = [...out.values()].filter(r => r.length); // the routes already made (the pending arrows hold an empty place in `out`)
    // the runs across the gaps that are already placed: every vertical run of a route already made
    for (const r of made) {
      for (let k = 1; k < r.length; k++) {
        const a = at(r, k - 1), b = at(r, k), g = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5 ? gapAt(a.x) : undefined;
        if (g !== undefined) add(madeRuns, g, {x: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y)});
      }
    }
    for (const own of pending) {
      const {i, pts, turns} = own, e = edgeAt(i), l0 = layerOf(e.from), sgn = forward(i) ? 1 : -1;
      const long = pts.length > 2 && pts.length - 1 === Math.abs(layerOf(e.to) - l0); // one way point per layer passed
      for (let k = 0; k + 1 < pts.length; k++) {
        const p = at(pts, k), q = at(pts, k + 1);
        if (p.y === q.y) continue; // no turn (the same test as elbows')
        const g = long ? Math.min(l0 + k * sgn, l0 + (k + 1) * sgn) : Math.min(l0, layerOf(e.to));
        const gl = layerRight.get(g), gr = layerLeft.get(g + 1);
        const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y), x = turns[k];
        // a turn D13 moved (`turnAt`) stays where it was put; so does every turn of an arrow that is neither direct nor long
        const fixed = (!long && pts.length > 2) || gl === undefined || gr === undefined || (pts.length === 2 && turnAt.has(i));
        if (x !== undefined) add(fixed ? held : given, g, {x, lo, hi});
        if (fixed) continue;
        // inside the gap, a stub from its sides; the last run into the head keeps the room of a direct arrow's last run (`headRunOf`: 22, or
        // the AND's arc, ADR 0070 D8)
        const last = k + 2 === pts.length, room = last ? Math.max(STUB, headRunOf(e.to)) : STUB;
        const min = gl + (last && sgn < 0 ? room : STUB), max = gr - (last && sgn > 0 ? room : STUB);
        const ask: Ask = {own, p, q, lo, hi, min, max, home: own.homes[k], cur: () => turns[k] ?? (p.x + q.x) / 2, raw: () => turns[k], set: v => { turns[k] = v; }};
        add(all, g, ask);
        if (x === undefined && long) add(asks, g, ask);
      }
    }
    const near = (a: {lo: number; hi: number}, b: {lo: number; hi: number}): boolean => a.lo - LANE < b.hi + LANE && b.lo - LANE < a.hi + LANE;
    // every route as it stands, the pending ones at their turns so far (made once, and again for the arrows of each cluster placed)
    // each route's extent along the layers and a hash of its points: what a cluster's memo is keyed by (cheap to test, many times a figure)
    const signOf = (r: Pt[]): {x0: number; x1: number; h: number} => {
      let h = 2166136261, x0 = Infinity, x1 = -Infinity;
      for (const p of r) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); h = Math.imul(h ^ Math.round(p.x * 100), 16777619) >>> 0; h = Math.imul(h ^ Math.round(p.y * 100), 16777619) >>> 0; }
      return {x0, x1, h};
    };
    // a pending route made again for every trial is the same as the last time (and its hash) when its points and turns are
    const initial = pending.map((o): {turns: (number | undefined)[]; route: Pt[]; sg: {x0: number; x1: number; h: number}} => {
      const prev = lastInit.get(o.i);
      if (prev && prev.pts.length === o.pts.length && prev.turns.length === o.turns.length && prev.turns.every((x, k) => x === o.turns[k]) && prev.pts.every((p, k) => p.x === at(o.pts, k).x && p.y === at(o.pts, k).y)) return prev;
      const route = elbows(o.pts, o.turns), made1 = {pts: o.pts, turns: [...o.turns], route, sg: signOf(route)};
      lastInit.set(o.i, made1);
      return made1;
    });
    const routeNow = new Map<Pending | number, Pt[]>();
    made.forEach((r, k) => routeNow.set(k, r));
    pending.forEach((o, k) => routeNow.set(o, at(initial, k).route));
    const signs = new Map<Pending | number, {x0: number; x1: number; h: number}>();
    made.forEach((r, k) => signs.set(k, signOf(r)));
    pending.forEach((o, k) => signs.set(o, at(initial, k).sg));
    const turnsSeen = new Map<Pending, (number | undefined)[]>();
    pending.forEach((o, k) => turnsSeen.set(o, at(initial, k).turns)); // the turns each pending route in `routeNow` was made from (never changed: a route made again takes a copy)
    // each route's extent along the layers by its place in `routeNow`'s order, so that a cluster finds the routes near it by a pass over two number arrays (a route that is not finite is never near)
    const seqOf = new Map<Pending | number, number>(), routeAt: (Pending | number)[] = [], ext0 = new Float64Array(signs.size), ext1 = new Float64Array(signs.size), extH = new Float64Array(signs.size);
    for (const [o, sg] of signs) { const k = seqOf.size; seqOf.set(o, k); routeAt.push(o); ext0[k] = sg.x0; ext1[k] = sg.x1; extH[k] = sg.h; }
    const legs = (a: Ask): Legs => a.p.x <= a.q.x ? {left: a.p.y, right: a.q.y} : {left: a.q.y, right: a.p.y};
    /** A place that moved nothing (most: the memo's answer is the turns as they were) leaves a route as it was made; else it is made again from the turns. */
    const refresh = (o: Pending): void => {
      const seen = must(turnsSeen.get(o));
      if (seen.length === o.turns.length && seen.every((x, k) => x === o.turns[k])) return;
      const r = elbows(o.pts, o.turns), sg = signOf(r);
      routeNow.set(o, r); signs.set(o, sg); const k = must(seqOf.get(o)); ext0[k] = sg.x0; ext1[k] = sg.x1; extH[k] = sg.h; turnsSeen.set(o, [...o.turns]);
    };
    const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
    let stamps = 0;
    let touchedNow: Set<Pending> | undefined; // the arrows a stage of a gap made a route of again (placeCluster's post)
    /**
     * One stage of one gap, by what it reads: the gap's turns (spans, bounds, homes, where they are now), the runs that stay, the step of its lanes and
     * the routes along the layers it reaches (which of them are its own). The same inputs place the same: the turns it ends with (and the arrows whose
     * route it made again) are kept, and played back.
     */
    const stage = (name: string, g: number, list: Ask[], runs: Run[], body: () => void): void => {
      let x0 = Infinity, x1 = -Infinity;
      for (const a of list) { x0 = Math.min(x0, a.p.x, a.q.x); x1 = Math.max(x1, a.p.x, a.q.x); }
      const stamp = ++stamps;
      for (const a of list) a.own.mark = stamp; // its arrows: the routes of them in the key are told apart from the others'
      // the key is two 32-bit hashes of the doubles' bits; a hit is checked against the numbers themselves (`input`), so a collision plays back nothing
      let h1 = 2166136261, h2 = 5381;
      const input: number[] = [];
      const num = (v: number): void => { input.push(v); f64[0] = v; const lo = u32[0] as number, hi = u32[1] as number; h1 = Math.imul(h1 ^ lo, 16777619); h1 = Math.imul(h1 ^ hi, 16777619); h2 = Math.imul(h2 ^ lo, 33) + hi | 0; };
      num(name === 'a' ? 1 : 2); num(g); num(laneIn(g)); num(list.length);
      for (const a of list) { num(a.p.x); num(a.p.y); num(a.q.x); num(a.q.y); num(a.lo); num(a.hi); num(a.min); num(a.max); num(a.home ?? NaN); num(a.cur()); }
      num(runs.length);
      for (const r of runs) { num(r.x); num(r.lo); num(r.hi); }
      for (let k = 0; k < routeAt.length; k++) if ((ext1[k] as number) >= x0 - 1 && (ext0[k] as number) <= x1 + 1) { const o = at(routeAt, k); num(extH[k] as number); num(typeof o !== 'number' && o.mark === stamp ? 1 : 0); }
      const key = heads.stageHashBits === undefined ? `${h1}:${h2}` : String(((h1 ^ h2) >>> 0) % 2 ** heads.stageHashBits);
      let hit = stageMemo.get(key);
      if (hit && !(hit.input.length === input.length && hit.input.every((v, k) => Object.is(v, input[k])))) hit = undefined; // a collision: placed afresh (and kept in its place)
      if (hit) { list.forEach((a, k) => a.set(hit.raw[k])); for (const k of hit.touched) refresh(at(list, k).own); return; }
      const outer = touchedNow;
      touchedNow = new Set();
      body();
      if (!stageMemo.has(key)) stageMemo.set(key, {raw: list.map(a => a.raw()), touched: list.flatMap((a, k) => touchedNow?.has(a.own) ? [k] : []), input: Float64Array.from(input)});
      touchedNow = outer;
    };
    /** The clusters of a gap's turns: those whose spans (a lane step longer at both ends) overlap, directly or through others. */
    const clustersOf = (list: Ask[]): Ask[][] => {
      const seen = new Set<Ask>(), out: Ask[][] = [];
      for (const a0 of list) {
        if (seen.has(a0)) continue;
        const c = [a0];
        seen.add(a0);
        for (let n = 0; n < c.length; n++) for (const b of list) if (!seen.has(b) && near(at(c, n), b)) { seen.add(b); c.push(b); }
        out.push(c);
      }
      return out;
    };
    /**
     * Places one cluster of gap g's turns, in `order` (left to right), against the runs that stay (`runs`). `strict`: a place is taken
     * only when it has strictly fewer crossings + overlaps, then pairs side by side, than the turns where they are (U4b); else when it has
     * no more crossings + overlaps (U4a: the turns were half-way, where nothing placed them).
     */
    const placeCluster = (g: number, order: Ask[], runs: Run[], strict: boolean): boolean => {
      const step = laneIn(g);
      // tracks, greedily in that order: a turn takes the track after the highest of the turns before it whose spans it overlaps; turns that
      // do not overlap may share a track (their ends stay two lane steps apart)
      const track: number[] = [];
      order.forEach((a, k) => { track.push(Math.max(-1, ...order.slice(0, k).flatMap((b, m) => near(a, b) ? [at(track, m)] : [])) + 1); });
      const tracksN = Math.max(...track) + 1;
      const was = order.map(a => a.cur());
      const centre = was.reduce((s, x) => s + x, 0) / order.length;
      // the places the cluster may take: shifted from its centre so that every track is inside its turn's bounds and a lane step from the
      // runs already there (each rules out an interval of shifts); at the gap's own step, then the plain lane step. keepSide: a turn stays
      // on the side of each such run it was on, unless it was on the run's line (within a lane step), where either side may do.
      // The nearest such shift on each side of 0, for each way.
      const shifts = (step: number, keepSide: boolean): number[][] => {
        const xs = order.map((_a, k) => centre + (at(track, k) - (tracksN - 1) / 2) * step);
        const lo = Math.max(...order.map((a, k) => a.min - at(xs, k))), hi = Math.min(...order.map((a, k) => a.max - at(xs, k)));
        if (lo > hi + 0.01) return [];
        const banned = order.flatMap((a, k) => runs.filter(r => near(r, a)).map(r => {
          const w = at(was, k), u = r.x - at(xs, k) - LANE, v = r.x - at(xs, k) + LANE;
          return !keepSide || Math.abs(w - r.x) < LANE ? [u, v] as const : w > r.x ? [-Infinity, v] as const : [u, Infinity] as const;
        }));
        const ok = (d: number): boolean => d >= lo - 0.01 && d <= hi + 0.01 && banned.every(([u, v]) => d <= u + 0.01 || d >= v - 0.01);
        const ds = [0, lo, hi, ...banned.flat()].filter(d => Number.isFinite(d) && ok(d));
        const nearest = (side: number[]): number[] => side.length ? [side.reduce((m, d) => Math.abs(d) < Math.abs(m) ? d : m)] : [];
        return [...nearest(ds.filter(d => d >= 0)), ...nearest(ds.filter(d => d < 0))].map(d => xs.map(x => x + d));
      };
      // ADR 0070 D4: the tracks may not add crossings. Each place is scored by the crossings of the cluster's arrows (with each other and with
      // the rest, the pending ones at their turns so far) and taken with the fewest, then in the order above, then the least moved
      const mine = new Set(order.map(a => a.own));
      // only the runs the cluster's turns can change matter: those of its arrows, and of the others, between the outer ends of its turns'
      // runs along the layers (each route cut to its stretches of runs that reach there)
      const x0 = Math.min(...order.map(a => Math.min(a.p.x, a.q.x))) - 1, x1 = Math.max(...order.map(a => Math.max(a.p.x, a.q.x))) + 1;
      const within = (r: Pt[]): Pt[][] => {
        const out: Pt[][] = [];
        let cur: Pt[] = [];
        for (let k = 1; k < r.length; k++) {
          const p = at(r, k - 1), q = at(r, k);
          if (Math.max(p.x, q.x) >= x0 && Math.min(p.x, q.x) <= x1) { if (!cur.length) cur.push(p); cur.push(q); } else if (cur.length) { out.push(cur); cur = []; }
        }
        if (cur.length) out.push(cur);
        return out;
      };
      const near0: [Pending | number, {x0: number; x1: number; h: number}][] = [];
      for (let k = 0; k < routeAt.length; k++) { if (!(ext1[k] as number >= x0 && ext0[k] as number <= x1)) continue; const o = at(routeAt, k); if (typeof o === 'number' || !mine.has(o)) near0.push([o, must(signs.get(o))]); }
      const key = JSON.stringify([strict, step, order.map(a => [a.p.x, a.p.y, a.q.x, a.q.y, a.min, a.max, a.home ?? null]), strict ? was : [], track, runs.map(r => [r.x, r.lo, r.hi]), near0.map(([, sg]) => sg.h)]);
      let picked = trackMemo.get(key);
      if (picked === undefined) {
        const others = near0.map(([o]) => within(must(routeNow.get(o)))).filter(x => x.length).map(arrowOf);
        const score = (): Score => scoreOf2([...mine].map(o => arrowOf(within(elbows(o.pts, o.turns)))), others);
        // U4a's turns are judged against where main put them: half-way, or a long arrow's last turn into an AND at `lastTurn` (its home)
        if (!strict) order.forEach(a => a.set(a.home));
        // against main's last turns into an AND, a pair on one line is not traded for a crossing either (an AND's arrows must not cross)
        const homed = !strict && order.some(a => a.home !== undefined);
        const now = score();
        let best: {xs: number[]; s: Score; rank: number; moved: number} | undefined;
        // the homes are a place too, the last of a tie (NaN: half-way)
        if (!strict && order.some(a => a.home !== undefined)) best = {xs: order.map(a => a.home ?? NaN), s: now, rank: 99, moved: Infinity};
        const ways = [[step, true], [LANE, true], [step, false], [LANE, false]] as const;
        ways.forEach(([st, keep], rank) => {
          if (rank % 2 && step <= LANE) return; // the gap's step is the lane step: nothing new
          for (const xs of shifts(st, keep)) {
            order.forEach((a, k) => a.set(at(xs, k)));
            // how far the cluster moved from where it is centred at this step (comparable within one way only: the ways are compared first)
            const sc = score(), moved = Math.abs(at(xs, 0) - (centre + (at(track, 0) - (tracksN - 1) / 2) * st));
            // U4b moves turns that were placed: strictly better, and never by trading a pair on one line for a crossing
            const fits = strict ? sc.real <= now.real && (sc.cross + sc.touch < now.cross + now.touch || (sc.cross + sc.touch === now.cross + now.touch && sc.par < now.par)) : sc.cross <= now.cross && (!homed || sc.real <= now.real);
            if (fits && (!best || sc.cross < best.s.cross || (sc.cross === best.s.cross && (sc.par < best.s.par || (sc.par === best.s.par && (rank < best.rank || (rank === best.rank && moved < best.moved))))))) best = {xs, s: sc, rank, moved};
          }
        });
        order.forEach((a, k) => a.set(strict ? at(was, k) : a.home));
        picked = best ? best.xs : null;
        trackMemo.set(key, picked);
      }
      const chosen = picked;
      if (chosen) order.forEach((a, k) => { const x = at(chosen, k); a.set(Number.isNaN(x) ? undefined : x); });
      else if (!strict) order.forEach(a => a.set(a.home));
      for (const o of mine) { touchedNow?.add(o); refresh(o); }
      // false: nothing placed (none fits, or the homes won: the turns with none stay half-way)
      return chosen !== null && !chosen.every((x, k) => Number.isNaN(x) || x === at(order, k).home);
    };
    const inY = (a: Ask): number => legs(a).left, outY = (a: Ask): number => legs(a).right;
    const down = (a: Ask): boolean => outY(a) > inY(a);
    // U4a: the long arrows' turns that no one placed
    for (const [g, list] of asks) {
      const runs = [...madeRuns.get(g) ?? [], ...given.get(g) ?? [], ...held.get(g) ?? []];
      stage('a', g, list, runs, () => {
        for (const c of clustersOf(list)) {
          const a0 = at(c, 0);
          if (c.length < 2 && !runs.some(r => near(r, a0) && Math.abs(r.x - (a0.p.x + a0.q.x) / 2) < LANE)) { a0.set(a0.home); continue; } // alone and clear: half-way (or its home), as before
          // the order along the gap before the constraints: of two runs that go down (y grows toward the later layer), the one that comes in
          // higher turns later (and of two that come in at one height, the one that goes out lower turns first); of two that go up, the one
          // that comes in higher turns first. Then neither crosses the other's runs (a pair that swaps sides crosses once anyway)
          const plain = c.toSorted((a, b) => Number(down(a)) - Number(down(b)) || (down(a) ? inY(b) - inY(a) || outY(b) - outY(a) : inY(a) - inY(b) || outY(a) - outY(b)));
          if (placeCluster(g, constrainedOrder(plain, legs, a => plain.indexOf(a), LANE, orders), runs, false) || !c.some(a => a.home !== undefined) || c.every(a => a.home !== undefined)) continue;
          // no place for the whole cluster: the last turns into an AND stay at their homes (as in main) and the other turns are placed
          // around them, as U4a placed them around the fixed last turns
          const homes = c.filter(a => a.home !== undefined), rest = c.filter(a => a.home === undefined);
          const around = [...runs, ...homes.map(a => ({x: must(a.home), lo: a.lo, hi: a.hi}))];
          for (const d of clustersOf(rest)) {
            const d0 = at(d, 0);
            if (d.length < 2 && !around.some(r => near(r, d0) && Math.abs(r.x - (d0.p.x + d0.q.x) / 2) < LANE)) continue;
            const sorted = d.toSorted((a, b) => Number(down(a)) - Number(down(b)) || (down(a) ? inY(b) - inY(a) || outY(b) - outY(a) : inY(a) - inY(b) || outY(a) - outY(b)));
            placeCluster(g, constrainedOrder(sorted, legs, a => sorted.indexOf(a), LANE, orders), around, false);
          }
        }
      });
    }
    // U4b: every turn of a gap, where their order across it breaks a vertical constraint
    for (const [g, list] of all) {
      const runs = [...madeRuns.get(g) ?? [], ...held.get(g) ?? []];
      stage('b', g, list, runs, () => {
        for (const c of clustersOf(list)) {
          if (c.length < 2) continue;
          const now = c.toSorted((a, b) => a.cur() - b.cur());
          const order = constrainedOrder(now, legs, a => now.indexOf(a), LANE, orders);
          // no constraint broken, and no two of them on one track where their spans overlap
          if ((order.every((a, k) => a === at(now, k)) && !now.some((a, k) => k > 0 && Math.abs(a.cur() - at(now, k - 1).cur()) < 0.5 && near(a, at(now, k - 1))))) continue;
          placeCluster(g, order, runs, true);
        }
      });
    }
    // each arrow's route from its turns now: as `routeNow` has it when no turn moved since it was made, else made again
    return (o: Pending): Pt[] => {
      const seen = must(turnsSeen.get(o));
      return seen.length === o.turns.length && seen.every((x, k) => x === o.turns[k]) ? must(routeNow.get(o)) : elbows(o.pts, o.turns);
    };
  };
  const build = (): Map<number, Pt[]> => {
    const out = new Map<number, Pt[]>();
    const pending: Pending[] = []; // with `tracks`: the arrows routed by elbows, whose turns are completed by placeTracks
    const longInto = new Map<string, number>(); // long arrows into one head, each with its own last turn
    lay.edges.forEach((e, i) => {
      if (e.self) return;
      const A = nodeOf(e.from), B = nodeOf(e.to), ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
      const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
      const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get((i * 2)) ?? 0)};
      const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get((i * 2 + 1)) ?? 0)};
      const turns = outerTurns.get(i);
      if (turns) { // out of the tail's left side, out to the lane, back along it, into the head's right side (or up into its face, see laneHeads)
        const lane = laneY(i), face = faceOf.get(i);
        if (face) { out.set(i, simplify([start, {x: turns.tail, y: start.y}, {x: turns.tail, y: lane}, {x: face.x, y: lane}, face])); return; }
        out.set(i, simplify([start, {x: turns.tail, y: start.y}, {x: turns.tail, y: lane}, {x: turns.head, y: lane}, {x: turns.head, y: end.y}, end]));
        return;
      }
      // a direct arrow turns in a lane: a place in the gap between its two layers (from the left side for a forward arrow, from the right
      // side for a return), whatever the widths of the boxes it leaves and enters
      let turn: number | undefined;
      if (e.points.length === 2) {
        const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = must(layerRight.get(lo)), gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB, gw = gr - gl;
        // the last run keeps room for the arrowhead. TODO(ADR 0070 U4c): `gw / 2` lets it shrink below the head's room in a gap under
        // 2 x headRun. Only a direct arrow the tracks did not move is left to it (U4b's `strict` pass keeps headRun for the ones it moves); the
        // gaps are tall enough today (`gapFor`), and no figure of the reviews had a `loose` AND from it. U4c widens such a gap
        const d = Math.min(STUB + (laneOf.get(i) ?? 0), Math.max(gw / 2, gw - headRunOf(e.to)));
        turn = turnAt.get(i) ?? (forward(i) ? gl + d : gr - d);
      }
      // a long arrow into a grouped head (an AND) makes its last turn a fixed distance before the head, clear of the lanes of the direct arrows
      // (which are counted from the gap's left side), so the two kinds never run side by side. With `tracks` (ADR 0070 D4, U4b) that last
      // turn is one turn of its gap like the others: placeTracks gives it a track, at least `headRun` before the head
      let lastTurn: number | undefined;
      if (groupOf && e.points.length > 2 && forward(i)) {
        const lo = layerOf(e.to) - 1, gl = layerRight.get(lo), gr = layerLeft.get(lo + 1);
        if (gl !== undefined && gr !== undefined) { const k = longInto.get(e.to) ?? 0; longInto.set(e.to, k + 1); const tr = turnRunOf(e.to); lastTurn = laneShare && longLane.has(i) ? Math.min(gr - tr, gl + STUB + must(longLane.get(i)) * laneIn(lo)) : Math.max(gl + STUB, gr - tr - k * laneIn(lo)); }
      }
      const dz = shiftOf.get(i) ?? 0;
      const found = detours.get(i);
      if (found) { out.set(i, [start, ...found.slice(1, -1), end]); return; }
      const pts = [start, ...e.points.slice(1, -1).map(p => dz ? {x: p.x, y: p.y + dz} : p), end];
      const turnsOf: (number | undefined)[] = pts.length === 2 ? [turn] : [], homes: (number | undefined)[] = [];
      if (lastTurn !== undefined) (tracks ? homes : turnsOf)[pts.length - 2] = lastTurn;
      if (!tracks) { out.set(i, elbows(pts, turnsOf)); return; }
      out.set(i, []); // a place in the map's order; the route is made once the gaps' tracks are known
      pending.push({i, pts, turns: turnsOf, homes, mark: 0});
    });
    if (tracks) {
      const routeOf = placeTracks(pending, out);
      for (const o of pending) out.set(o.i, routeOf(o));
    }
    return out;
  };

  // ADR 0016 D3: an arrow between two boxes that overlap along the layer's cross axis becomes one straight line, when its two ports can
  // be moved to one height. Each candidate is tried against the whole drawing and kept only if (crossings, bends) get strictly better and
  // the new straight run does not lie along another arrow's run, so a figure never gets worse.
  const centreY = (id: string): number => { const n = nodeOf(id); return n.y + n.h / 2; };
  const endY = (i: number, end: 0 | 1): number => { const e = edgeAt(i); return centreY(end === 0 ? e.from : e.to) + (portOf.get((i * 2 + end)) ?? 0); };
  const pairOf = (i: number): string => { const e = edgeAt(i); return `${Math.min(layerOf(e.from), layerOf(e.to))}`; };
  /**
   * Moves both ports of arrow `i` to one height; returns how to take it back, or undefined when no such height exists.
   * `tailOnly` (ADR 0073 D3, an arrow into an AND's head): the head's port stays (the ports at the head and the arc keep their ADR 0070 D3/D8 values); only the
   * tail's port moves, onto the head's height, and only when that height is inside the tail's box.
   */
  const align = (i: number, tailOnly = false): (() => void) | undefined => {
    const e = edgeAt(i), A = nodeOf(e.from), B = nodeOf(e.to);
    const ya = endY(i, 0), yb = endY(i, 1);
    if (Math.abs(ya - yb) < 0.5) return undefined;
    // (1) both boxes reach this height, 6px inside their edges (the same margin as the ports'); (2) the neighbours on each side keep a step
    let lo = tailOnly ? A.y + 6 : Math.max(A.y, B.y) + 6, hi = tailOnly ? A.y + A.h - 6 : Math.min(A.y + A.h, B.y + B.h) - 6;
    for (const end of tailOnly ? [0] as const : [0, 1] as const) {
      const slot = must(slotOf.get((i * 2 + end)));
      const near = (k: number): number | undefined => { const o = slot.list[k]; return o ? endY(o.edge, o.end) : undefined; };
      const prev = near(slot.k - 1), next = near(slot.k + 1);
      if (prev !== undefined) lo = Math.max(lo, prev + slot.before);
      if (next !== undefined) hi = Math.min(hi, next - slot.after);
    }
    if (lo > hi) return undefined;
    // the target is the head's height as it is, never clamped into the range (a clamped tail would only move the step)
    if (tailOnly && (yb < lo - 0.01 || yb > hi + 0.01)) return undefined;
    const y = tailOnly ? yb : Math.min(hi, Math.max(lo, (ya + yb) / 2));
    // (3) no other arrow of this pair of layers has a port at this height (their runs would line up as one line)
    const own = new Set([i * 2, i * 2 + 1]);
    for (const [j, o] of lay.edges.entries()) {
      if (j === i || o.self || pairOf(j) !== pairOf(i)) continue;
      for (const end of [0, 1] as const) if (!own.has((j * 2 + end)) && Math.abs(endY(j, end) - y) < 3) return undefined;
    }
    const was = [portOf.get((i * 2)), portOf.get((i * 2 + 1))];
    portOf.set((i * 2), y - centreY(e.from)); if (!tailOnly) portOf.set((i * 2 + 1), y - centreY(e.to));
    return () => { for (const end of [0, 1] as const) { if (was[end] === undefined) portOf.delete((i * 2 + end)); else portOf.set((i * 2 + end), was[end]); } };
  };
  /** Does the straight run of arrow `i` lie along a horizontal run of another arrow (within 3px, sharing more than a point)? */
  const alongOther = (routes: Map<number, Pt[]>, i: number): boolean => {
    const r = must(routes.get(i));
    if (r.length !== 2) return false;
    const r0 = at(r, 0), r1 = at(r, 1), lo = Math.min(r0.x, r1.x), hi = Math.max(r0.x, r1.x);
    for (const [j, p] of routes) {
      if (j === i) continue;
      for (let k = 1; k < p.length; k++) { const a = at(p, k - 1), b = at(p, k); if (b.y === a.y && Math.abs(b.y - r0.y) < 3 && Math.min(hi, Math.max(b.x, a.x)) - Math.max(lo, Math.min(b.x, a.x)) > 1) return true; }
    }
    return false;
  };
  let routes = build();
  // (`reordered` is true almost always: the constrained order differs from the old one in some gap of nearly every figure, so this costs a second build() each time; U4c: only the gaps that changed)
  // ADR 0070 D4 (U4b): the lanes in the order of the vertical constraints are kept only when the figure is no worse in (crossings, pairs on
  // one line, bends) than with the lanes in the old order (the direct arrows' order does not see the long arrows' turns)
  if (tracks && reordered) {
    constrainLanes = false; assignLanes(); turnOuter();
    const plain = build(), a = scoreOf([...routes.values()]), b = scoreOf([...plain.values()]), oa = alongEach(routes), ob = alongEach(plain);
    if (b.crossings < a.crossings || (b.crossings === a.crossings && (ob < oa || (ob === oa && b.bends < a.bends)))) routes = plain;
    else { constrainLanes = true; assignLanes(); turnOuter(); }
  }
  const direct = lay.edges.map((_e, i) => i).filter(i => { const e = edgeAt(i); return straighten && !e.self && !e.outer && e.points.length === 2 && groupOf?.(i) === undefined && !round?.(e.from) && !round?.(e.to) && (lonePorts || must(slotOf.get((i * 2))).list.length > 1 || must(slotOf.get((i * 2 + 1))).list.length > 1); });
  let best = scoreOf([...routes.values()]);
  // ADR 0070 D4 (U4c, `tracks`): a move after the tracks are placed (this one, the routes around the boxes, D12-D14) may not add a pair of runs under a lane step
  // apart, nor two runs on one line whose ends are under a lane step apart (the tracks' own spacing: what a move must not take away)
  const runCache = new WeakMap<Pt[], RoutedRuns>();
  /** `trial` lies against a route in a way `routes` did not, and takes no crossing away (a crossing is worse than a pair: the move that removes one may add one) */
  const gains = (trial: Map<number, Pt[]>, crossings = Infinity): boolean => tracks && crossings >= best.crossings && gainsRunPairs(routes, trial, LANE, runCache);
  for (const i of direct) {
    const undo = align(i);
    if (!undo) continue;
    const trial = build(), score = rescore(routes, best, trial, crossCache);
    if ((score.crossings < best.crossings || (score.crossings === best.crossings && score.bends < best.bends)) && !alongOther(trial, i) && !gains(trial, score.crossings)) { routes = trial; best = score; } else undo();
  }
  // ADR 0073 D3: an arrow into an AND's head (skipped above: `direct` leaves them, the head's ports are the AND's) gets its tail's port moved onto its head's height,
  // so the step between the two ports (one port step, or any size) goes. Kept only when (crossings, bends) get strictly better, the new line is not along another
  // arrow's run, no pair of runs is added (`gains`), and the AND's own arrows do not cross each other more
  if (groupOf && heads.andPorts && heads.tailAlign !== false) {
    for (const i of lay.edges.map((_e, k) => k).filter(k => { const e = edgeAt(k); return straighten && !e.self && !e.outer && e.points.length === 2 && groupOf(k) !== undefined && !round?.(e.from) && !round?.(e.to); })) {
      const undo = align(i, true);
      if (!undo) continue;
      const trial = build(), score = rescore(routes, best, trial, crossCache);
      if (tailMoveKept(best, score, () => alongOther(trial, i), () => gains(trial, score.crossings), () => groupCrossings(trial, groupOf) - groupCrossings(routes, groupOf))) { routes = trial; best = score; } else undo();
    }
  }
  // the arrows that became straight lines no longer take a lane: the others take their lanes again, over the room that is left
  if (spread) {
    const lanes = new Map(laneOf), turns = new Map(outerTurns), before = crowded;
    // how many arrows run through a box that is not one of their two ends: the new lanes may not add to them
    const pierced = (m: Map<number, Pt[]>): number => {
      let sum = 0;
      for (const [i, r] of m) {
        const e = edgeAt(i);
        for (const [id, n] of lay.nodes) {
          if (id === e.from || id === e.to) continue;
          for (let k = 1; k < r.length; k++) {
            const p = at(r, k - 1), q = at(r, k);
            if (Math.max(p.x, q.x) > n.x + 1 && Math.min(p.x, q.x) < n.x + n.w - 1 && Math.max(p.y, q.y) > n.y + 1 && Math.min(p.y, q.y) < n.y + n.h - 1) { sum++; break; }
          }
        }
      }
      return sum;
    };
    const piercedBefore = pierced(routes);
    crowded = undefined; assignLanes(); turnOuter();
    const trial = build(), score = rescore(routes, best, trial, crossCache);
    if (score.crossings <= best.crossings && score.bends <= best.bends && pierced(trial) <= piercedBefore) { routes = trial; best = score; }
    else { crowded = before; laneOf.clear(); for (const [k, v] of lanes) laneOf.set(k, v); outerTurns.clear(); for (const [k, v] of turns) outerTurns.set(k, v); }
  }
  // a long arrow (it passes a layer between its two ends) takes the way around the boxes with the fewest bends when that is strictly better in (crossings, bends):
  // its way points are the middle of each layer's gap, which can send it far out and back
  /** Does a run of the route lie on a box that is not one of the arrow's two ends? */
  const touches = (i: number, r: Pt[]): boolean => [...lay.nodes].some(([id, n]) => id !== edgeAt(i).from && id !== edgeAt(i).to && r.slice(1).some((q, k) => { const p = at(r, k); return Math.max(p.x, q.x) > n.x - 0.5 && Math.min(p.x, q.x) < n.x + n.w + 0.5 && Math.max(p.y, q.y) > n.y - 0.5 && Math.min(p.y, q.y) < n.y + n.h + 0.5; }));
  /** The vertical runs of a route that lie in a gap, with their place in the route: `[index of the run's first point, x]`, by gap. */
  const verticalsIn = (r: Pt[]): Map<number, [number, number][]> => {
    const m = new Map<number, [number, number][]>();
    for (let k = 0; k + 1 < r.length; k++) {
      const a = at(r, k), b = at(r, k + 1);
      if (Math.abs(a.x - b.x) >= 0.5 || Math.abs(a.y - b.y) < 0.5) continue;
      const g = gapAt(a.x);
      if (g !== undefined) m.set(g, [...m.get(g) ?? [], [k, a.x]]);
    }
    return m;
  };
  /**
   * ADR 0070 D4 (U4c): a route found around the boxes (`detour`) with each run across a gap moved to the track the arrow had there (`was`: the route
   * the tracks gave it, with one run across the gap). A gap where either has no such run, or more than one, is left as it is. Undefined when moving
   * a run makes a stretch turn back on itself (a run on either side of it would have to go the other way), or puts the route on a box.
   */
  const snapToTracks = (i: number, was: Pt[], route: Pt[]): Pt[] | undefined => {
    const mine = verticalsIn(route), given = verticalsIn(was), moved = route.map(p => ({...p}));
    for (const [g, list] of mine) {
      const own = given.get(g);
      if (list.length !== 1 || own?.length !== 1) continue;
      const [k] = at(list, 0), x = at(own, 0)[1];
      if (Math.abs(at(route, k).x - x) < 0.01) continue;
      at(moved, k).x = x; at(moved, k + 1).x = x;
      // the stretches beside it keep their way (or vanish), and each run along the layers still reaches the new place without turning back
      for (const [m, n] of [[k - 1, k], [k + 1, k + 2]] as const) {
        const p = route[m], q = route[n], p2 = moved[m], q2 = moved[n];
        if (p && q && p2 && q2 && Math.sign(q.x - p.x) * Math.sign(q2.x - p2.x) < 0) return undefined;
      }
    }
    const out = simplify(moved);
    return touches(i, out) ? undefined : out;
  };
  if (detour) {
    const rects = [...lay.nodes.values()].map(n => ({x: n.x, y: n.y, w: n.w, h: n.h})), bounds = {x: 0, y: 0, w: lay.w, h: lay.h};
    // the arrows into a grouped head (an AND) must not cross each other more than they did (an AND arc over crossing arrows reads wrongly: ADR 0015)
    const heads = new Set<string>();
    lay.edges.forEach((e, i) => { if (!e.self && groupOf?.(i) !== undefined) heads.add(e.to); });
    const andCross = (m: Map<number, Pt[]>): number => heads.size ? crossingsOf([...m].filter(([i]) => heads.has(edgeAt(i).to)).map(([, p]) => p)) : 0;
    let headCross = headCrossings([...routes.values()]), andNow = andCross(routes);
    for (const [i, e] of lay.edges.entries()) {
      const r = routes.get(i);
      if (!r || e.self || e.outer || e.points.length <= 2 || groupOf?.(i) !== undefined || at(r, r.length - 1).x <= at(r, 0).x) continue;
      // only an arrow that bends 3 times or more can get much better; one that runs along a box it should clear is searched whatever it bends
      const onBox = touches(i, r);
      if (r.length <= 4 && !onBox) continue;
      const rest = [...routes].filter(([j]) => j !== i).map(([, p]) => p);
      const found = searchRoute(at(r, 0), at(r, r.length - 1), rects, rest, bounds, {stub: STUB, tail: turnRunOf(e.to), margin: sc(8)});
      if (!found) continue;
      // ADR 0070 D4 (U4c, `tracks`): the route as found, when it lies against no route in a way the figure did not have (`gains`); else with each run across a gap moved
      // to the track the arrow was given there; where that cannot be (it would run onto a box), or it too adds a pair, the detour is not taken
      const found2 = simplify(found), snapped = tracks ? snapToTracks(i, r, found2) : undefined;
      for (const route of tracks ? [found2, ...(snapped ? [snapped] : [])] : [found2]) {
        // only this arrow changed: its crossings and bends against the rest, before and after
        const score = {crossings: best.crossings - crossingsWith(r, rest, {}, crossCache) + crossingsWith(route, rest, {}, crossCache), bends: best.bends - bendsOf(r) + bendsOf(route)};
        // strictly better in (crossings, bends); or it gets the arrow off a box it ran along or through, with no more crossings (the bends may grow: a figure that draws an arrow through a box is wrong)
        if (!(score.crossings < best.crossings || (score.crossings === best.crossings && score.bends < best.bends) || (onBox && !touches(i, route) && score.crossings <= best.crossings))) continue;
        const trial = new Map(routes); trial.set(i, route);
        // and no more crossings of another arrow's head (they read as joins), no more crossings among the arrows of an AND
        const heads2 = headCrossings([...trial.values()]), and2 = andCross(trial);
        if (heads2 <= headCross && and2 <= andNow && !gains(trial, score.crossings)) { detours.set(i, route); routes = trial; best = score; headCross = heads2; andNow = and2; break; }
      }
    }
  }
  // ADR 0016 D12 (only when asked, after the candidate is chosen; D13 for a direct arrow, below): a long arrow into a grouped head (an AND) whose run through the layers lies along another
  // arrow's run moves its way points aside. Taken only when that leaves no more arrows beside it (any head), makes no more crossings or bends, pierces no box and stays inside the band.
  if (aside && groupOf) {
    const heads = new Set<string>();
    lay.edges.forEach((e, i) => { if (!e.self && groupOf(i) !== undefined) heads.add(e.to); });
    const segs = (pts: Pt[]) => pts.slice(1).map((q, k) => ({p: at(pts, k), q}));
    /** The arrows whose runs lie along arrow `i`'s: all of them, and those into the same head as `i`. */
    const beside = (r: Map<number, Pt[]>, i: number): {all: number; head: number} => {
      const mine = segs(must(r.get(i))); let all = 0, head = 0;
      for (const [j, o] of r) {
        if (j === i || !segs(o).some(y => mine.some(x => runsTogether(x, y)))) continue;
        all++; if (edgeAt(j).to === edgeAt(i).to) head++;
      }
      return {all, head};
    };
    const pierces = (pts: Pt[], i: number): boolean => {
      const e = edgeAt(i);
      return segs(pts).some(({p, q}) => [...lay.nodes].some(([id, n]) => id !== e.from && id !== e.to && Math.max(p.x, q.x) > n.x + 1 && Math.min(p.x, q.x) < n.x + n.w - 1 && Math.max(p.y, q.y) > n.y + 1 && Math.min(p.y, q.y) < n.y + n.h - 1));
    };
    const inside = (pts: Pt[]): boolean => pts.every(p => p.y >= 0.5 && p.y <= lay.h - 0.5);
    // ADR 0016 D13: a direct arrow's first run lies along the last run of another arrow into the same head (the other turned first): its turn moves to just
    // before or after that arrow's last turn, so the two runs do not overlap along the layers.
    const lastTurnOf = (r: Map<number, Pt[]>, j: number): number | undefined => { const q = must(r.get(j)); return q.length >= 4 ? at(q, q.length - 3).x : undefined; };
    for (const i of [...routes.keys()]) {
      const e = edgeAt(i);
      if (e.self || e.outer || !heads.has(e.to)) continue;
      const now = beside(routes, i);
      if (!now.head) continue;
      const tries: (() => void)[] = [];
      if (e.points.length > 2) for (const dz of [sc(8), -sc(8), sc(16), -sc(16)]) tries.push(() => shiftOf.set(i, dz));
      else {
        const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = must(layerRight.get(lo)), gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB;
        for (const [j, o] of routes) {
          if (j === i || edgeAt(j).to !== e.to || !segs(o).some(y => segs(must(routes.get(i))).some(x => runsTogether(x, y)))) continue;
          const at = lastTurnOf(routes, j);
          if (at === undefined) continue;
          // the last run keeps room for the arrowhead, on the head's side of the gap (the right for a forward arrow, the left for a return)
          for (const x of [at - LANE, at + LANE, at - sc(6), at + sc(6)]) if (forward(i) ? x > gl + sc(4) && x < gr - headRunOf(e.to) : x > gl + headRunOf(e.to) && x < gr - sc(4)) tries.push(() => turnAt.set(i, x));
        }
      }
      for (const set of tries) {
        set();
        const trial = build(), s = rescore(routes, best, trial, crossCache), t = beside(trial, i);
        // (with tracks) a move that gets two arrows off one line (under 4px: `beside`) may add up to two pairs of runs under a lane step (one neighbour each side of the line it moved to) for each overlap it takes off one line: an overlap reads worse (PR #398 #93).
        // The arrows into the heads of ANDs do not cross each other more than they did: a move that trades a crossing there for another is no gain (an AND's arc reads wrongly over crossing arrows, ADR 0015)
        if (t.head < now.head && t.all <= now.all && s.crossings <= best.crossings && s.bends <= best.bends && inside(must(trial.get(i))) && !pierces(must(trial.get(i)), i) && (!gains(trial, s.crossings) || (t.all < now.all && runPairGain(routes, trial, LANE, runCache) <= 2 * (now.all - t.all))) && (!tracks || groupCrossings(trial, groupOf) <= groupCrossings(routes, groupOf))) { routes = trial; best = s; break; }
        shiftOf.delete(i); turnAt.delete(i);
      }
    }
  }
  return new Map([...routes].map(([i, pts]) => [i, pts.map(place)]));
}

/**
 * The most direct arrows that pass through one gap between two layers (each needs its own lane there). The gaps are not sized by `trackLoad`: it depends on the order of the
 * boxes in a layer (which long arrows' turns overlap), so with it the layer coordinates differ from order to order and the order search (toc.ts, "the same layers") drops
 * its candidates (ADR 0070 U4c, review of PR #398).
 */
export function corridorLoad(lay: LayeredLayout): number {
  const load = new Map<string, number>();
  for (const e of lay.edges) {
    if (e.self || e.points.length !== 2) continue;
    const A = must(lay.nodes.get(e.from)), B = must(lay.nodes.get(e.to));
    const k = `${Math.round(Math.min(A.x + A.w / 2, B.x + B.w / 2))}:${Math.round(Math.max(A.x + A.w / 2, B.x + B.w / 2))}`; // the same key as routeLayered's corridors: layers by their centres
    load.set(k, (load.get(k) ?? 0) + 1);
  }
  // the turns of the returns in an outer lane sit in the gaps too, beside the direct arrows
  const direct = new Map<number, number>(), outerIn = new Map<number, number>();
  for (const e of lay.edges) {
    if (e.self) continue;
    const l1 = must(lay.layers.get(e.from)), l2 = must(lay.layers.get(e.to));
    if (e.outer) for (const g of [l1 - 1, l2]) outerIn.set(g, (outerIn.get(g) ?? 0) + 1);
    else if (e.points.length === 2) direct.set(Math.min(l1, l2), (direct.get(Math.min(l1, l2)) ?? 0) + 1);
  }
  return Math.max(1, ...load.values(), ...[...outerIn].map(([g, n]) => n + (direct.get(g) ?? 0)));
}

/**
 * layoutLayered, with the gap between layers wide enough for the arrows that share it: laid out once to see how many arrows go
 * through each gap (layers do not depend on the gap), then again with a gap that gives each its own lane.
 */
export function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]; back?: readonly number[]}, chip = 0, space = 1, scale = 1): LayeredLayout {
  const first = layoutLayered(nodes, edges, opts);
  const need = gapFor(corridorLoad(first), chip, space, scale);
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
  /** The nodes that are not rectangles (circles, hexagons): an arrow to or from one is never straightened off the middle of its side (routeLayered's `round`). */
  round?: (id: string) => boolean;
  /** Ids of the ANDs (or other groups) the routes leave undrawable. */
  looseOf?: (routes: Map<number, Pt[]>, lay: LayeredLayout) => string[];
  /** false: the plain layout only, no second candidate (the way back to the old figure). Default true. */
  straighten?: boolean;
  /** The second candidate also pulls source nodes toward their targets (graph-layout.ts `tighten`). Default false: a cause tree reads its causes at the first layer. */
  tighten?: boolean;
  /** The scale of the gaps (`WrapEnv.space`): the stub and the lane step of the arrows shrink with it. Default 1. */
  space?: number;
  /** ADR 0070 D7: the scale of the lines (stub, lane step, ports' room, the jogs of the later moves) of a cause tree's own band on a canvas: `max(1, the canvas's font scale)`.
   *  Kept apart from `space`; routing works out `unit = space x scale`. Default 1. */
  scale?: number;
  /** A long arrow takes the way around the boxes with the fewest bends when that is strictly better (route-search.ts). Default false. */
  detour?: boolean;
  /** Runs of arrows with no end in common that lie along each other are moved apart, once, on the chosen candidate (route-apart.ts, ADR 0016 D14). Default false. */
  apart?: boolean;
  /** false: no ADR 0016 D12/D13 pass (side-by-side runs moved aside) on the chosen candidate. Default true. */
  aside?: boolean;
  /** Returns two layers or more long run in lanes outside the figure: 'all' of them, or only the 'declared' ones (`back`). Default none (through the layers). */
  returns?: 'all' | 'declared';
  /** Room before the heads and the ports next to an AND (routeLayered's `heads`, ADR 0070 D3・D8). Default: the old 22 / 26, even ports. */
  heads?: HeadRoom;
  /** ADR 0070 D4 (U4a): each turn of a long arrow across a gap gets a track of its own (routeLayered's `tracks`; a cause tree's own band only). Default false: half-way across the gap. */
  tracks?: boolean;
  /** ADR 0073 D1-2: the figure's height (`Attempt.size.h`, rounded) is the last key when two attempts are compared. A cause tree's own band only. */
  heightKey?: boolean;
  /** ADR 0073 D2: the run pairs under one lane step of the figure's lines (`laneStepOf(space x scale)`) are a key of `better()` (crossings, pairs, bends, height), with the window of D1-4 on the bends. A cause tree's own band only. */
  pairsKey?: boolean;
}

export interface Attempt {
  lay: LayeredLayout;
  routes: Map<number, Pt[]>;
  /** Corners and crossings of the routed arrows (placed points); lower is better. */
  score: {crossings: number; bends: number; /** run pairs at the lane step (`pairsKey` only) */ pairs?: number};
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
    const e = at(a.lay.edges, i);
    for (const [id, r] of rects) {
      if (id === e.from || id === e.to) continue;
      if (pts.slice(1).some((q, k) => { const p = at(pts, k); return Math.min(p.x, q.x) < r.x1 && Math.max(p.x, q.x) > r.x0 && Math.min(p.y, q.y) < r.y1 && Math.max(p.y, q.y) > r.y0; })) count++;
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
  const unit = (o.space ?? 1) * (o.scale ?? 1); // ADR 0070 D7
  const scoreP = (routes: ReadonlyMap<number, Pt[]>): Attempt['score'] => { const pts = [...routes.values()], sc = scoreOf(pts); return o.pairsKey ? {...sc, pairs: pairsOf(pts, laneStepOf(unit))} : sc; };
  const keyOf = (a: Attempt): number[] => attemptKey(a, o.heightKey);
  // ADR 0073 D2: one attempt is better than another when the selection of the two (window and all) is the first: the list is [b, a], so that a tie keeps b
  const better = (a: Attempt, b: Attempt): boolean => selectIndex([keyOf(b), keyOf(a)]) === 1;
  type Side = 'far' | 'near' | 'low';
  let laneHeads = false; // the returns end on the face of their head that looks at the lane (routeLayered's `laneHeads`); set only for the last try below
  const optsOf = new WeakMap<Attempt, {opts: typeof layoutOpts; laneShare: boolean; near: Side}>();
  const build = (opts: typeof layoutOpts, laneShare = false, aside = false, near: Side = 'far'): Attempt => {
    const lay = layoutWithLanes(nodes, edges, o.returns ? {...opts, outer: {which: o.returns, gap: stubOf(unit), step: laneStepOf(unit), ...(near === 'far' ? {} : {side: near})}} : opts, 0, o.space, o.scale);
    const sizeOf = (l: LayeredLayout): {w: number; h: number} => ({w: o.transpose ? l.h : l.w, h: o.transpose ? l.w : l.h});
    const size = sizeOf(lay);
    const groupOf = o.groupOf;
    const routes = routeLayered(lay, o.place(size), o.portStep, groupOf && (i => groupOf(at(lay.edges, i).index)), o.round, o.straighten !== false, laneShare, aside, o.detour === true && opts.coord === 'bk', o.detour === true, o.space, laneHeads, o.heads, o.tracks === true, o.scale); // the search for a way around the boxes only in the straightened candidate (it competes with the plain one on bends); a lone port is straightened in both
    const made = {lay, routes, score: scoreP(routes), size, fits: o.maxAcross === undefined || size.w <= o.maxAcross, loose: o.looseOf ? o.looseOf(routes, lay) : []};
    optsOf.set(made, {opts, laneShare, near});
    return made;
  };
  // ADR 0016 D11: arrows into a grouped head that run side by side. A candidate that shares the gap's lanes between the long and the direct arrows replaces the figure only
  // when it has strictly fewer of them and is no worse in (crossings, bends), loose groups, piercings and width: a figure with none is never touched.
  const parallels = (a: Attempt): number => {
    const heads = new Set<string>(), groupOf = must(o.groupOf);
    a.lay.edges.forEach(e => { if (!e.self && groupOf(e.index) !== undefined) heads.add(e.to); });
    const segs = [...a.routes].filter(([i]) => heads.has(at(a.lay.edges, i).to)).map(([i, pts]) => ({i, to: at(a.lay.edges, i).to, s: pts.slice(1).map((q, m) => ({p: at(pts, m), q}))}));
    let n = 0;
    for (const [x, sx] of segs.entries()) for (const sy of segs.slice(x + 1)) if (sx.to === sy.to && sx.s.some(p => sy.s.some(q => runsTogether(p, q)))) n++;
    return n;
  };
  const worse = (a: Attempt, b: Attempt): boolean => worseThan(a, b, x => piercings(x, o.place(x.size)), o.heightKey);
  // the AND-bound arrows that cross each other
  const andCrossings = (a: Attempt): number => {
    const heads = new Set<string>(), groupOf = must(o.groupOf);
    a.lay.edges.forEach(e => { if (!e.self && groupOf(e.index) !== undefined) heads.add(e.to); });
    return crossingsOf([...a.routes].filter(([i]) => heads.has(at(a.lay.edges, i).to)).map(([, pts]) => pts));
  };
  // ADR 0016 D12: what is chosen then gets its remaining side-by-side runs moved aside, once; kept only when nothing else gets worse
  const aside = (a: Attempt): Attempt => {
    const before = parallels(a);
    if (!before) return a;
    const {opts, laneShare, near} = must(optsOf.get(a)), b = build(opts, laneShare, true, near);
    if (rejectsAside(a, b, {before, parallels, andCrossings, worse})) return a;
    return b;
  };
  const sharing = (a: Attempt): Attempt => {
    if (!o.groupOf || !a.fits) return a;
    const before = parallels(a);
    if (!before) return a;
    // with tracks (ADR 0070 D4, U4b) the long arrows' last turns are placed with the lanes of their gap: sharing the lanes is no other figure
    if (o.tracks) return o.aside === false ? a : aside(a);
    const b = build(must(optsOf.get(a)).opts, true, false, must(optsOf.get(a)).near);
    const chosen = rejectsSharing(a, b, {before, parallels, worse}) ? a : b;
    return o.aside === false ? chosen : aside(chosen);
  };
  // ADR 0016 D14: what is chosen gets the runs of arrows with no end in common that lie along each other moved apart, once; kept only when nothing else gets worse
  const apartOf = (a: Attempt): Attempt => {
    if (!o.apart) return a;
    const place = o.place(a.size), rects = new Map<string, {x0: number; x1: number; y0: number; y1: number}>();
    for (const [id, n] of a.lay.nodes) {
      const p = place({x: n.x, y: n.y}), q = place({x: n.x + n.w, y: n.y + n.h});
      rects.set(id, {x0: Math.min(p.x, q.x) + 1, x1: Math.max(p.x, q.x) - 1, y0: Math.min(p.y, q.y) + 1, y1: Math.max(p.y, q.y) - 1});
    }
    // the heads an AND arrives at keep the room its arc needs (ADR 0070 D8, `heads`); the others the old 22
    const andHeads = new Set<string>(), groupOf = o.groupOf, run = o.heads?.headRun;
    if (groupOf && run !== undefined) a.lay.edges.forEach(e => { if (!e.self && groupOf(e.index) !== undefined) andHeads.add(e.to); });
    const routes = moveApart({routes: a.routes, edges: new Map(a.lay.edges.map((e, i) => [i, {from: e.from, to: e.to, self: e.self, outer: e.outer}])), rects, ...(run === undefined ? {} : {headRun: (i: number) => andHeads.has(at(a.lay.edges, i).to) ? run : 22}), ...(o.scale === undefined ? {} : {scale: o.scale}), ...(o.tracks ? {sep: laneStepOf(unit)} : {})});
    if ([...routes].every(([i, r]) => r === a.routes.get(i))) return a;
    const b: Attempt = {...a, routes, score: scoreP(routes), loose: o.looseOf ? o.looseOf(routes, a.lay) : []};
    optsOf.set(b, must(optsOf.get(a)));
    if (rejectsApart(a, b, {grouped: o.groupOf !== undefined, parallels, andCrossings, worse})) return a;
    // the search of the orders is entered on the first figure's crossings (toc.ts): a move that takes the last crossing away would skip it where it ran
    if (a.score.crossings > 0 && b.score.crossings === 0) return a;
    return b;
  };
  // an attempt that does not fit is set aside by the fitting (only its width and its layers are read, for the message): the work that only moves its routes is not done (ADR 0053)
  const pick = (near: Side): Attempt => { const a = pick0(near); return a.fits ? apartOf(a) : a; };
  const pick0 = (near: Side): Attempt => {
  const plain = build(layoutOpts, false, false, near);
  if (o.straighten === false || !edges.some(e => e.from !== e.to)) return sharing(plain);
  const cand = build({...layoutOpts, coord: 'bk', transpose: true, ...(o.tighten ? {tighten: true} : {})}, false, false, near);
  if (cand.loose.length > plain.loose.length) return sharing(plain);
  if (piercings(cand, o.place(cand.size)) > piercings(plain, o.place(plain.size))) return sharing(plain);
  if (!plain.fits) return sharing(cand.fits || cand.size.w < plain.size.w && better(cand, plain) ? cand : plain);
  if (!cand.fits) return sharing(plain);
  return sharing(selectAttempt([plain, cand], o.heightKey));
  };
  // a return's lane goes to the side its ends are nearer to, only when that is strictly better in (crossings, bends) and nothing else gets worse (the far side is the way it always was)
  const far = pick('far');
  if (!o.returns || o.straighten === false || !far.lay.edges.some(e => e.outer)) return far; // straighten: false keeps the old coordinates, lanes included
  // not bigger than the far one: the width and the height are the caller's budget (a taller figure may not fit the canvas), and lanes on both sides take more room than on one
  // (ADR 0073 D2: `selectSides` chooses from the sides as one list)
  const result = selectSides(far, (['near', 'low'] as const).map(pick).filter(c => c.lay.edges.some(e => e.outer) && c.lay.w <= far.lay.w + 0.01 && c.lay.h <= far.lay.h + 0.01), worse, o.heightKey);
  // a return that enters its head's face instead of its right side, only when that takes crossings away (fewer bends alone moves nothing) and nothing else gets worse
  laneHeads = true;
  const c = pick(must(optsOf.get(result)).near);
  laneHeads = false;
  return c.lay.edges.some(e => e.outer) && c.lay.w <= result.lay.w + 0.01 && c.lay.h <= result.lay.h + 0.01 && !worse(result, c) && c.score.crossings < result.score.crossings ? c : result;
}

/**
 * The key of an attempt for the selection (ADR 0073 D2): [crossings, pairs, bends, height]. The pairs are 0 without `pairsKey`, the height (`size.h`, rounded) is 0 without `heightKey` (ADR 0073 D1-2).
 * C, the part the window is measured on, is the crossings alone: `better()` has no AND key of its own (`apartOf` and `aside` guard the AND crossings apart).
 */
export const attemptKey = (a: Attempt, heightKey: boolean | undefined): number[] => [a.score.crossings, a.score.pairs ?? 0, a.score.bends, heightKey === true ? Math.round(a.size.h) : 0];

/**
 * `b` is worse than `a` (ADR 0073 D2; `worse` of `layeredAttempt`, which `aside`, `sharing` and `apartOf` use): more ANDs left undrawn, does not fit where `a` does, `a` is better by the selection of the two
 * (pairs and the window of the bends included), or more arrows through a box. `piercingsOf` counts the arrows through a box of an attempt.
 */
export const worseThan = (a: Attempt, b: Attempt, piercingsOf: (x: Attempt) => number, heightKey?: boolean): boolean =>
  b.loose.length > a.loose.length || (a.fits && !b.fits) || selectIndex([attemptKey(b, heightKey), attemptKey(a, heightKey)]) === 1 || piercingsOf(b) > piercingsOf(a);

/**
 * The side a return's lane goes to (ADR 0073 D2): `far` and the sides that passed the size checks are one list that `selectAttempt` chooses from; a side joins it only when it is no worse than the pick so far
 * (`worse`). Of the three (far, near, low) the choice is the same in whatever order the sides come.
 */
export function selectSides(far: Attempt, sides: readonly Attempt[], worse: (a: Attempt, b: Attempt) => boolean, heightKey?: boolean): Attempt {
  const list = [far];
  let result = far;
  for (const c of sides) if (!worse(result, c)) { list.push(c); result = selectAttempt(list, heightKey); }
  return result;
}
/** ADR 0016 D12/D13 (`aside`): the move is kept out when it does not take a side-by-side AND run away, or is worse (pairs included, `worse`), or crosses the AND's arrows more. */
export const rejectsAside = (a: Attempt, b: Attempt, c: {before: number; parallels: (x: Attempt) => number; andCrossings: (x: Attempt) => number; worse: (a: Attempt, b: Attempt) => boolean}): boolean =>
  c.parallels(b) >= c.before || c.worse(a, b) || c.andCrossings(b) > c.andCrossings(a);
/** ADR 0016 D11 (`sharing`): the lanes' sharing is kept out when it does not take a side-by-side AND run away, or is worse (`worse`, pairs included). */
export const rejectsSharing = (a: Attempt, b: Attempt, c: {before: number; parallels: (x: Attempt) => number; worse: (a: Attempt, b: Attempt) => boolean}): boolean => c.parallels(b) >= c.before || c.worse(a, b);
/** ADR 0016 D14 (`apartOf`): the runs moved apart are kept out when worse (`worse`, pairs included), or, for a figure with ANDs, when they cross the AND's arrows more or run side by side more. */
export const rejectsApart = (a: Attempt, b: Attempt, c: {grouped: boolean; parallels: (x: Attempt) => number; andCrossings: (x: Attempt) => number; worse: (a: Attempt, b: Attempt) => boolean}): boolean =>
  c.worse(a, b) || (c.grouped && (c.andCrossings(b) > c.andCrossings(a) || c.parallels(b) > c.parallels(a)));

/** How many more bends than the least (among the figures with the least C) a figure may have and still be chosen for having fewer pairs (ADR 0073 D1-4: +4). */
export const BEND_WINDOW = 4;
/** `a` before `b` in lexicographic order. */
export const lexLess = (a: readonly number[], b: readonly number[]): boolean => { for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x !== y) return x !== undefined && y !== undefined && x < y; } return false; };
/**
 * The window of a list of candidates (ADR 0073 D2, the whole-list selection): each key ends with (pairs, bends, height), what comes before is C. The window is the candidates with the least C
 * (lexicographic) whose bends are at most the least bends (b*) among those + 4. Returns their indexes, in list order. A fold of two-way comparisons that had this window would be no order at all
 * (it is not transitive: pairs 0 / bends 9, pairs 1 / bends 5, pairs 2 / bends 1 go round), so every stage chooses from its whole list.
 */
export function windowOf(keys: readonly (readonly number[])[]): number[] {
  const cOf = (k: readonly number[]): readonly number[] => k.slice(0, -3), bendsOfKey = (k: readonly number[]): number => k.at(-2) ?? 0;
  let c: readonly number[] | undefined;
  for (const k of keys) if (c === undefined || lexLess(cOf(k), c)) c = cOf(k);
  const same = keys.flatMap((k, i) => c !== undefined && !lexLess(cOf(k), c) && !lexLess(c, cOf(k)) ? [i] : []);
  const least = Math.min(...same.map(i => bendsOfKey(must(keys[i]))));
  return same.filter(i => bendsOfKey(must(keys[i])) <= least + BEND_WINDOW);
}
/** The index of the chosen candidate: of the window, the least (pairs, bends, height); the first of equals. -1 for an empty list. Independent of the order of the list (up to equal keys). */
export function selectIndex(keys: readonly (readonly number[])[]): number {
  let pick = -1;
  for (const i of windowOf(keys)) if (pick < 0 || lexLess(must(keys[i]).slice(-3), must(keys[pick]).slice(-3))) pick = i;
  return pick;
}
/** The attempt chosen from a list (ADR 0073 D2): `pick0` and the lanes' sides call it once on their list. */
export const selectAttempt = (list: readonly Attempt[], heightKey?: boolean): Attempt => must(list[selectIndex(list.map(a => attemptKey(a, heightKey)))]);
