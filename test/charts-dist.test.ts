import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, displot, ecdfplot, histplot, kdeplot, rugplot} from '../lib/dsl.ts';
import {binCounts} from '../lib/stats.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const A = [62, 65, 67, 68, 69, 70, 70, 71, 72, 72, 73, 74, 74, 75, 76, 77, 78, 80, 82, 85], B = [48, 50, 52, 53, 54, 55, 56, 57, 57, 58, 59, 60, 61, 62, 63, 64, 66, 68, 70];

test('binCounts: a value on an edge goes to the class above, the largest to the last class', () => {
  assert.deepEqual(binCounts([0, 1, 2, 3, 4], [0, 2, 4]), [2, 3]);
  assert.deepEqual(binCounts([5, 5, 9], [0, 5, 10]), [0, 3]);
});

test('every kind combination, with and without groups, every stat: verify passes and the figure is the same twice', async () => {
  const sets: ('hist' | 'kde' | 'ecdf' | 'rug')[][] = [['hist'], ['kde'], ['ecdf'], ['rug'], ['hist', 'kde'], ['hist', 'kde', 'rug'], ['ecdf', 'rug']];
  for (const kind of sets) for (const data of [A, {男性: A, 女性: B}]) for (const stat of ['count', 'density', 'probability', 'percent'] as const) {
    if (kind.includes('kde') && !kind.includes('hist') && stat !== 'density') continue;
    const make = () => displot(data, {kind, stat, label: '体重', element: stat === 'percent' ? 'step' : 'bars'});
    const {chart, problems} = await chartOf(make());
    assert.deepEqual(problems, [], `${kind} ${stat}: ${problems.join('; ')}`);
    assert.deepEqual(chart.items, (await chartOf(make())).chart.items);
  }
});

test('histplot(): the tallest class is 8 of 20 values — the y axis reaches it as a count (8), a share (0.4), a percentage (40) or a density (0.08)', async () => {
  for (const [stat, tick] of [['count', '8'], ['probability', '0.4'], ['percent', '40'], ['density', '0.08']] as const) {
    const {chart, problems} = await chartOf(histplot(A, {stat, binWidth: 5}));
    assert.deepEqual(problems, []);
    const ticks = chart.items.flatMap(i => i.k === 'text' ? [i.s] : []);
    assert.ok(ticks.includes(tick), `${stat}: ${ticks.join(' ')}`);
  }
  const {chart} = await chartOf(histplot({a: A, b: B}, {binWidth: 5}));
  assert.match(chart.alt, /n=20.*n=19/);
});

test('kdeplot(): a closed filled curve per group, a dashed outline for the second group (colour is not the only cue)', async () => {
  const {chart, problems} = await chartOf(kdeplot({男性: A, 女性: B}));
  assert.deepEqual(problems, []);
  assert.ok(chart.items.some(i => i.k === 'path' && i.dash === '6,4'));
  assert.equal(chart.items.filter(i => i.k === 'path' && i.fill !== 'none' && i.d.endsWith('Z')).length, 2);
});

test('ecdfplot(): steps up by 1/n per value and ends at 1; rugplot(): one tick per value', async () => {
  const e = await chartOf(ecdfplot(A));
  assert.deepEqual(e.problems, []);
  assert.ok(e.chart.items.some(i => i.k === 'text' && i.s === '累積割合'));
  const r = await chartOf(rugplot(A));
  assert.deepEqual(r.problems, []);
  assert.equal(r.chart.items.filter(i => i.k === 'path' && i.sw === 1.5).length, A.length);
});

test('errors name the call', () => {
  assert.throws(() => histplot([]), /histplot\(\): needs at least one group|has no values/);
  assert.throws(() => histplot([1, NaN]), /histplot\(\): .*must be a finite number/);
  assert.throws(() => kdeplot([3, 3, 3]), /a density curve needs at least two different values/);
  assert.throws(() => displot(A, {kind: ['hist', 'ecdf']}), /ecdf is a cumulative share/);
  assert.throws(() => displot(A, {kind: ['kde'], stat: 'count'}), /a density curve alone is a density/);
  assert.throws(() => histplot(A, {bins: 5, binWidth: 2}), /bins or binWidth/);
  assert.throws(() => histplot(A, {bw: 0} as never), /bw must be/);
  assert.throws(() => histplot({a: A, b: A, c: A, d: A, e: A}), /at most 4 groups/);
  assert.throws(() => histplot(Array.from({length: 500}, (_q, i) => i), {binWidth: 1}), /histplot\(\): .*classes/);
});

test('a group id is an anchor over the plot; a spotlight on it passes verify', async () => {
  const {chart} = await chartOf(histplot([{label: 'a', values: A, id: 'a'}, {label: 'b', values: B}]));
  assert.ok(chart.anchors.some(x => x.id === 'a'));
  const {verdict} = await checkDiagram(diagram({theme: 'blue', spotlight: 'a'}).add(histplot([{label: 'a', values: A, id: 'a'}, {label: 'b', values: B}])));
  assert.deepEqual(verdict.problems, []);
});
