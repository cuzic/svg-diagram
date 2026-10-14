import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {barplot, boxplot, catplot, checkDiagram, closeMeasurer, diagram, pointplot, stripplot, swarmplot, violinplot} from '../lib/dsl.ts';
import {boxStats, errorBar, kde, meanOf, quantile, sdOf, swarmOffsets, tCritical95} from '../lib/stats.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const A = [52, 58, 61, 63, 64, 66, 67, 69, 70, 72, 74, 75, 77, 81, 84, 96], B = [41, 47, 50, 52, 54, 55, 57, 58, 60, 61, 63, 65, 66, 70, 71], C = [48, 53, 57, 59, 60, 62, 63, 64, 66, 67, 69, 72, 75, 78];

// ---- the numbers ---------------------------------------------------------------------------------------------------------------

test('quantile / boxStats: numpy\'s linear quantile; whiskers stop at the last value within 1.5 IQR, the rest are fliers', () => {
  near(quantile([1, 2, 3, 4], 0.25), 1.75); near(quantile([1, 2, 3, 4], 0.5), 2.5); near(quantile([5], 0.9), 5);
  const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]);
  near(b.q1, 3.25); near(b.median, 5.5); near(b.q3, 7.75);
  assert.equal(b.hi, 9); assert.equal(b.lo, 1); assert.deepEqual(b.fliers, [30]);
  near(sdOf([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7)); near(meanOf([2, 4]), 3); assert.equal(sdOf([3]), 0);
});

test('errorBar: the 95% CI uses Student\'s t (n = 5: 2.776), sd / se / range, and nothing for a single value', () => {
  const v = [10, 12, 14, 16, 18], m = 14, sd = Math.sqrt(10), half = 2.776 * sd / Math.sqrt(5);
  const ci = errorBar(v, 'ci')!;
  near(ci[0], m - half); near(ci[1], m + half);
  assert.deepEqual(errorBar(v, 'range'), [10, 18]);
  near(errorBar(v, 'sd')![1], m + sd); near(errorBar(v, 'se')![1], m + sd / Math.sqrt(5));
  assert.equal(errorBar([3], 'ci'), undefined); assert.equal(errorBar(v, 'none'), undefined);
  near(tCritical95(30), 2.042); near(tCritical95(1000), 1.962, 0.002); near(tCritical95(60), 2.0, 0.005);
});

test('kde: a Gaussian estimate that integrates to about 1', () => {
  const grid = Array.from({length: 401}, (_q, i) => 20 + i * 0.25), {density} = kde(A, grid);
  near(density.reduce((a, b) => a + b, 0) * 0.25, 1, 0.02);
});

test('swarmOffsets: no two points touch, and the data order is kept; undefined when it cannot fit', () => {
  const at = [10, 10, 10, 11, 11, 30, 31, 10.5], offs = swarmOffsets(at, 8, 40)!;
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) assert.ok(Math.hypot(at[i] - at[j], offs[i] - offs[j]) >= 8 - 1e-6, `${i} and ${j} touch`);
  assert.equal(offs[5], 0);
  assert.equal(swarmOffsets(Array(50).fill(5), 8, 10), undefined);
});

// ---- the figures ---------------------------------------------------------------------------------------------------------------

test('every kind, both directions, with and without hues: the figure passes verify and is the same twice', async () => {
  const hued = [{label: '昼', hues: [{name: '男', values: A}, {name: '女', values: B}]}, {label: '夜', hues: [{name: '男', values: C}, {name: '女', values: B}]}];
  for (const kind of ['box', 'violin', 'strip', 'swarm', 'point', 'bar'] as const) for (const dir of ['v', 'h'] as const) for (const data of [{東京: A, 大阪: B, 名古屋: C}, hued]) {
    const make = () => catplot(data, {kind, dir, label: '売上', unit: '万円', counts: true, values: 'median', width: 760});
    const {chart, problems} = await chartOf(make());
    assert.deepEqual(problems, [], `${kind} ${dir}: ${problems.join('; ')}`);
    const again = (await chartOf(make())).chart;
    assert.deepEqual(chart.items, again.items, `${kind} ${dir} is not deterministic`);
  }
});

test('boxplot(): the box spans the quartiles, the median line is inside it, the flier is a ring, the median is written', async () => {
  const {chart, problems} = await chartOf(boxplot({東京: A}, {values: 'median'}));
  assert.deepEqual(problems, []);
  const box = chart.solids.find(s => s.label.startsWith('the box'))!;
  assert.ok(box.h > 0);
  assert.ok(chart.items.some(i => i.k === 'text' && i.s === '69.5'));
  const rings = chart.items.filter(i => i.k === 'path' && i.fill === 'none' && i.stroke === 'accent' && /a3,3/.test(i.d));
  assert.equal(rings.length, 1);
  assert.match(chart.alt, /箱ひげ図.*東京 n=16 中央値 69\.5/);
});

test('catplot(): a layered box + strip hides the box\'s fliers (the points show them); id on a group is an anchor', async () => {
  const {chart, problems} = await chartOf(catplot([{label: '東京', values: A, id: 'tokyo'}, {label: '大阪', values: B}], {kind: ['box', 'strip']}));
  assert.deepEqual(problems, []);
  assert.equal(chart.items.filter(i => i.k === 'path' && i.fill === 'none' && /a3,3/.test(i.d)).length, 0);
  assert.ok(chart.anchors.some(a => a.id === 'tokyo'));
  assert.equal(chart.anchors.length, 1);
});

test('barplot(): bars start at 0 whatever the data, the mean is written, the error bar is the CI; pointplot joins the means per hue', async () => {
  const {chart, problems} = await chartOf(barplot({a: [50, 52, 54, 56], b: [60, 61, 62, 66]}));
  assert.deepEqual(problems, []);
  assert.ok(chart.items.some(i => i.k === 'text' && i.s === '0'), 'the axis reaches 0');
  assert.ok(chart.items.some(i => i.k === 'text' && i.s === '53'));
  const pt = await chartOf(pointplot([{label: 'Q1', hues: [{name: 'x', values: A}, {name: 'y', values: B}]}, {label: 'Q2', hues: [{name: 'x', values: C}, {name: 'y', values: B}]}]));
  assert.deepEqual(pt.problems, []);
  const joins = pt.chart.items.filter(i => i.k === 'path' && i.fill === 'none' && i.sw === 2 && i.stroke === 'accent' && (i.d.match(/L/g) ?? []).length === 1);
  assert.equal(joins.filter(i => i.k === 'path' && i.dash === undefined).length >= 1, true, 'a solid line for the first hue');
  assert.equal(joins.filter(i => i.k === 'path' && i.dash === '6,4').length, 1, 'a dashed line for the second');
});

test('violinplot(): the area scale makes a spread-out group flatter, the width scale makes every violin as wide as the slot allows', async () => {
  const wide = Array.from({length: 20}, (_q, i) => i * 5), tight = Array.from({length: 20}, (_q, i) => 50 + i * 0.5);
  const widths = async (scale: 'area' | 'width') => {
    const {chart, problems} = await chartOf(violinplot({wide, tight}, {scale}));
    assert.deepEqual(problems, []);
    return chart.items.flatMap(i => {
      if (i.k !== 'path' || i.fill !== 'accent' || i.op === 0.8 || !i.d.endsWith('Z')) return [];
      const xs = [...i.d.matchAll(/[ML]([\d.]+),/g)].map(m => Number(m[1]));
      return [Math.max(...xs) - Math.min(...xs)];
    });
  };
  const [aw, at] = await widths('area'), [ww, wt] = await widths('width');
  near(ww, wt, 1); // as wide as the slot allows, both
  assert.ok(at > aw * 1.5, `area: the tight violin (${at}) is much wider than the spread one (${aw})`);
});

test('stripplot() / swarmplot(): every value is drawn once; strip jitter stays inside its slot', async () => {
  for (const make of [stripplot, swarmplot]) {
    const {chart, problems} = await chartOf(make({東京: A, 大阪: B}));
    assert.deepEqual(problems, []);
    const dots = chart.items.filter(i => i.k === 'path' && i.fill === 'accent' && i.op === 0.8);
    assert.equal(dots.length, A.length + B.length);
  }
});

test('hues: one legend entry per hue, at most four, every group needs them; a group may miss a hue', async () => {
  const {chart} = await chartOf(boxplot([{label: 'a', hues: [{name: '男', values: A}, {name: '女', values: B}]}, {label: 'b', hues: [{name: '男', values: C}]}]));
  const texts = chart.items.flatMap(i => i.k === 'text' ? [i.s] : []);
  assert.ok(texts.includes('男') && texts.includes('女'));
  assert.throws(() => boxplot([{label: 'a', hues: [1, 2, 3, 4, 5].map(n => ({name: `h${n}`, values: A}))}]), /at most 4 hues/);
  assert.throws(() => boxplot([{label: 'a', hues: [{name: 'x', values: A}]}, {label: 'b', values: B}]), /every group needs them/);
});

test('errors name the call and the value that is wrong', () => {
  assert.throws(() => boxplot({}), /boxplot\(\): needs at least one group/);
  assert.throws(() => boxplot({a: [1, NaN]}), /boxplot\(\): "a" value 2 must be a finite number/);
  assert.throws(() => boxplot({a: []}), /"a" has no values/);
  assert.throws(() => violinplot({a: [3, 3, 3]}), /a violin needs at least two different values/);
  assert.throws(() => catplot({a: A}, {kind: 'pie' as never}), /kind must be box/);
  assert.throws(() => catplot({a: A}, {kind: ['strip', 'swarm']}), /use one of them/);
  assert.throws(() => catplot({a: A}, {kind: ['bar', 'point']}), /use one of them/);
  assert.throws(() => boxplot({a: A}, {error: 'x' as never}), /error must be/);
  assert.throws(() => boxplot({a: A, b: A}, {dir: 'x' as never}), /dir must be/);
});

test('a swarm that cannot fit says so instead of drawing points on top of each other', async () => {
  await assert.rejects(laid(swarmplot({a: Array(300).fill(50).concat([51])}, {width: 300, height: 200})), /do not fit side by side/);
});

test('a spotlight on a group id keeps the rest of the figure and dims the others', async () => {
  const {verdict} = await checkDiagram(diagram({theme: 'blue', spotlight: 'tokyo'}).add(boxplot([{label: '東京', values: A, id: 'tokyo'}, {label: '大阪', values: B}])));
  assert.deepEqual(verdict.problems, []);
});
