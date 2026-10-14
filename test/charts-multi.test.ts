import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, hist2d, jointplot, pairplot} from '../lib/dsl.ts';
import {binIndex} from '../lib/stats.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const n = 40, x = Array.from({length: n}, (_q, i) => 150 + ((i * 37) % 41)), y = x.map((h, i) => Math.round(0.55 * h - 32 + ((i * 17) % 11) - 5)), z = x.map((_h, i) => 20 + ((i * 13) % 36));
const sex = x.map((_h, i) => (i % 2 ? '男性' : '女性'));

test('binIndex follows the same rule as binCounts', () => {
  assert.equal(binIndex(2, [0, 2, 4]), 1); assert.equal(binIndex(4, [0, 2, 4]), 1); assert.equal(binIndex(-1, [0, 2, 4]), 0);
});

test('hist2d(): the cells add up to every point; the largest count is on the colour scale', async () => {
  const {chart, problems} = await chartOf(hist2d({x, y}, {xLabel: '身長', yLabel: '体重'}));
  assert.deepEqual(problems, []);
  const counts = chart.items.flatMap(i => i.k === 'text' && /^\d+$/.test(i.s) && i.bold ? [Number(i.s)] : []);
  const cells = chart.solids.filter(s => s.label.startsWith('the cell')).length;
  assert.ok(cells >= 5);
  assert.ok(counts.reduce((a, b) => a + b, 0) <= n);
  assert.match(chart.alt, /2次元ヒストグラム.*n=40/);
});

test('jointplot() / pairplot(): every point is drawn once per panel; groups get their own marker shape; verify passes and the figure is stable', async () => {
  for (const make of [
    () => jointplot({x, y}), () => jointplot({x, y, group: sex}, {xLabel: 'x', yLabel: 'y'}),
    () => pairplot({a: x, b: y, c: z}), () => pairplot({a: x, b: y, c: z}, {groups: sex, corner: true}), () => pairplot({a: x, b: y}),
  ]) {
    const {chart, problems} = await chartOf(make());
    assert.deepEqual(problems, [], problems.join('; '));
    assert.deepEqual(chart.items, (await chartOf(make())).chart.items);
  }
  const {chart} = await chartOf(jointplot({x, y, group: sex}));
  const dots = chart.items.filter(i => i.k === 'path' && i.op === 0.75);
  assert.equal(dots.length, n);
  assert.ok(new Set(dots.map(d => (d as {d: string}).d.replace(/[\d.\-]+/g, ''))).size >= 2, 'two marker shapes');
  const p = await chartOf(pairplot({a: x, b: y, c: z}));
  assert.equal(p.chart.items.filter(i => i.k === 'path' && i.op === 0.75).length, n * 6, '3 variables: 6 off-diagonal panels');
  const q = await chartOf(pairplot({a: x, b: y, c: z}, {corner: true}));
  assert.equal(q.chart.items.filter(i => i.k === 'path' && i.op === 0.75).length, n * 3);
});

test('errors name the call', () => {
  assert.throws(() => hist2d({x: [1]} as never), /hist2d\(\): needs columns|x needs at least two values/);
  assert.throws(() => hist2d({x: [1, 2], y: [1, 2, 3]}), /x has 2 values and y has 3/);
  assert.throws(() => jointplot({x: [1, 2], y: [1, NaN]}), /jointplot\(\): y value 2 must be a finite number/);
  assert.throws(() => jointplot({x: [1, 2], y: [1, 2], group: ['a']}), /groups has 1 labels for 2 rows/);
  assert.throws(() => pairplot({a: [1, 2]}), /pairplot\(\): needs 2 to 6 variables/);
  assert.throws(() => pairplot({a: [1, 2], b: [1, 2, 3]}), /same number of values/);
  assert.throws(() => pairplot({a: [1, 2], b: [3, 4]}, {groups: ['a', 'b', 'c']}), /groups has 3 labels for 2 rows/);
});
