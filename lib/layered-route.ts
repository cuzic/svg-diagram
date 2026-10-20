// Orthogonal routing of the edges of a layered layout (graph-layout.ts layoutLayered), shared by stateDiagram() and classDiagram().
// Everything here is in the layout's own ('right') axes: layers run along x. `place` moves a point into the figure (and transposes
// it for a 'down' diagram).
import {layoutLayered} from './graph-layout.ts';
import type {LayeredEdge, LayeredLayout, LayeredNode, LayeredOpts, Pt} from './graph-layout.ts';
import {bendsOf, crossingsOf, crossingsWith, runsTogether, scoreOf, simplify} from './polyline-metrics.ts';
import {headCrossings, searchRoute} from './route-search.ts';
import {moveApart} from './route-apart.ts';

export {simplify};

export const STUB = 18;
export const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export const gapFor = (n: number, chip = 0, space = 1): number => Math.max(2 * stubOf(space) + laneStepOf(space) * Math.max(0, n - 1) + Math.round(16 * space), chip + stubOf(space) + 26);
/** The stub and the lane step at a scale of the gaps (`WrapEnv.space`: 1, or 0.75 for `density: 'compact'`). */
export const stubOf = (space = 1): number => Math.round(STUB * space);
export const laneStepOf = (space = 1): number => Math.round(LANE * space);
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


/** The pairs of arrows with runs along one line (they read as one): what spreading the lanes is for, so it may not make more. */
function alongEach(routes: Map<number, Pt[]>): number {
  const segs = [...routes.values()].map(r => r.slice(1).map((q, k) => ({p: r[k], q})));
  let n = 0;
  for (let x = 0; x < segs.length; x++) for (let y = x + 1; y < segs.length; y++) if (segs[x].some(u => segs[y].some(v => runsTogether(u, v)))) n++;
  return n;
}

/**
 * routeOnce twice: with the lanes of a gap at the fixed step, and spread over the room the gap has (`laneIn`). The spread routes are kept
 * only when (crossings, bends) is no worse: the order of the lanes is the same, but where they sit decides which runs cross.
 */
export function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten = true, laneShare = false, aside = false, detour = false, lonePorts = detour, space = 1, laneHeads = false): Map<number, Pt[]> {
  const fixed = routeOnce(lay, place, portStep, groupOf, round, straighten, laneShare, aside, detour, lonePorts, space, laneHeads, false);
  const spread = routeOnce(lay, place, portStep, groupOf, round, straighten, laneShare, aside, detour, lonePorts, space, laneHeads, true);
  const a = scoreOf([...fixed.values()]), b = scoreOf([...spread.values()]);
  return b.crossings <= a.crossings && b.bends <= a.bends && alongEach(spread) <= alongEach(fixed) ? spread : fixed;
}

/**
 * The polyline of every non-self edge (by its index in `lay.edges`), from the tail's box edge to the head's.
 * ports: the edges that meet one side of a box fan out along it (ordered by where the other end is, so they do not cross);
 * lanes: direct arrows through one gap between two layers take separate vertical runs.
 * straightening (ADR 0016 D3): a direct arrow whose two boxes overlap across the layer axis becomes one straight line when that does not make
 * the drawing worse; `round` names the nodes that are not rectangles (a circle, a hexagon), whose arrows keep to the middle of the side.
 */
function routeOnce(lay: LayeredLayout, place: (p: Pt) => Pt, portStep = 14, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten = true, laneShare = false, aside = false, detour = false, lonePorts = detour, space = 1, laneHeads = false, spread = true): Map<number, Pt[]> {
  const STUB = stubOf(space), LANE = laneStepOf(space); // this figure's stub and lane step (they shadow the module's)
  // ports: the edges that meet one side of a state fan out along it (ordered by where the other end is, so they do not cross)
  // lanes: direct arrows through one gap between two layers take separate vertical runs
  const portOf = new Map<string, number>(), laneOf = new Map<number, number>();
  const slotOf = new Map<string, {list: {edge: number; end: 0 | 1}[]; k: number; step: number}>(); // where each arrow end sits among the ends of its box side
  // the gap between layer l and l+1 runs from the right edge of the widest box of l to the left edge of the leftmost box of l+1
  const layerOf = (id: string): number => lay.layers.get(id)!;
  const layerRight = new Map<number, number>(), layerLeft = new Map<number, number>();
  for (const [id, n] of lay.nodes) {
    const l = layerOf(id);
    if (l === undefined) continue;
    layerRight.set(l, Math.max(layerRight.get(l) ?? -Infinity, n.x + n.w));
    layerLeft.set(l, Math.min(layerLeft.get(l) ?? Infinity, n.x));
  }
  // laneHeads: a return in an outer lane ends on the face of its head that looks at the lane (the bottom or the top), not on the head's right side,
  // where it would cross the arrows that leave that side. Only where the run from the lane to the face passes no other box.
  const faceOf = new Map<number, {x: number; y: number}>();
  if (laneHeads) {
    // the returns into one face of one box take places along it, a step apart; a box with a self-loop keeps its returns on the side (the loop is drawn outside the routes, on that face)
    const byFace = new Map<string, number[]>();
    lay.edges.forEach((e, i) => {
      if (e.self || !e.outer || lay.edges.some(l => l.self && l.from === e.to)) return;
      const B = lay.nodes.get(e.to)!, key = `${e.to}:${e.points[1].y > B.y + B.h / 2 ? 'b' : 't'}`;
      byFace.set(key, [...(byFace.get(key) ?? []), i]);
    });
    for (const list of byFace.values()) {
      const B = lay.nodes.get(lay.edges[list[0]].to)!, lane = lay.edges[list[0]].points[1].y, y = lane > B.y + B.h / 2 ? B.y + B.h : B.y;
      const step = list.length > 1 ? Math.min(portStep, (B.w - 12) / (list.length - 1)) : 0;
      // the tails are on the far side of the head, so the lane nearest the head takes the place nearest them (the right): a farther lane's vertical run then never crosses a nearer lane's run
      const order = [...list].sort((p, q) => Math.abs(lay.edges[p].points[1].y - y) - Math.abs(lay.edges[q].points[1].y - y) || p - q);
      order.forEach((i, k) => {
        const x = B.x + B.w / 2 + ((order.length - 1) / 2 - k) * step, lane = lay.edges[i].points[1].y, lo = Math.min(lane, y), hi = Math.max(lane, y);
        if ([...lay.nodes].some(([id, n]) => id !== lay.edges[i].to && x > n.x - 0.5 && x < n.x + n.w + 0.5 && hi > n.y - 0.5 && lo < n.y + n.h + 0.5)) return;
        faceOf.set(i, {x, y});
      });
    }
  }
  // The step between the lanes of one gap: the lanes of a gap are counted from its sides at LANE apart, which leaves a gap wider than they need with its lanes
  // crowded at the sides. They spread over the room the gap has left, up to twice the step; a gap with no room keeps LANE. Direct arrows, the long arrows into an AND
  // and the turns of the returns in an outer lane all use the step of their gap, so their order and the way they share the gap do not change.
  // a direct arrow whose two ports are at one height is a straight line: it has no vertical run, so it takes no lane (without `spread` the lanes are the old ones: every direct arrow has one)
  const level = (i: number): boolean => { if (!spread) return false; const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return Math.abs(A.y + A.h / 2 + (portOf.get(`${i}:0`) ?? 0) - (B.y + B.h / 2 + (portOf.get(`${i}:1`) ?? 0))) < 0.5; };
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
    return Math.min(2 * LANE, Math.max(LANE, Math.floor((gr - gl - 2 * STUB - Math.round(16 * space)) / (n - 1))));
  };
  const ends: {key: string; edge: number; end: 0 | 1; other: number}[] = [];
  const corridors = new Map<string, number[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
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
      portOf.set(`${en.edge}:${en.end}`, (k - (list.length - 1) / 2) * step + lower);
      slotOf.set(`${en.edge}:${en.end}`, {list, k, step});
    });
  }
  // fan-out (one tail): the arrow that goes farthest turns first (the lane nearest the tail), so no vertical run crosses another arrow's
  // last run. fan-in (one head, several tails): the other way round, the nearest tail turns first.
  const dy = (i: number): number => { const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return Math.abs((B.y + B.h / 2) - (A.y + A.h / 2)); };
  // arrows that go down and arrows that go up through the same gap are told apart too: the up group takes the lanes after the down group's
  const goesDown = (i: number): boolean => { const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!; return B.y + B.h / 2 >= A.y + A.h / 2; };
  // forward arrows (tail in the earlier layer) take lanes counted from the gap's left side, backward arrows (a return) from its right side,
  // so the two kinds never land on one lane (the gap is sized for all of them together, see gapFor)
  const forward = (i: number): boolean => layerOf(lay.edges[i].from) < layerOf(lay.edges[i].to);
  // ADR 0016 D11: a long arrow into a grouped head (an AND) takes the first lanes of the gap before the head, so its last turn lies on the tail side of the direct arrows' turns
  // and the two never run side by side; the direct arrows' lanes come after. Only when asked (the caller keeps it when the figure gets no worse).
  const longLane = new Map<number, number>(), longIn = new Map<number, number>();
  if (laneShare && groupOf) lay.edges.forEach((e, i) => {
    if (e.self || e.points.length <= 2 || groupOf(i) === undefined || !forward(i)) return;
    const lo = layerOf(e.to) - 1, k = longIn.get(lo) ?? 0;
    longIn.set(lo, k + 1); longLane.set(i, k);
  });
  const assignLanes = (): void => {
  laneOf.clear();
  for (const all0 of corridors.values()) {
    const all = all0.filter(i => !level(i));
    if (!all.length) continue;
    const gapOf = Math.min(layerOf(lay.edges[all[0]].from), layerOf(lay.edges[all[0]].to));
    for (const group of [all.filter(forward), all.filter(i => !forward(i))]) {
      let k = group.length && forward(group[0]) ? longIn.get(gapOf) ?? 0 : 0;
      for (const list of [group.filter(goesDown), group.filter(i => !goesDown(i))]) {
        const fanIn = new Set(list.map(i => lay.edges[i].to)).size === 1 && new Set(list.map(i => lay.edges[i].from)).size > 1;
        for (const i of [...list].sort((p, q) => (fanIn ? dy(p) - dy(q) : dy(q) - dy(p)) || p - q)) laneOf.set(i, k++ * laneIn(gapOf));
      }
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
  const within = (g: number, x: number, head = false): number => { if (!spread) return x; const gl = layerRight.get(g), gr = layerLeft.get(g + 1); return gl === undefined || gr === undefined ? x : Math.min(gr - STUB, Math.max(gl + (head ? Math.max(STUB, 22) : STUB), x)); }; // a turn stays inside its gap; the last run into a head keeps room for the arrowhead
  lay.edges.forEach((e, i) => {
    if (!e.outer) return;
    const gt = layerOf(e.from) - 1, gh = layerOf(e.to), kt = tailAt.get(gt) ?? 0, kh = headAt.get(gh) ?? 0;
    tailAt.set(gt, kt + 1); headAt.set(gh, kh + 1);
    outerTurns.set(i, {
      tail: within(gt, (layerLeft.get(gt + 1) ?? 0) - STUB - ((gapBack.get(gt) ?? 0) + kt) * laneIn(gt)),
      head: within(gh, (layerRight.get(gh) ?? 0) + STUB + ((gapFwd.get(gh) ?? 0) + kh) * laneIn(gh), true),
    });
  });
  };
  turnOuter();
  // the routes for the ports as they stand (in the layout's own axes)
  const shiftOf = new Map<number, number>(); // a long arrow's way points moved across the layers (ADR 0016 D12)
  const turnAt = new Map<number, number>(); // a direct arrow's turn moved to another x in its gap (ADR 0016 D13)
  const detours = new Map<number, Pt[]>(); // a long arrow's route found by searching around the boxes (`detour`): kept when the routes are built again
  const build = (): Map<number, Pt[]> => {
    const out = new Map<number, Pt[]>();
    const longInto = new Map<string, number>(); // long arrows into one head, each with its own last turn
    lay.edges.forEach((e, i) => {
      if (e.self) return;
      const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
      const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
      const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get(`${i}:0`) ?? 0)};
      const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get(`${i}:1`) ?? 0)};
      const turns = outerTurns.get(i);
      if (turns) { // out of the tail's left side, out to the lane, back along it, into the head's right side (or up into its face, see laneHeads)
        const lane = e.points[1].y, face = faceOf.get(i);
        if (face) { out.set(i, simplify([start, {x: turns.tail, y: start.y}, {x: turns.tail, y: lane}, {x: face.x, y: lane}, face])); return; }
        out.set(i, simplify([start, {x: turns.tail, y: start.y}, {x: turns.tail, y: lane}, {x: turns.head, y: lane}, {x: turns.head, y: end.y}, end]));
        return;
      }
      // a direct arrow turns in a lane: a place in the gap between its two layers (from the left side for a forward arrow, from the right
      // side for a return), whatever the widths of the boxes it leaves and enters
      let turn: number | undefined;
      if (e.points.length === 2) {
        const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = layerRight.get(lo)!, gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB, gw = gr - gl;
        const d = Math.min(STUB + (laneOf.get(i) ?? 0), Math.max(gw / 2, gw - 22)); // the last run keeps room for the arrowhead
        turn = turnAt.get(i) ?? (forward(i) ? gl + d : gr - d);
      }
      // a long arrow into a grouped head (an AND) makes its last turn a fixed distance before the head, clear of the lanes of the direct arrows
      // (which are counted from the gap's left side), so the two kinds never run side by side
      let lastTurn: number | undefined;
      if (groupOf && e.points.length > 2 && forward(i)) {
        const lo = layerOf(e.to) - 1, gl = layerRight.get(lo), gr = layerLeft.get(lo + 1);
        if (gl !== undefined && gr !== undefined) { const k = longInto.get(e.to) ?? 0; longInto.set(e.to, k + 1); lastTurn = laneShare && longLane.has(i) ? Math.min(gr - 26, gl + STUB + longLane.get(i)! * laneIn(lo)) : Math.max(gl + STUB, gr - 26 - k * laneIn(lo)); }
      }
      const dz = shiftOf.get(i) ?? 0;
      const found = detours.get(i);
      out.set(i, found ? [start, ...found.slice(1, -1), end] : elbows([start, ...e.points.slice(1, -1).map(p => dz ? {x: p.x, y: p.y + dz} : p), end], turn, lastTurn));
    });
    return out;
  };

  // ADR 0016 D3: an arrow between two boxes that overlap along the layer's cross axis becomes one straight line, when its two ports can
  // be moved to one height. Each candidate is tried against the whole drawing and kept only if (crossings, bends) get strictly better and
  // the new straight run does not lie along another arrow's run, so a figure never gets worse.
  const centreY = (id: string): number => { const n = lay.nodes.get(id)!; return n.y + n.h / 2; };
  const endY = (i: number, end: 0 | 1): number => { const e = lay.edges[i]; return centreY(end === 0 ? e.from : e.to) + (portOf.get(`${i}:${end}`) ?? 0); };
  const pairOf = (i: number): string => { const e = lay.edges[i]; return `${Math.min(layerOf(e.from), layerOf(e.to))}`; };
  /** Moves both ports of arrow `i` to one height; returns how to take it back, or undefined when no such height exists. */
  const align = (i: number): (() => void) | undefined => {
    const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!;
    const ya = endY(i, 0), yb = endY(i, 1);
    if (Math.abs(ya - yb) < 0.5) return undefined;
    // (1) both boxes reach this height, 6px inside their edges (the same margin as the ports'); (2) the neighbours on each side keep a step
    let lo = Math.max(A.y, B.y) + 6, hi = Math.min(A.y + A.h, B.y + B.h) - 6;
    for (const end of [0, 1] as const) {
      const slot = slotOf.get(`${i}:${end}`)!;
      const near = (k: number): number | undefined => { const o = slot.list[k]; return o ? endY(o.edge, o.end) : undefined; };
      const prev = near(slot.k - 1), next = near(slot.k + 1);
      if (prev !== undefined) lo = Math.max(lo, prev + slot.step);
      if (next !== undefined) hi = Math.min(hi, next - slot.step);
    }
    if (lo > hi) return undefined;
    const y = Math.min(hi, Math.max(lo, (ya + yb) / 2));
    // (3) no other arrow of this pair of layers has a port at this height (their runs would line up as one line)
    const own = new Set([`${i}:0`, `${i}:1`]);
    for (const [j, o] of lay.edges.entries()) {
      if (j === i || o.self || pairOf(j) !== pairOf(i)) continue;
      for (const end of [0, 1] as const) if (!own.has(`${j}:${end}`) && Math.abs(endY(j, end) - y) < 3) return undefined;
    }
    const was = [portOf.get(`${i}:0`), portOf.get(`${i}:1`)];
    portOf.set(`${i}:0`, y - centreY(e.from)); portOf.set(`${i}:1`, y - centreY(e.to));
    return () => { for (const end of [0, 1] as const) { if (was[end] === undefined) portOf.delete(`${i}:${end}`); else portOf.set(`${i}:${end}`, was[end]); } };
  };
  /** Does the straight run of arrow `i` lie along a horizontal run of another arrow (within 3px, sharing more than a point)? */
  const alongOther = (routes: Map<number, Pt[]>, i: number): boolean => {
    const r = routes.get(i)!;
    if (r.length !== 2) return false;
    const lo = Math.min(r[0].x, r[1].x), hi = Math.max(r[0].x, r[1].x);
    for (const [j, p] of routes) {
      if (j === i) continue;
      for (let k = 1; k < p.length; k++) if (p[k].y === p[k - 1].y && Math.abs(p[k].y - r[0].y) < 3 && Math.min(hi, Math.max(p[k].x, p[k - 1].x)) - Math.max(lo, Math.min(p[k].x, p[k - 1].x)) > 1) return true;
    }
    return false;
  };
  let routes = build();
  const direct = lay.edges.map((e, i) => i).filter(i => { const e = lay.edges[i]; return straighten && !e.self && !e.outer && e.points.length === 2 && groupOf?.(i) === undefined && !round?.(e.from) && !round?.(e.to) && (lonePorts || slotOf.get(`${i}:0`)!.list.length > 1 || slotOf.get(`${i}:1`)!.list.length > 1); });
  let best = scoreOf([...routes.values()]);
  for (const i of direct) {
    const undo = align(i);
    if (!undo) continue;
    const trial = build(), score = scoreOf([...trial.values()]);
    if ((score.crossings < best.crossings || (score.crossings === best.crossings && score.bends < best.bends)) && !alongOther(trial, i)) { routes = trial; best = score; } else undo();
  }
  // the arrows that became straight lines no longer take a lane: the others take their lanes again, over the room that is left
  if (spread) {
    const lanes = new Map(laneOf), turns = new Map(outerTurns), before = crowded;
    // how many arrows run through a box that is not one of their two ends: the new lanes may not add to them
    const pierced = (m: Map<number, Pt[]>): number => [...m].reduce((sum, [i, r]) => sum + [...lay.nodes].filter(([id, n]) => id !== lay.edges[i].from && id !== lay.edges[i].to && r.slice(1).some((q, k) => Math.max(r[k].x, q.x) > n.x + 1 && Math.min(r[k].x, q.x) < n.x + n.w - 1 && Math.max(r[k].y, q.y) > n.y + 1 && Math.min(r[k].y, q.y) < n.y + n.h - 1)).length, 0);
    const piercedBefore = pierced(routes);
    crowded = undefined; assignLanes(); turnOuter();
    const trial = build(), score = scoreOf([...trial.values()]);
    if (score.crossings <= best.crossings && score.bends <= best.bends && pierced(trial) <= piercedBefore) { routes = trial; best = score; }
    else { crowded = before; laneOf.clear(); for (const [k, v] of lanes) laneOf.set(k, v); outerTurns.clear(); for (const [k, v] of turns) outerTurns.set(k, v); }
  }
  // a long arrow (it passes a layer between its two ends) takes the way around the boxes with the fewest bends when that is strictly better in (crossings, bends):
  // its way points are the middle of each layer's gap, which can send it far out and back
  if (detour) {
    const rects = [...lay.nodes.values()].map(n => ({x: n.x, y: n.y, w: n.w, h: n.h})), bounds = {x: 0, y: 0, w: lay.w, h: lay.h};
    // the arrows into a grouped head (an AND) must not cross each other more than they did (an AND arc over crossing arrows reads wrongly: ADR 0015)
    const heads = new Set<string>();
    lay.edges.forEach((e, i) => { if (!e.self && groupOf?.(i) !== undefined) heads.add(e.to); });
    const andCross = (m: Map<number, Pt[]>): number => heads.size ? crossingsOf([...m].filter(([i]) => heads.has(lay.edges[i].to)).map(([, p]) => p)) : 0;
    /** Does a run of the route lie on a box that is not one of the arrow's two ends? */
    const touches = (i: number, r: Pt[]): boolean => [...lay.nodes].some(([id, n]) => id !== lay.edges[i].from && id !== lay.edges[i].to && r.slice(1).some((q, k) => { const p = r[k]; return Math.max(p.x, q.x) > n.x - 0.5 && Math.min(p.x, q.x) < n.x + n.w + 0.5 && Math.max(p.y, q.y) > n.y - 0.5 && Math.min(p.y, q.y) < n.y + n.h + 0.5; }));
    let headCross = headCrossings([...routes.values()]), andNow = andCross(routes);
    for (const [i, e] of lay.edges.entries()) {
      const r = routes.get(i);
      if (!r || e.self || e.outer || e.points.length <= 2 || groupOf?.(i) !== undefined || r[r.length - 1].x <= r[0].x) continue;
      // only an arrow that bends 3 times or more can get much better; one that runs along a box it should clear is searched whatever it bends
      const onBox = touches(i, r);
      if (r.length <= 4 && !onBox) continue;
      const rest = [...routes].filter(([j]) => j !== i).map(([, p]) => p);
      const found = searchRoute(r[0], r[r.length - 1], rects, rest, bounds, {stub: STUB});
      if (!found) continue;
      const route = simplify(found);
      // only this arrow changed: its crossings and bends against the rest, before and after
      const score = {crossings: best.crossings - crossingsWith(r, rest) + crossingsWith(route, rest), bends: best.bends - bendsOf(r) + bendsOf(route)};
      // strictly better in (crossings, bends); or it gets the arrow off a box it ran along or through, with no more crossings (the bends may grow: a figure that draws an arrow through a box is wrong)
      if (!(score.crossings < best.crossings || (score.crossings === best.crossings && score.bends < best.bends) || (onBox && !touches(i, route) && score.crossings <= best.crossings))) continue;
      const trial = new Map(routes); trial.set(i, route);
      // and no more crossings of another arrow's head (they read as joins), no more crossings among the arrows of an AND
      const heads2 = headCrossings([...trial.values()]), and2 = andCross(trial);
      if (heads2 <= headCross && and2 <= andNow) { detours.set(i, route); routes = trial; best = score; headCross = heads2; andNow = and2; }
    }
  }
  // ADR 0016 D12 (only when asked, after the candidate is chosen; D13 for a direct arrow, below): a long arrow into a grouped head (an AND) whose run through the layers lies along another
  // arrow's run moves its way points aside. Taken only when that leaves no more arrows beside it (any head), makes no more crossings or bends, pierces no box and stays inside the band.
  if (aside && groupOf) {
    const heads = new Set<string>();
    lay.edges.forEach((e, i) => { if (!e.self && groupOf(i) !== undefined) heads.add(e.to); });
    const segs = (pts: Pt[]) => pts.slice(1).map((q, k) => ({p: pts[k], q}));
    /** The arrows whose runs lie along arrow `i`'s: all of them, and those into the same head as `i`. */
    const beside = (r: Map<number, Pt[]>, i: number): {all: number; head: number} => {
      const mine = segs(r.get(i)!); let all = 0, head = 0;
      for (const [j, o] of r) {
        if (j === i || !segs(o).some(y => mine.some(x => runsTogether(x, y)))) continue;
        all++; if (lay.edges[j].to === lay.edges[i].to) head++;
      }
      return {all, head};
    };
    const pierces = (pts: Pt[], i: number): boolean => {
      const e = lay.edges[i];
      return segs(pts).some(({p, q}) => [...lay.nodes].some(([id, n]) => id !== e.from && id !== e.to && Math.max(p.x, q.x) > n.x + 1 && Math.min(p.x, q.x) < n.x + n.w - 1 && Math.max(p.y, q.y) > n.y + 1 && Math.min(p.y, q.y) < n.y + n.h - 1));
    };
    const inside = (pts: Pt[]): boolean => pts.every(p => p.y >= 0.5 && p.y <= lay.h - 0.5);
    // ADR 0016 D13: a direct arrow's first run lies along the last run of another arrow into the same head (the other turned first): its turn moves to just
    // before or after that arrow's last turn, so the two runs do not overlap along the layers.
    const lastTurnOf = (r: Map<number, Pt[]>, j: number): number | undefined => { const q = r.get(j)!; return q.length >= 4 ? q[q.length - 3].x : undefined; };
    for (const i of [...routes.keys()]) {
      const e = lay.edges[i];
      if (e.self || e.outer || !heads.has(e.to)) continue;
      const now = beside(routes, i);
      if (!now.head) continue;
      const tries: (() => void)[] = [];
      if (e.points.length > 2) for (const dz of [8, -8, 16, -16]) tries.push(() => shiftOf.set(i, dz));
      else {
        const lo = Math.min(layerOf(e.from), layerOf(e.to)), gl = layerRight.get(lo)!, gr = layerLeft.get(lo + 1) ?? gl + 2 * STUB;
        for (const [j, o] of routes) {
          if (j === i || lay.edges[j].to !== e.to || !segs(o).some(y => segs(routes.get(i)!).some(x => runsTogether(x, y)))) continue;
          const at = lastTurnOf(routes, j);
          if (at === undefined) continue;
          // the last run keeps room for the arrowhead, on the head's side of the gap (the right for a forward arrow, the left for a return)
          for (const x of [at - LANE, at + LANE, at - 6, at + 6]) if (forward(i) ? x > gl + 4 && x < gr - 22 : x > gl + 22 && x < gr - 4) tries.push(() => turnAt.set(i, x));
        }
      }
      for (const set of tries) {
        set();
        const trial = build(), s = scoreOf([...trial.values()]), t = beside(trial, i);
        if (t.head < now.head && t.all <= now.all && s.crossings <= best.crossings && s.bends <= best.bends && inside(trial.get(i)!) && !pierces(trial.get(i)!, i)) { routes = trial; best = s; break; }
        shiftOf.delete(i); turnAt.delete(i);
      }
    }
  }
  return new Map([...routes].map(([i, pts]) => [i, pts.map(place)]));
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
export function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]; back?: readonly number[]}, chip = 0, space = 1): LayeredLayout {
  const first = layoutLayered(nodes, edges, opts);
  const need = gapFor(corridorLoad(first), chip, space);
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
  /** A long arrow takes the way around the boxes with the fewest bends when that is strictly better (route-search.ts). Default false. */
  detour?: boolean;
  /** Runs of arrows with no end in common that lie along each other are moved apart, once, on the chosen candidate (route-apart.ts, ADR 0016 D14). Default false. */
  apart?: boolean;
  /** false: no ADR 0016 D12/D13 pass (side-by-side runs moved aside) on the chosen candidate. Default true. */
  aside?: boolean;
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
  /** ADR 0016 D12/D13 moved side-by-side runs aside in this candidate. */
  asided?: true;
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
  type Side = 'far' | 'near' | 'low';
  let laneHeads = false; // the returns end on the face of their head that looks at the lane (routeLayered's `laneHeads`); set only for the last try below
  const optsOf = new WeakMap<Attempt, {opts: typeof layoutOpts; laneShare: boolean; near: Side}>();
  const build = (opts: typeof layoutOpts, laneShare = false, aside = false, near: Side = 'far'): Attempt => {
    const lay = layoutWithLanes(nodes, edges, o.returns ? {...opts, outer: {which: o.returns, gap: stubOf(o.space), step: laneStepOf(o.space), ...(near === 'far' ? {} : {side: near})}} : opts, 0, o.space);
    const size = {w: o.transpose ? lay.h : lay.w, h: o.transpose ? lay.w : lay.h};
    const groupOf = o.groupOf;
    const routes = routeLayered(lay, o.place(size), o.portStep, groupOf && (i => groupOf(lay.edges[i].index)), o.round, o.straighten !== false, laneShare, aside, o.detour === true && opts.coord === 'bk', o.detour === true, o.space, laneHeads); // the search for a way around the boxes only in the straightened candidate (it competes with the plain one on bends); a lone port is straightened in both
    const made = {lay, routes, score: scoreOf([...routes.values()]), size, fits: o.maxAcross === undefined || size.w <= o.maxAcross, loose: o.looseOf ? o.looseOf(routes, lay) : []};
    optsOf.set(made, {opts, laneShare, near});
    return made;
  };
  // ADR 0016 D11: arrows into a grouped head that run side by side. A candidate that shares the gap's lanes between the long and the direct arrows replaces the figure only
  // when it has strictly fewer of them and is no worse in (crossings, bends), loose groups, piercings and width: a figure with none is never touched.
  const parallels = (a: Attempt): number => {
    const heads = new Set<string>(), groupOf = o.groupOf!;
    a.lay.edges.forEach(e => { if (!e.self && groupOf(e.index) !== undefined) heads.add(e.to); });
    const segs = [...a.routes].filter(([i]) => heads.has(a.lay.edges[i].to)).map(([i, pts]) => ({i, to: a.lay.edges[i].to, s: pts.slice(1).map((q, m) => ({p: pts[m], q}))}));
    let n = 0;
    for (let x = 0; x < segs.length; x++) for (let y = x + 1; y < segs.length; y++) if (segs[x].to === segs[y].to && segs[x].s.some(p => segs[y].s.some(q => runsTogether(p, q)))) n++;
    return n;
  };
  const worse = (a: Attempt, b: Attempt): boolean => b.loose.length > a.loose.length || (a.fits && !b.fits) || better(a.score, b.score) || piercings(b, o.place(b.size)) > piercings(a, o.place(a.size));
  // the AND-bound arrows that cross each other
  const andCrossings = (a: Attempt): number => {
    const heads = new Set<string>(), groupOf = o.groupOf!;
    a.lay.edges.forEach(e => { if (!e.self && groupOf(e.index) !== undefined) heads.add(e.to); });
    return crossingsOf([...a.routes].filter(([i]) => heads.has(a.lay.edges[i].to)).map(([, pts]) => pts));
  };
  // ADR 0016 D12: what is chosen then gets its remaining side-by-side runs moved aside, once; kept only when nothing else gets worse
  const aside = (a: Attempt): Attempt => {
    const before = parallels(a);
    if (!before) return a;
    const {opts, laneShare, near} = optsOf.get(a)!, b = build(opts, laneShare, true, near);
    if (parallels(b) >= before || worse(a, b) || andCrossings(b) > andCrossings(a)) return a;
    b.asided = true;
    return b;
  };
  const sharing = (a: Attempt): Attempt => {
    if (!o.groupOf) return a;
    const before = parallels(a);
    if (!before) return a;
    const b = build(optsOf.get(a)!.opts, true, false, optsOf.get(a)!.near);
    const chosen = parallels(b) >= before || worse(a, b) ? a : b;
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
    const routes = moveApart({routes: a.routes, edges: new Map(a.lay.edges.map((e, i) => [i, {from: e.from, to: e.to, self: e.self, outer: e.outer}])), rects});
    if ([...routes].every(([i, r]) => r === a.routes.get(i))) return a;
    const b: Attempt = {...a, routes, score: scoreOf([...routes.values()]), loose: o.looseOf ? o.looseOf(routes, a.lay) : []};
    optsOf.set(b, optsOf.get(a)!);
    if (worse(a, b) || (o.groupOf !== undefined && (andCrossings(b) > andCrossings(a) || parallels(b) > parallels(a)))) return a;
    // the search of the orders is entered on the first figure's crossings (toc.ts): a move that takes the last crossing away would skip it where it ran
    if (a.score.crossings > 0 && b.score.crossings === 0) return a;
    // an AND crossing it took away is judged like D12/D13's: toc.ts decides whether to search the orders on the figure without these moves
    if (o.groupOf !== undefined && andCrossings(b) < andCrossings(a)) b.asided = true;
    return b;
  };
  const pick = (near: Side): Attempt => apartOf(pick0(near));
  const pick0 = (near: Side): Attempt => {
  const plain = build(layoutOpts, false, false, near);
  if (o.straighten === false || !edges.some(e => e.from !== e.to)) return sharing(plain);
  const cand = build({...layoutOpts, coord: 'bk', transpose: true, ...(o.tighten ? {tighten: true} : {})}, false, false, near);
  if (cand.loose.length > plain.loose.length) return sharing(plain);
  if (piercings(cand, o.place(cand.size)) > piercings(plain, o.place(plain.size))) return sharing(plain);
  if (!plain.fits) return sharing(cand.fits || cand.size.w < plain.size.w && better(cand.score, plain.score) ? cand : plain);
  if (!cand.fits) return sharing(plain);
  return sharing(better(cand.score, plain.score) ? cand : plain);
  };
  // a return's lane goes to the side its ends are nearer to, only when that is strictly better in (crossings, bends) and nothing else gets worse (the far side is the way it always was)
  const far = pick('far');
  if (!o.returns || o.straighten === false || !far.lay.edges.some(e => e.outer)) return far; // straighten: false keeps the old coordinates, lanes included
  // not bigger than the far one: the width and the height are the caller's budget (a taller figure may not fit the canvas), and lanes on both sides take more room than on one
  let result = far;
  for (const side of ['near', 'low'] as const) {
    const c = pick(side);
    if (c.lay.edges.some(e => e.outer) && c.lay.w <= far.lay.w + 0.01 && c.lay.h <= far.lay.h + 0.01 && !worse(result, c) && better(c.score, result.score)) result = c;
  }
  // a return that enters its head's face instead of its right side, only when that takes crossings away (fewer bends alone moves nothing) and nothing else gets worse
  laneHeads = true;
  const c = pick(optsOf.get(result)!.near);
  laneHeads = false;
  return c.lay.edges.some(e => e.outer) && c.lay.w <= result.lay.w + 0.01 && c.lay.h <= result.lay.h + 0.01 && !worse(result, c) && c.score.crossings < result.score.crossings ? c : result;
}

/** (crossings, bends) in lexicographic order: strictly better only. */
const better = (a: {crossings: number; bends: number}, b: {crossings: number; bends: number}): boolean => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);
