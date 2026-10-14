import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, regplot, residplot} from '../lib/dsl.ts';
import {lowessFit, polyFit} from '../lib/stats.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(band as never));
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const x = Array.from({length: 30}, (_q, i) => i), noisy = x.map((v, i) => 2 * v + 1 + ((i * 7) % 5) - 2);

test('polyFit: an exact line / parabola is recovered, R² = 1, the band closes to nothing', () => {
  const l = polyFit([0, 1, 2, 3, 4], [1, 3, 5, 7, 9], 1);
  near(l.at(10), 21); near(l.r2, 1); near(l.half!(2), 0, 1e-6);
  const q = polyFit([-2, -1, 0, 1, 2, 3], [4, 1, 0, 1, 4, 9], 2);
  near(q.at(4), 16, 1e-6); near(q.r2, 1);
  assert.equal(polyFit([1, 2], [1, 2], 1).half, undefined, 'no degrees of freedom: no band');
});

test('polyFit: the confidence band of a noisy line is widest at the ends and narrowest at the mean of x', () => {
  const f = polyFit(x, noisy, 1), mid = x.reduce((a, b) => a + b, 0) / x.length;
  assert.ok(f.half!(mid) < f.half!(0) && f.half!(mid) < f.half!(29));
  assert.ok(f.r2 > 0.99 && f.r2 < 1);
});

test('regplot() / residplot(): verify passes and the figure is stable, for every order, with groups, stats and without a band', async () => {
  const g = x.map((_v, i) => (i % 2 ? 'a' : 'b'));
  for (const make of [
    () => regplot({x, y: noisy}), () => regplot({x, y: noisy}, {stats: true, order: 2}), () => regplot({x, y: noisy, group: g}, {stats: true, band: false}),
    () => regplot({x, y: noisy}, {order: 3, xLabel: 'x', yLabel: 'y'}), () => residplot({x, y: noisy}), () => residplot({x, y: noisy, group: g}, {order: 2}),
  ]) {
    const {chart, problems} = await chartOf(make());
    assert.deepEqual(problems, [], problems.join('; '));
    assert.deepEqual(chart.items, (await chartOf(make())).chart.items);
  }
});

test('regplot(): the equation and R² are written; a group gets its own line style; residplot draws the dashed zero line', async () => {
  const a = await chartOf(regplot({x, y: noisy}, {stats: true}));
  const text = a.chart.items.flatMap(i => i.k === 'text' ? [i.s] : []).find(s => s.startsWith('y = '));
  assert.match(text ?? '', /^y = 2(\.\d+)?x [+−] [\d.]+（R² = 0\.99）/);
  const b = await chartOf(regplot({x, y: noisy, group: x.map((_v, i) => (i % 2 ? 'a' : 'b'))}));
  assert.ok(b.chart.items.some(i => i.k === 'path' && i.dash === '6,4' && i.sw === 2.5));
  const r = await chartOf(residplot({x, y: noisy}));
  assert.ok(r.chart.items.some(i => i.k === 'path' && i.dash === '6,4' && i.stroke === 'text'));
  assert.match(r.chart.alt, /残差プロット/);
});

test('errors name the call', () => {
  assert.throws(() => regplot({x: [1, 2, 3], y: [1, 2]}), /regplot\(\): x has 3 values and y has 2/);
  assert.throws(() => regplot({x: [1, 2, 3], y: [1, 2, 3]}, {order: 4 as never}), /order must be 1, 2 or 3/);
  assert.throws(() => regplot({x: [1, 2], y: [1, 2]}), /needs at least 3 points/);
  assert.throws(() => residplot({x: [1, 1, 1, 1], y: [1, 2, 3, 4]}), /residplot\(\): .*different values/);
  assert.throws(() => regplot({x: [1, 2, 3], y: [1, 2, NaN]}), /y value 3 must be a finite number/);
  assert.throws(() => regplot({x: [1, 2, 3], y: [1, 2, 3], group: ['a']}), /groups has 1 labels for 3 rows/);
});

test('lowessFit: follows a curve a line cannot, is exact on a line, and a robust fit shrugs off an outlier', () => {
  const xs = Array.from({length: 40}, (_q, i) => i), line = xs.map(v => 3 * v + 2);
  const f = lowessFit(xs, line);
  for (const x of [0, 10.5, 39]) near(f(x), 3 * x + 2, 1e-6);
  const sine = xs.map(v => Math.sin(v / 6) * 10), g = lowessFit(xs, sine, 0.3);
  for (const x of [5, 15, 25, 35]) assert.ok(Math.abs(g(x) - Math.sin(x / 6) * 10) < 1.5, `x=${x}`);
  const bad = line.map((v, i) => i === 20 ? v + 500 : v), r = lowessFit(xs, bad);
  assert.ok(Math.abs(r(20) - 62) < 5, `the outlier does not drag the curve (${r(20)})`);
  assert.ok(Math.abs(lowessFit(xs, bad, 2 / 3, 0)(20) - 62) > 10, 'without the robust rounds it does');
});

test('regplot(lowess) / residplot(lowess): a curve instead of the polynomial (no band), the curve of the residuals over the points; verify passes and is stable', async () => {
  const sine = x.map(v => Math.sin(v / 4) * 10 + v / 3), g = x.map((_v, i) => (i % 2 ? 'a' : 'b'));
  for (const make of [() => regplot({x, y: sine}, {lowess: true}), () => regplot({x, y: sine, group: g}, {lowess: true, frac: 0.4}), () => residplot({x, y: sine}, {lowess: true})]) {
    const {chart, problems} = await chartOf(make());
    assert.deepEqual(problems, [], problems.join('; '));
    assert.deepEqual(chart.items, (await chartOf(make())).chart.items);
  }
  const a = await chartOf(regplot({x, y: sine}, {lowess: true}));
  assert.match(a.chart.alt, /LOWESS/);
  assert.equal(a.chart.items.filter(i => i.k === 'path' && i.fill === 'accent' && i.op === 0.14).length, 0, 'no confidence band');
  const r = await chartOf(residplot({x, y: sine}, {lowess: true}));
  assert.match(r.chart.alt, /残差プロットとLOWESS/);
  assert.ok(r.chart.items.some(i => i.k === 'path' && i.sw === 2.5), 'the curve of the residuals');
  assert.throws(() => regplot({x, y: sine}, {lowess: true, stats: true}), /not defined for lowess/);
  assert.throws(() => regplot({x, y: sine}, {lowess: true, order: 2}), /give one/);
  assert.throws(() => regplot({x, y: sine}, {lowess: true, frac: 0}), /frac must be/);
});
