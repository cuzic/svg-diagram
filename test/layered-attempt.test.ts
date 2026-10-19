import test from 'node:test';
import assert from 'node:assert/strict';
import {layeredAttempt, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {crossingsWith, scoreOf} from '../lib/polyline-metrics.ts';
import type {Pt} from '../lib/graph-layout.ts';

// Fixed sizes: nothing here depends on a font.
const box = (id: string) => ({id, size: {w: 80, h: 30}});
const graphs: Record<string, {nodes: string[]; edges: [string, string][]}> = {
  chain: {nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']]},
  diamond: {nodes: ['a', 'b', 'c', 'd'], edges: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']]},
  skip: {nodes: ['a', 'b', 'c', 'd'], edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']]},
  cycle: {nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c'], ['c', 'a'], ['b', 'b']]},
  disjoint: {nodes: ['a', 'b', 'c', 'd', 'e'], edges: [['a', 'b'], ['c', 'd'], ['c', 'e']]},
};
const opts = {dir: 'right' as const, gap: 24, levelGap: 60};

for (const [name, g] of Object.entries(graphs)) {
  const nodes = g.nodes.map(box), edges = g.edges.map(([from, to]) => ({from, to}));
  test(`layeredAttempt: ${name} gives what layout + routing gave`, () => {
    for (const transpose of [false, true]) {
      const lay = layoutWithLanes(nodes, edges, opts);
      const place = (p: Pt): Pt => transpose ? {x: p.y + 5, y: p.x + 7} : {x: p.x + 5, y: p.y + 7};
      const want = routeLayered(lay, place, 14);
      const got = layeredAttempt(nodes, edges, opts, {portStep: 14, transpose, place: () => place});
      assert.deepEqual(got.lay, lay);
      assert.deepEqual([...got.routes], [...want]);
      assert.deepEqual(got.size, transpose ? {w: lay.h, h: lay.w} : {w: lay.w, h: lay.h});
      assert.deepEqual(got.score, scoreOf([...want.values()]));
      assert.deepEqual(got.loose, []);
      assert.equal(got.fits, true);
    }
  });
}

test('layeredAttempt: the place callback gets the size, fits follows maxAcross, looseOf is reported', () => {
  const nodes = graphs.chain.nodes.map(box), edges = graphs.chain.edges.map(([from, to]) => ({from, to}));
  let seen: {w: number; h: number} | undefined;
  const a = layeredAttempt(nodes, edges, opts, {maxAcross: 10, place: s => { seen = s; return p => p; }, looseOf: () => ['x']});
  assert.deepEqual(seen, a.size);
  assert.equal(a.fits, false);
  assert.deepEqual(a.loose, ['x']);
  assert.equal(layeredAttempt(nodes, edges, opts, {maxAcross: a.size.w, place: () => p => p}).fits, true);
});

test('layeredAttempt: groupOf is asked with the index of the input edge', () => {
  const nodes = graphs.diamond.nodes.map(box), edges = graphs.diamond.edges.map(([from, to]) => ({from, to}));
  const asked = new Set<number>();
  layeredAttempt(nodes, edges, opts, {place: () => p => p, groupOf: k => { asked.add(k); return undefined; }});
  assert.ok(asked.size > 0 && [...asked].every(k => k >= 0 && k < edges.length));
});

// ---- the candidate selection (ADR 0016 D1) ----
const rngOf = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const lexBetter = (a: {crossings: number; bends: number}, b: {crossings: number; bends: number}): boolean => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);

test('layeredAttempt: straighten false is the plain layout; otherwise the plain layout unless the straightened one is strictly better (200 small graphs)', () => {
  const rand = rngOf(5);
  let moved = 0;
  for (let k = 0; k < 200; k++) {
    const n = 4 + Math.floor(rand() * 6), names = Array.from({length: n}, (_, i) => `n${i}`), nodes = names.map(box);
    const edges: {from: string; to: string}[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && rand() < (i < j ? 0.3 : 0.04)) edges.push({from: names[i], to: names[j]});
    const place = () => (p: Pt): Pt => p;
    const plain = layeredAttempt(nodes, edges, opts, {portStep: 14, place, straighten: false});
    assert.deepEqual(plain.lay, layoutWithLanes(nodes, edges, opts));
    for (const tighten of [false, true]) {
      // a width in the middle of the range sometimes makes the plain layout too wide for it, sometimes not
      const maxAcross = plain.size.w * (0.8 + rand() * 0.5);
      const got = layeredAttempt(nodes, edges, opts, {portStep: 14, place, maxAcross, tighten}), again = layeredAttempt(nodes, edges, opts, {portStep: 14, place, maxAcross, tighten});
      assert.deepEqual(again, got, 'deterministic');
      const base = layeredAttempt(nodes, edges, opts, {portStep: 14, place, maxAcross, straighten: false});
      if (JSON.stringify(got.lay) === JSON.stringify(base.lay)) continue;
      moved++;
      assert.ok((!base.fits && got.fits) || lexBetter(got.score, base.score), `moved without being better: ${JSON.stringify(base.score)} -> ${JSON.stringify(got.score)}`);
      if (base.fits) assert.ok(got.fits, 'a width the plain layout fits is still fit');
      assert.ok(got.loose.length <= base.loose.length);
    }
  }
  assert.ok(moved > 10, `the straightened candidate is chosen sometimes (${moved})`);
});

test('layeredAttempt: a straightened candidate that leaves a group undrawable (more loose than the plain one) is never chosen', () => {
  const rand = rngOf(9);
  for (let k = 0; k < 100; k++) {
    const n = 5 + Math.floor(rand() * 5), names = Array.from({length: n}, (_, i) => `n${i}`), nodes = names.map(box);
    const edges: {from: string; to: string}[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rand() < 0.3) edges.push({from: names[i], to: names[j]});
    const plain = layeredAttempt(nodes, edges, opts, {place: () => p => p, straighten: false});
    const same = (lay: typeof plain.lay): boolean => JSON.stringify([...lay.nodes]) === JSON.stringify([...plain.lay.nodes]);
    const got = layeredAttempt(nodes, edges, opts, {place: () => p => p, looseOf: (_r, lay) => same(lay) ? [] : ['x']});
    assert.deepEqual(got.lay, plain.lay);
  }
});

test('scoreOf over routes: counts corners and right-angle crossings, not touching or overlapping', () => {
  const r = new Map<number, Pt[]>([
    [0, [{x: 0, y: 5}, {x: 10, y: 5}]],
    [1, [{x: 5, y: 0}, {x: 5, y: 10}]],
    [2, [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 3}]],
    [3, [{x: 0, y: 5}, {x: 10, y: 5}]],
  ]);
  assert.deepEqual(scoreOf([...r.values()]), {crossings: 2, bends: 1});
});

test('layeredAttempt: a return in an outer lane enters its head from the lane side when that takes a crossing away', () => {
  // the cause tree of a feedback loop: the root's arrows leave its right side, so a return into that side crosses one of them
  const ids = ['root', 'a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'c1', 'u1', 'u2'];
  const nodes = ids.map(box);
  const pairs: [string, string][] = [['root', 'a1'], ['root', 'a2'], ['root', 'a3'], ['root', 'a4'], ['a1', 'b1'], ['a2', 'b1'], ['a3', 'b2'], ['a4', 'b3'], ['b1', 'c1'], ['b2', 'c1'], ['b3', 'c1'], ['c1', 'u1'], ['c1', 'u2'], ['u2', 'root']];
  const edges = pairs.map(([from, to]) => ({from, to}));
  const a = layeredAttempt(nodes, edges, {...opts, back: [13]}, {portStep: 14, returns: 'all', transpose: true, place: () => p => p});
  const back = a.routes.get(a.lay.edges.findIndex(e => e.from === 'u2' && e.to === 'root'))!;
  const root = a.lay.nodes.get('root')!, last = back[back.length - 1], prev = back[back.length - 2];
  assert.equal(crossingsWith(back, [...a.routes].filter(([, r]) => r !== back).map(([, r]) => r)), 0, 'the return crosses nothing');
  assert.equal(last.x, prev.x, 'the last run is along the lane axis');
  assert.ok(last.y === root.y || last.y === root.y + root.h, 'it ends on the top or the bottom of the root');
});

test('layeredAttempt: two returns into one box take two places on its face; a box with a self-loop keeps them on the side', () => {
  const ids = ['root', 'a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'c1', 'u1', 'u2', 'u3'];
  const pairs: [string, string][] = [['root', 'a1'], ['root', 'a2'], ['root', 'a3'], ['root', 'a4'], ['a1', 'b1'], ['a2', 'b1'], ['a3', 'b2'], ['a4', 'b3'], ['b1', 'c1'], ['b2', 'c1'], ['b3', 'c1'], ['c1', 'u1'], ['c1', 'u2'], ['c1', 'u3'], ['u2', 'root'], ['u3', 'root']];
  const run = (loop: boolean) => {
    const edges = [...pairs, ...(loop ? [['root', 'root'] as [string, string]] : [])].map(([from, to]) => ({from, to}));
    const a = layeredAttempt(ids.map(box), edges, {...opts, back: [14, 15]}, {portStep: 14, returns: 'all', transpose: true, place: () => p => p});
    const root = a.lay.nodes.get('root')!;
    return [...a.lay.edges.entries()].filter(([, e]) => e.outer).map(([i]) => ({end: a.routes.get(i)![a.routes.get(i)!.length - 1], root}));
  };
  const two = run(false);
  assert.equal(two.length, 2);
  for (const r of two) assert.ok(r.end.y === r.root.y || r.end.y === r.root.y + r.root.h, 'both returns enter the face (the case is not vacuous)');
  assert.notEqual(two[0].end.x, two[1].end.x, 'the two returns end at two places');
  for (const r of run(true)) assert.ok(r.end.y !== r.root.y && r.end.y !== r.root.y + r.root.h, 'a box with a self-loop is entered on the side');
});
