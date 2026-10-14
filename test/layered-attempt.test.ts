import test from 'node:test';
import assert from 'node:assert/strict';
import {layeredAttempt, layoutWithLanes, routeLayered, scoreRoutes} from '../lib/layered-route.ts';
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
      assert.deepEqual(got.score, scoreRoutes(want));
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

test('scoreRoutes: counts corners and right-angle crossings, not touching or overlapping', () => {
  const r = new Map<number, Pt[]>([
    [0, [{x: 0, y: 5}, {x: 10, y: 5}]],
    [1, [{x: 5, y: 0}, {x: 5, y: 10}]],
    [2, [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 3}]],
    [3, [{x: 0, y: 5}, {x: 10, y: 5}]],
  ]);
  assert.deepEqual(scoreRoutes(r), {crossings: 2, bends: 1});
});
