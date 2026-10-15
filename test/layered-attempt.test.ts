import test from 'node:test';
import assert from 'node:assert/strict';
import {layeredAttempt, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {scoreOf} from '../lib/polyline-metrics.ts';
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
