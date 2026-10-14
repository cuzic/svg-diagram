import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {boxplot, checkDiagram, closeMeasurer, diagram, facet, histplot, regplot} from '../lib/dsl.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const A = [52, 58, 61, 63, 64, 66, 67, 69, 70, 72], B = [41, 47, 50, 52, 54, 55, 57, 58, 60, 61, 63], C = [48, 53, 57, 59, 60, 62, 63, 64];
const charts = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  const found: LaidOutChart[] = [];
  const walk = (b: unknown): void => { const o = b as {type?: string; children?: unknown[]}; if (o.type === 'chart') found.push(o as LaidOutChart); o.children?.forEach(walk); };
  laidOut.laidOut.forEach(walk);
  return {found, problems: verdict.problems};
};
const ticks = (c: LaidOutChart) => c.items.flatMap(i => i.k === 'text' && /^[\d.]+$/.test(i.s) ? [i.s] : []).join(' ');

test('facet(): one panel per key, titled, `cols` per row; an incomplete last row passes verify', async () => {
  const rows = facet({a: A, b: B, c: C}, (_k, v) => histplot(v), {cols: 2});
  assert.equal(rows.length, 2);
  const {found, problems} = await charts(...rows);
  assert.deepEqual(problems, []);
  assert.equal(found.length, 3);
});

test('share (default xy): the axes of every panel are the combined range; share none leaves each its own; x / y share one axis', async () => {
  const mk = (share?: 'xy' | 'x' | 'y' | 'none') => facet({a: A, b: B}, (_k, v, _i, axes) => histplot(v, {binWidth: 10, ...axes}), {cols: 2, ...(share ? {share} : {})});
  const own = await charts(...mk('none'));
  assert.notEqual(ticks(own.found[0]), ticks(own.found[1]));
  const xs = (c: LaidOutChart) => c.items.flatMap(i => i.k === 'text' && /^(40|50|60|70|80)$/.test(i.s) ? [i.s] : []).join(' ');
  const ys = (c: LaidOutChart) => c.items.flatMap(i => i.k === 'text' && /^[0-9]$/.test(i.s) ? [i.s] : []).join(' ');
  for (const share of [undefined, 'xy'] as const) {
    const shared = await charts(...mk(share));
    assert.deepEqual(shared.problems, []);
    assert.equal(xs(shared.found[0]), xs(shared.found[1]));
    assert.equal(ys(shared.found[0]), ys(shared.found[1]));
  }
  const onlyX = await charts(...mk('x'));
  assert.equal(xs(onlyX.found[0]), xs(onlyX.found[1]));
  const r = await charts(...facet({a: 1, b: 3}, (_k, s, _i, axes) => regplot({x: [0, 1, 2, 3, 4], y: [0, 1, 2, 3, 4].map(v => s * v + (v % 2))}, {...axes}), {cols: 2}));
  assert.deepEqual(r.problems, []);
  assert.equal(ticks(r.found[0]), ticks(r.found[1]));
});

test('panels with no axis to share are left alone by default; an explicit share with none of them is an error', async () => {
  const {problems} = await charts(...facet({a: A, b: B}, () => boxplot({x: A})));
  assert.deepEqual(problems, []);
  assert.throws(() => facet({a: A}, () => boxplot({x: A}), {share: 'xy'}), /share needs histplot/);
});

test('errors', () => {
  assert.throws(() => facet({}, () => histplot(A)), /at least one panel/);
  assert.throws(() => facet({a: A}, () => histplot(A), {cols: 0}), /cols must be a whole number/);
  assert.throws(() => facet({a: A}, () => histplot(A), {share: 'z' as never}), /share must be/);
  assert.throws(() => histplot(A, {xRange: [5, 1]}), /xRange must be \[min, max\]/);
});
