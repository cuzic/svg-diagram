// node --test test/   — ADR 0016 U1: counting bends, crossings and length of polylines (pure functions of points; no font involved).
import test from 'node:test';
import assert from 'node:assert/strict';
import {bendsOf, crossingsOf, scoreOf, simplify, totalLength, crossingsWith} from '../lib/polyline-metrics.ts';
import {layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {edgeStats} from '../lib/rules.ts';
import type {LaidOutConnect} from '../lib/types/containers.ts';
import type {Pt} from '../lib/graph-layout.ts';

const P = (...xy: number[]): Pt[] => xy.flatMap((_, i) => i % 2 ? [] : [{x: xy[i], y: xy[i + 1]}]);

test('bendsOf: a bend is an inner point where the line turns; repeats and points mid-run are not bends', () => {
  assert.equal(bendsOf(P(0, 0, 10, 0)), 0);
  assert.equal(bendsOf(P(0, 0, 5, 0, 10, 0)), 0, 'a point in the middle of a straight run');
  assert.equal(bendsOf(P(0, 0, 0, 0, 10, 0)), 0, 'a repeated point');
  assert.equal(bendsOf(P(0, 0, 5, 0, 5, 8, 10, 8)), 2);
  assert.equal(bendsOf(P(0, 0, 10, 0, 10, 8)), 1);
  assert.equal(bendsOf(P(0, 0, 10, 0, 10, 8, 3, 8, 3, 0)), 3);
  assert.equal(bendsOf([]), 0);
  assert.equal(bendsOf(P(1, 1)), 0);
});

test('totalLength: the sum of the segments', () => {
  assert.equal(totalLength(P(0, 0, 10, 0, 10, 8)), 18);
  assert.equal(totalLength(P(0, 0, 3, 4)), 5);
  assert.equal(totalLength([]), 0);
});

test('crossingsOf: right-angle crossings between two polylines; touching, overlapping and a polyline against itself do not count', () => {
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(5, 0, 5, 10)]), 1);
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(0, 5, 10, 5)]), 0, 'overlapping');
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(10, 0, 10, 10)]), 0, 'touching at an end');
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(5, 5, 5, 10)]), 0, 'a T');
  assert.equal(crossingsOf([P(0, 0, 10, 0, 10, 10, 5, 10, 5, -5)]), 0, 'one polyline crossing itself');
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(5, 0, 5, 10), P(0, 5, 10, 5)]), 2);
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(1, 0, 1, 10)], {margin: 2}), 0, 'margin: too near the end to count');
  assert.equal(crossingsOf([P(0, 5, 10, 5), P(5, 0, 5, 10)], {margin: 2}), 1);
  assert.equal(crossingsOf([P(0, 5, 10, 5.4), P(5, 0, 5, 10)], {tol: 0.5}), 1, 'a nearly level run counts as level with a tolerance');
  assert.equal(crossingsOf([P(0, 5, 10, 5.4), P(5, 0, 5, 10)]), 0, 'and as a diagonal (not counted) without one');
});

test('scoreOf: bends and crossings together', () => {
  assert.deepEqual(scoreOf([P(0, 5, 10, 5), P(5, 0, 5, 10), P(0, 0, 4, 0, 4, 3), P(0, 5, 10, 5)]), {crossings: 2, bends: 1});
});

test('simplify: keeps the corners only', () => {
  assert.deepEqual(simplify(P(0, 0, 5, 0, 5, 0, 10, 0, 10, 4)), P(0, 0, 10, 0, 10, 4));
});

// ---- properties over small directed graphs (seeded; the routes come from the real layered layout with fixed box sizes) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('properties on routed small graphs: reversal, reordering and translation do not change the counts; bends stay below the point count', () => {
  let tried = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed), n = 3 + Math.floor(r() * 5);
    const nodes = Array.from({length: n}, (_, i) => ({id: `n${i}`, size: {w: 60 + Math.floor(r() * 40), h: 30}}));
    const edges: {from: string; to: string}[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < 0.35) edges.push(r() < 0.15 ? {from: `n${j}`, to: `n${i}`} : {from: `n${i}`, to: `n${j}`});
    if (!edges.length) continue;
    tried++;
    const lay = layoutWithLanes(nodes, edges, {dir: 'right', gap: 24, levelGap: 60});
    const paths = [...routeLayered(lay, p => p).values()];
    const score = scoreOf(paths);
    assert.deepEqual(scoreOf(paths.map(p => [...p].reverse())), score, `seed ${seed}: reversed paths`);
    assert.deepEqual(scoreOf([...paths].reverse()), score, `seed ${seed}: reordered paths`);
    assert.deepEqual(scoreOf(paths.map(p => p.map(q => ({x: q.x + 100, y: q.y - 37})))), score, `seed ${seed}: translated`);
    assert.deepEqual(scoreOf(paths), score, `seed ${seed}: deterministic`);
    for (const p of paths) {
      assert.ok(bendsOf(p) <= Math.max(0, p.length - 2), `seed ${seed}: bends below point count`);
      assert.equal(bendsOf(p), bendsOf([...p].reverse()));
      assert.ok(Math.abs(totalLength(p) - totalLength([...p].reverse())) < 1e-9);
    }
    assert.equal(score.bends, paths.reduce((a, p) => a + bendsOf(p), 0));
  }
  assert.ok(tried > 150);
});

test('edgeStats counts crossings the way crossingsOf does (margin 2, tolerance 0.5) and keeps its overlaps', () => {
  const c = (fromId: string, toId: string, pts: Pt[]): LaidOutConnect => ({fromId, toId, points: pts} as unknown as LaidOutConnect);
  assert.deepEqual(edgeStats([c('a', 'b', P(0, 5, 10, 5)), c('c', 'd', P(5, 0, 5, 10))]), {crossings: 1, overlaps: 0});
  assert.deepEqual(edgeStats([c('a', 'b', P(0, 5, 10, 5)), c('c', 'd', P(1, 0, 1, 10))]), {crossings: 0, overlaps: 0});
  assert.deepEqual(edgeStats([c('a', 'b', P(0, 5, 40, 5)), c('c', 'd', P(0, 6, 40, 6))]), {crossings: 0, overlaps: 1});
  assert.deepEqual(edgeStats([]), {crossings: 0, overlaps: 0});
});

test('runsTogether: two runs side by side (under 4px apart, over 4px long together)', async () => {
  const {runsTogether} = await import('../lib/polyline-metrics.ts');
  const h = (x0: number, x1: number, y: number) => ({p: {x: x0, y}, q: {x: x1, y}});
  assert.equal(runsTogether(h(0, 100, 10), h(50, 150, 12)), true);
  assert.equal(runsTogether(h(0, 100, 10), h(50, 150, 14)), false, '4px apart is enough');
  assert.equal(runsTogether(h(0, 100, 10), h(98, 150, 10)), false, 'a touch of 2px');
  assert.equal(runsTogether(h(0, 100, 10), {p: {x: 20, y: 0}, q: {x: 20, y: 50}}), false, 'one horizontal, one vertical');
});

test('crossingsWith: what one polyline adds to crossingsOf, and the same count when the figure is counted whole', () => {
  const a = [{x: 0, y: 50}, {x: 100, y: 50}], b = [{x: 30, y: 0}, {x: 30, y: 100}], c = [{x: 70, y: 0}, {x: 70, y: 40}], d = [{x: 10, y: 90}, {x: 90, y: 90}];
  assert.equal(crossingsWith(a, [b, c, d]), 1, 'a crosses b only (c stops short of it, d is level with it)');
  assert.equal(crossingsWith(a, [b, c, d]), crossingsOf([a, b, c, d]) - crossingsOf([b, c, d]));
  assert.equal(crossingsWith(b, [a, d]), 2);
  assert.equal(crossingsWith(a, []), 0);
});
