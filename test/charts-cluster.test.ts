import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, clustermap, closeMeasurer, diagram, kde2d} from '../lib/dsl.ts';
import {averageLinkage, dendrogramOrder, kde2d as kde2dFn} from '../lib/stats.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(band as never));
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const rows = ['a', 'b', 'c', 'd', 'e'], cols = ['x', 'y', 'z'];
const table = [[9, 1, 8], [1, 9, 2], [8, 2, 9], [2, 8, 1], [9, 2, 7]];

test('averageLinkage: merges the closest pair first, heights never decrease, the average of the distances is used', () => {
  const m = averageLinkage([[0], [1], [5], [6]]);
  assert.deepEqual([m[0]!.a, m[0]!.b, m[0]!.height], [0, 1, 1]);
  assert.deepEqual([m[1]!.a, m[1]!.b, m[1]!.height], [2, 3, 1]);
  near(m[2]!.height, 5); // (|0-5| + |0-6| + |1-5| + |1-6|) / 4
  assert.equal(m[2]!.size, 4);
  assert.ok(m.every((q, i) => i === 0 || q.height >= m[i - 1]!.height));
});

test('dendrogramOrder: similar rows end up next to each other; the same data gives the same order', () => {
  const data = [[0], [10], [1], [11], [0.5]], m = averageLinkage(data), {order, pos} = dendrogramOrder(m, data.length);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4]);
  const at = (i: number) => order.indexOf(i);
  assert.ok(Math.abs(at(0) - at(2)) <= 2 && Math.abs(at(0) - at(4)) <= 2 && Math.abs(at(1) - at(3)) === 1);
  assert.equal(pos.length, data.length + m.length);
  assert.deepEqual(dendrogramOrder(averageLinkage(data), 5).order, order);
});

test('kde2d (stats): integrates to about 1 over the plane', () => {
  const xs = [1, 2, 2, 3, 3, 3, 4, 5], ys = [2, 2, 3, 3, 4, 4, 5, 6], g = Array.from({length: 81}, (_q, i) => -4 + i * 0.2);
  const {z} = kde2dFn(xs, ys, g, g);
  near(z.flat().reduce((a, b) => a + b, 0) * 0.04, 1, 0.03);
});

test('clustermap(): every cell once, in dendrogram order, with the numbers and a colour scale; stable and passes verify; scale and no-cluster options', async () => {
  for (const opts of [{}, {scale: 'row' as const}, {scale: 'col' as const, unit: '個'}, {rows: false}, {cols: false, values: false}]) {
    const {chart, problems} = await chartOf(clustermap(rows, cols, table, opts));
    assert.deepEqual(problems, [], problems.join('; '));
    assert.equal(chart.solids.filter(s => s.label.startsWith('the cell')).length, 15);
    assert.deepEqual(chart.items, (await chartOf(clustermap(rows, cols, table, opts))).chart.items);
  }
  const {chart} = await chartOf(clustermap(rows, cols, table));
  const labels = chart.items.flatMap(i => i.k === 'text' && rows.includes(i.s) ? [i.s] : []);
  assert.deepEqual([...labels].sort(), rows);
  assert.notDeepEqual(labels, rows, 'the rows are reordered by similarity');
  assert.ok(chart.items.some(i => i.k === 'text' && i.s === '最小 1'));
  assert.match(chart.alt, /クラスタ付きヒートマップ/);
});

test('kde2d(): bands, contour lines and the data points pass verify and are stable', async () => {
  const x = Array.from({length: 50}, (_q, i) => 160 + ((i * 37) % 41) * 0.6), y = x.map((h, i) => 0.55 * h - 32 + ((i * 17) % 11) - 5);
  const {chart, problems} = await chartOf(kde2d({x, y}, {xLabel: 'x', yLabel: 'y'}));
  assert.deepEqual(problems, []);
  assert.ok(chart.items.some(i => i.k === 'path' && i.stroke === 'accent' && i.sw === 1.5 && (i.d.match(/M/g) ?? []).length > 10), 'contour lines');
  assert.deepEqual(chart.items, (await chartOf(kde2d({x, y}, {xLabel: 'x', yLabel: 'y'}))).chart.items);
  assert.match(chart.alt, /2次元密度/);
});

test('errors name the call', () => {
  assert.throws(() => clustermap(['a'], cols, [[1, 2, 3]]), /clustermap\(\): needs at least two rows/);
  assert.throws(() => clustermap(rows, cols, [[1, 2, 3]]), /values must be 5 rows of 3 numbers/);
  assert.throws(() => clustermap(rows, cols, table.map(r => r.map(() => NaN))), /must be a finite number/);
  assert.throws(() => clustermap(rows, cols, table, {scale: 'x' as never}), /scale must be/);
  assert.throws(() => kde2d({x: [1, 2], y: [1, 2, 3]}), /kde2d\(\): x has 2 values and y has 3/);
});
