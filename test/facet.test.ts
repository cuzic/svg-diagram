import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, facet, histplot, regplot} from '../lib/dsl.ts';
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

test('xRange / yRange make the axes of different panels the same', async () => {
  const own = await charts(...facet({a: A, b: B}, (_k, v) => histplot(v, {binWidth: 10}), {cols: 2}));
  assert.notEqual(ticks(own.found[0]), ticks(own.found[1]));
  const shared = await charts(...facet({a: A, b: B}, (_k, v) => histplot(v, {binWidth: 10, xRange: [40, 80], yRange: [0, 8]}), {cols: 2}));
  assert.deepEqual(shared.problems, []);
  const xs = (c: LaidOutChart) => c.items.flatMap(i => i.k === 'text' && /^(40|50|60|70|80)$/.test(i.s) ? [i.s] : []).join(' ');
  assert.equal(xs(shared.found[0]), xs(shared.found[1]));
  const r = await charts(...facet({a: 1, b: 3}, (_k, s) => regplot({x: [0, 1, 2, 3, 4], y: [0, 1, 2, 3, 4].map(v => s * v + (v % 2))}, {xRange: [0, 5], yRange: [-5, 20]}), {cols: 2}));
  assert.deepEqual(r.problems, []);
  assert.equal(ticks(r.found[0]), ticks(r.found[1]));
});

test('errors', () => {
  assert.throws(() => facet({}, () => histplot(A)), /at least one panel/);
  assert.throws(() => facet({a: A}, () => histplot(A), {cols: 0}), /cols must be a whole number/);
  assert.throws(() => histplot(A, {xRange: [5, 1]}), /xRange must be \[min, max\]/);
});
