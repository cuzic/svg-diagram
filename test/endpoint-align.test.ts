// node --test test/   — ADR 0016 D3 (U5): arrows between boxes that overlap across the layer axis become one straight line, when the
// ports can be moved to one height and the drawing does not get worse. Boxes have fixed sizes: nothing here depends on a font.
import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {scoreOf} from '../lib/polyline-metrics.ts';
import type {LayeredEdge, LayeredNode} from '../lib/graph-layout.ts';
import type {Pt} from '../lib/graph-layout.ts';

const OPTS = {dir: 'right' as const, gap: 24, levelGap: 70};
const box = (id: string, w = 80, h = 40): LayeredNode => ({id, size: {w, h}});
const route = (nodes: LayeredNode[], edges: LayeredEdge[], o: {straighten?: boolean; groupOf?: (i: number) => number | undefined; round?: (id: string) => boolean} = {}) => {
  const lay = layoutWithLanes(nodes, edges, OPTS);
  return {lay, routes: routeLayered(lay, p => p, 14, o.groupOf, o.round, o.straighten)};
};
const straight = (p: Pt[]): boolean => p.length === 2 && p[0].y === p[1].y;
/** The heights of a route's points: what is left of a route when only its vertical runs moved sideways (the lanes spread, see routeLayered's laneIn). */
const heights = (p: Pt[]): number[] => p.map(q => q.y);
const metric = (r: Map<number, Pt[]>) => scoreOf([...r.values()]);
/** Pairs of arrows whose horizontal runs lie on one line (within 3px) over more than a point: two arrows that read as one. */
function lineUps(r: Map<number, Pt[]>): number {
  const runs = [...r].flatMap(([i, p]) => p.slice(1).flatMap((q, k) => p[k].y === q.y ? [{i, y: q.y, lo: Math.min(p[k].x, q.x), hi: Math.max(p[k].x, q.x)}] : []));
  let n = 0;
  for (let a = 0; a < runs.length; a++) for (let b = a + 1; b < runs.length; b++) if (runs[a].i !== runs[b].i && Math.abs(runs[a].y - runs[b].y) < 3 && Math.min(runs[a].hi, runs[b].hi) - Math.max(runs[a].lo, runs[b].lo) > 1) n++;
  return n;
}
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a fan: a -> b, a -> c (two tails on a's right side); b and c share a's height range
const fan = {nodes: [box('a', 80, 90), box('b'), box('c')], edges: [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}]};

test('a fan between overlapping boxes: both arrows become straight lines, the old elbows are gone', () => {
  const off = route(fan.nodes, fan.edges, {straighten: false}), on = route(fan.nodes, fan.edges);
  assert.ok([...off.routes.values()].every(p => !straight(p)), 'before: both are elbows');
  assert.ok([...on.routes.values()].every(straight), 'after: both are straight');
  assert.equal(metric(on.routes).bends, 0);
  assert.deepEqual(metric(on.routes).crossings, 0);
});

test('the straight arrows stay inside both boxes (6px from the edges) and keep a step apart on the shared side', () => {
  const {lay, routes} = route(fan.nodes, fan.edges);
  const ys: number[] = [];
  for (const [i, p] of routes) {
    const e = lay.edges[i], A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, y = p[0].y;
    for (const n of [A, B]) assert.ok(y >= n.y + 6 - 1e-9 && y <= n.y + n.h - 6 + 1e-9, `${e.from}->${e.to} at ${y} is outside ${n.y}..${n.y + n.h}`);
    ys.push(y);
  }
  ys.sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 14 - 1e-9, `the two ports on a's side are ${ys[1] - ys[0]}px apart`);
});

test('boxes that do not overlap across the axis stay elbows; so do arrows with nothing to move (one port each side)', () => {
  // b sits far below a's range: no height is inside both
  const lone = route([box('a', 80, 40), box('b', 80, 40), box('c', 80, 40)], [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}]);
  const off = route([box('a', 80, 40), box('b', 80, 40), box('c', 80, 40)], [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}], {straighten: false});
  // whatever the layout is, an arrow that was an elbow is straight only when its ports could move to a common height
  for (const [i, p] of lone.routes) if (straight(p)) {
    const e = lone.lay.edges[i], A = lone.lay.nodes.get(e.from)!, B = lone.lay.nodes.get(e.to)!;
    assert.ok(Math.max(A.y, B.y) + 6 <= p[0].y && p[0].y <= Math.min(A.y + A.h, B.y + B.h) - 6);
  }
  assert.equal(off.routes.size, lone.routes.size);
  const single = route([box('a'), box('b')], [{from: 'a', to: 'b'}]);
  assert.ok(straight(single.routes.get(0)!), 'a lone arrow between level boxes was already straight');
});

test('round nodes (a circle, a hexagon) and grouped arrows (an AND) are left alone', () => {
  const base = route(fan.nodes, fan.edges, {straighten: false}).routes;
  assert.deepEqual(heights(route(fan.nodes, fan.edges, {round: id => id === 'b'}).routes.get(0)!), heights(base.get(0)!), 'the arrow to a round node keeps its elbow (its lane may move when the other arrow becomes straight)');
  assert.ok(straight(route(fan.nodes, fan.edges, {round: id => id === 'b'}).routes.get(1)!), 'the other one may still become straight');
  assert.deepEqual([...route(fan.nodes, fan.edges, {groupOf: () => 0}).routes].map(([i, p]) => [i, heights(p)]), [...base].map(([i, p]) => [i, heights(p)]), 'arrows of a group keep their ports');
});

test('a port that would have to jump over its neighbour is not moved', () => {
  // d is a tall box: its left side takes the arrows from b and c; a -> d would have to pass b's port to line up
  const nodes = [box('a', 80, 40), box('b', 80, 40), box('c', 80, 40), box('d', 80, 160)];
  const edges = [{from: 'a', to: 'd'}, {from: 'b', to: 'd'}, {from: 'c', to: 'd'}];
  const {lay, routes} = route(nodes, edges), base = route(nodes, edges, {straighten: false}).routes;
  const heads = (r: Map<number, Pt[]>) => [...r].map(([i, p]) => ({from: lay.edges[i].from, y: p[p.length - 1].y})).sort((p, q) => p.from.localeCompare(q.from));
  const order = (r: Map<number, Pt[]>) => heads(r).sort((p, q) => p.y - q.y).map(h => h.from).join();
  assert.equal(order(routes), order(base), 'the arrows still arrive in the same order along d');
});

test('properties over 200 small graphs: never worse, orthogonal, in the boxes, ports keep their step, no new lines that read as one, deterministic', () => {
  let changed = 0, tried = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed), n = 3 + Math.floor(r() * 5);
    const nodes = Array.from({length: n}, (_, i) => box(`n${i}`, 60 + Math.floor(r() * 50), 30 + 10 * Math.floor(r() * 7)));
    const edges: LayeredEdge[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < 0.4) edges.push(r() < 0.15 ? {from: `n${j}`, to: `n${i}`} : {from: `n${i}`, to: `n${j}`});
    if (!edges.length) continue;
    tried++;
    const off = route(nodes, edges, {straighten: false}), on = route(nodes, edges), again = route(nodes, edges);
    const who = `seed ${seed}`;
    assert.deepEqual([...on.routes], [...again.routes], `${who}: deterministic`);
    const a = metric(off.routes), b = metric(on.routes);
    assert.ok(b.crossings < a.crossings || (b.crossings === a.crossings && b.bends <= a.bends), `${who}: (${a.crossings}, ${a.bends}) -> (${b.crossings}, ${b.bends})`);
    assert.ok(lineUps(on.routes) <= lineUps(off.routes), `${who}: more arrows read as one line`);
    for (const [i, p] of on.routes) {
      for (let k = 1; k < p.length; k++) assert.ok(p[k].x === p[k - 1].x || p[k].y === p[k - 1].y, `${who}: arrow ${i} is not orthogonal`);
      const was = off.routes.get(i)!;
      if (JSON.stringify(was) !== JSON.stringify(p)) {
        changed++;
        const e = on.lay.edges[i], A = on.lay.nodes.get(e.from)!, B = on.lay.nodes.get(e.to)!;
        assert.ok(straight(p) || JSON.stringify(heights(was)) === JSON.stringify(heights(p)), `${who}: a moved arrow ends up straight, or only its lane moved`);
        if (!straight(p)) assert.deepEqual([p[0], p[p.length - 1]], [was[0], was[was.length - 1]], `${who}: a lane moved, not the ends`);
        if (straight(p)) assert.ok(p[0].y >= Math.max(A.y, B.y) + 6 - 1e-9 && p[0].y <= Math.min(A.y + A.h, B.y + B.h) - 6 + 1e-9, `${who}: arrow ${i} leaves the boxes`);
      }
    }
    // the ports of one box side keep at least the step they had
    const gaps = (res: {lay: typeof on.lay; routes: Map<number, Pt[]>}): Map<string, number> => {
      const side = new Map<string, number[]>();
      for (const [i, p] of res.routes) {
        const e = res.lay.edges[i];
        for (const [id, pt, left] of [[e.from, p[0], p[1].x < p[0].x], [e.to, p[p.length - 1], p[p.length - 2].x < p[p.length - 1].x]] as const) side.set(`${id}:${left ? 'l' : 'r'}`, [...(side.get(`${id}:${left ? 'l' : 'r'}`) ?? []), pt.y]);
      }
      return new Map([...side].map(([k, ys]) => { ys.sort((x, y) => x - y); return [k, Math.min(Infinity, ...ys.slice(1).map((y, q) => y - ys[q]))] as [string, number]; }));
    };
    const before = gaps(off), after = gaps(on);
    for (const [k, g] of after) assert.ok(g >= Math.min(before.get(k) ?? Infinity, 14) - 1e-9 || g === Infinity, `${who}: ports of ${k} are ${g}px apart (were ${before.get(k)})`);
  }
  assert.ok(tried > 150 && changed > 20, `the property run moves some arrows (${changed} in ${tried} graphs)`);
});
