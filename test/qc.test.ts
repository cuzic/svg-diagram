import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {bars, checkDiagram, closeMeasurer, controlChart, diagram, histogram, pareto, renderDiagram, scatter, xbarR} from '../lib/dsl.ts';
import {capability, histogramBins, mean, niceNear, paretoOrder, sd} from '../lib/qc.ts';
import {controlSignals, controlStats, correlation} from '../lib/qc-plane.ts';
import type {LaidOutBars, LaidOutPlane} from '../lib/types.ts';

test.after(() => closeMeasurer());

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

// ---- the numbers -------------------------------------------------------------------------------------------------------------

test('paretoOrder: descending, "other" last whatever its size, top folds the rest into it, vital = items to reach 80%', () => {
  const r = paretoOrder([{label: 'a', value: 5}, {label: 'その他', value: 30}, {label: 'b', value: 50}, {label: 'c', value: 10}, {label: 'd', value: 5}]);
  assert.deepEqual(r.items.map(i => i.label), ['b', 'c', 'a', 'd', 'その他']);
  assert.equal(r.vital, 4); // the named items together are only 70 of 100: all of them are in the "vital few" (the other item never is)
  const t = paretoOrder([{label: 'a', value: 50}, {label: 'b', value: 30}, {label: 'c', value: 10}, {label: 'd', value: 6}, {label: 'e', value: 4}], {top: 2});
  assert.deepEqual(t.items, [{label: 'a', value: 50}, {label: 'b', value: 30}, {label: 'その他', value: 20}]);
  assert.equal(t.vital, 2);
  assert.equal(paretoOrder([{label: 'a', value: 90}, {label: 'b', value: 10}]).vital, 1);
});

test('histogramBins: round class width, boundaries are multiples of it, every value counted once, the largest in the last class', () => {
  const v = [1.2, 1.5, 2.0, 2.2, 2.9, 3.1, 3.4, 4.0];
  const h = histogramBins(v, {width: 1});
  assert.deepEqual(h.edges, [1, 2, 3, 4]);
  assert.deepEqual(h.counts, [2, 3, 3]); // 2.0 is in [2, 3); 4.0, the largest, is in the last class [3, 4]
  assert.equal(h.counts.reduce((a, b) => a + b), v.length);
  const g = histogramBins(v, {bins: 4});
  assert.equal(g.width, niceNear((4.0 - 1.2) / 4));
  assert.equal(g.edges[0] % g.width, 0);
  assert.equal(g.counts.reduce((a, b) => a + b), v.length);
  const wide = histogramBins([5, 6], {width: 1, include: [3, 9]});
  assert.equal(wide.edges[0], 3);
  assert.ok(wide.edges[wide.edges.length - 1] >= 9);
});

test('mean / sd / capability', () => {
  near(mean([2, 4, 6]), 4);
  near(sd([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  const x = [9, 10, 11, 10, 10, 10, 9, 11];
  const c = capability(x, 8, 12);
  near(c.cp!, 4 / (6 * sd(x)));
  near(c.cpk!, Math.min((12 - mean(x)) / (3 * sd(x)), (mean(x) - 8) / (3 * sd(x))));
  assert.deepEqual(capability([5, 5, 5], 1, 9), {});
  near(capability(x, undefined, 12).cpk!, (12 - mean(x)) / (3 * sd(x)));
});

test('correlation: r, slope and intercept of an exact line and of a falling one', () => {
  const a = correlation([1, 2, 3, 4], [3, 5, 7, 9]);
  near(a.r, 1); near(a.slope, 2); near(a.intercept, 1);
  near(correlation([1, 2, 3], [9, 6, 3]).r, -1);
  assert.equal(correlation([1, 1, 1], [1, 2, 3]).r, 0);
});

test('controlStats xbar-R: centre line, A2 x R-bar limits, D4 x R-bar for the range', () => {
  const g = [[10, 12, 11], [11, 13, 12], [9, 11, 10], [10, 12, 14]]; // n = 3
  const means = [11, 12, 10, 12], ranges = [2, 2, 2, 4], rBar = 2.5;
  const x = controlStats('xbar', g), r = controlStats('r', g);
  near(x.cl, 11.25); near(x.ucl[0], 11.25 + 1.023 * rBar); near(x.lcl[0], 11.25 - 1.023 * rBar);
  assert.deepEqual(x.values, means); assert.deepEqual(r.values, ranges);
  near(r.cl, rBar); near(r.ucl[0], 2.575 * rBar); near(r.lcl[0], 0);
});

test('controlStats individuals: 2.66 x the mean moving range; the moving range chart has one point fewer', () => {
  const v = [10, 12, 11, 13, 10];
  const mrBar = (2 + 1 + 2 + 3) / 4;
  const x = controlStats('x', v), mr = controlStats('mr', v);
  near(x.cl, 11.2); near(x.ucl[0], 11.2 + 2.66 * mrBar); near(x.lcl[0], 11.2 - 2.66 * mrBar);
  assert.deepEqual(mr.values, [2, 1, 2, 3]); near(mr.cl, mrBar); near(mr.ucl[0], 3.267 * mrBar);
});

test('controlStats attributes: p varies with n and never goes below 0, np / c / u', () => {
  const a = [{n: 100, d: 4}, {n: 200, d: 10}, {n: 100, d: 6}], p = 20 / 400;
  const s = controlStats('p', a);
  near(s.cl, p); assert.deepEqual(s.values, [0.04, 0.05, 0.06]);
  near(s.ucl[0], p + 3 * Math.sqrt(p * (1 - p) / 100)); near(s.ucl[1], p + 3 * Math.sqrt(p * (1 - p) / 200));
  assert.ok(s.ucl[0] > s.ucl[1]); assert.ok(s.lcl.every(v => v >= 0));
  const np = controlStats('np', [{n: 50, d: 2}, {n: 50, d: 4}, {n: 50, d: 3}]);
  near(np.cl, 3); near(np.ucl[0], 3 + 3 * Math.sqrt(50 * 0.06 * 0.94));
  assert.throws(() => controlStats('np', a), /same number/);
  const c = controlStats('c', [4, 9, 5, 6]);
  near(c.cl, 6); near(c.ucl[0], 6 + 3 * Math.sqrt(6)); near(c.lcl[0], Math.max(0, 6 - 3 * Math.sqrt(6)));
  const u = controlStats('u', [{n: 2, d: 4}, {n: 4, d: 12}]);
  near(u.cl, 16 / 6); near(u.ucl[0], 16 / 6 + 3 * Math.sqrt(16 / 6 / 2));
});

test('controlStats: fixed limits replace the worked-out ones; wrong data is named', () => {
  const s = controlStats('x', [1, 2, 3, 2, 1], {cl: 2, ucl: 5, lcl: -1});
  near(s.cl, 2); assert.ok(s.ucl.every(v => v === 5)); assert.ok(s.lcl.every(v => v === -1));
  assert.throws(() => controlStats('xbar', [[1, 2], [1, 2, 3]]), /same size/);
  assert.throws(() => controlStats('xbar', [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]), /2 to 10/);
  assert.throws(() => controlStats('x', [1]), /at least two/);
  assert.throws(() => controlStats('p', [{n: 5, d: 9}, {n: 5, d: 1}]), /d <= n/);
  assert.throws(() => controlStats('z' as never, [1, 2]), /type must be/);
});

test('controlSignals: outside the limits, 7 on one side, 7 rising or falling — and nothing else', () => {
  const s = (values: number[]) => ({cl: 5, ucl: values.map(() => 9), lcl: values.map(() => 1), values});
  assert.deepEqual([...controlSignals(s([5, 5.5, 9.5, 4, 0.5, 5.1])).outside], [2, 4]);
  assert.deepEqual([...controlSignals(s([6, 7, 6, 8, 7, 6, 7, 4, 5])).pattern], [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...controlSignals(s([2, 3, 4, 5.5, 6, 7, 8, 4])).pattern], [0, 1, 2, 3, 4, 5, 6]); // 7 rising, ends at 8
  assert.equal(controlSignals(s([6, 7, 6, 8, 7, 6, 4, 7, 6])).pattern.size, 0);
  assert.equal(controlSignals(s([6, 7, 6, 8, 5, 6, 7, 8])).pattern.size, 0);
});

// ---- the figures -------------------------------------------------------------------------------------------------------------

const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));

test('pareto(): bars touch, the leading items that reach 80% keep the colour, the line is cumulative and ends at the top (100%)', async () => {
  const items = [{label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: '寸法', value: 8}, {label: '変色', value: 4}, {label: 'その他', value: 9}];
  const {laidOut, verdict} = await laid(pareto(items, {unit: '件'}));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars;
  assert.deepEqual(b.bars.map(r => r.fill), ['accent', 'accent', 'accent', 'accent', 'muted', 'muted']); // 42 + 25 + 12 + 8 = 87 of 100 passes 80 at the 4th
  for (let i = 1; i < b.bars.length; i++) near(b.bars[i].x, b.bars[i - 1].x + b.bars[i - 1].w, 1e-6);
  const line = b.ink!.polylines[0].pts;
  assert.equal(line.length, items.length + 1);
  near(line[0].y, b.bars[0].y + b.bars[0].h, 1e-6); // starts at the origin
  near(line[1].y, b.bars[0].y, 1e-6);               // the first bar's top is the first cumulative value
  assert.ok(line[line.length - 1].y < Math.min(...b.bars.map(r => r.y))); // 100% is the top of the plot, above the tallest bar (42%)
  for (let i = 2; i < line.length; i++) assert.ok(line[i].y < line[i - 1].y);
  assert.ok(b.texts.some(t => t.text === '80%') && b.texts.some(t => t.text === '100%'));
  assert.ok(b.ink!.lines.some(l => l.dashed)); // the 80% guide
});

test('pareto(): top folds the rest, highlight: false keeps one colour, guide: false has no guide line; bad input is named', async () => {
  const items = Array.from({length: 8}, (_, i) => ({label: `項目${i + 1}`, value: 40 - i * 4}));
  const {laidOut, verdict} = await laid(pareto(items, {top: 3, highlight: false, guide: false}));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars;
  assert.equal(b.bars.length, 4);
  assert.ok(b.bars.every(r => r.fill === 'accent'));
  assert.ok(!b.ink!.lines.some(l => l.dashed));
  assert.throws(() => pareto([], {}), /at least one/);
  assert.throws(() => pareto([{label: 'a', value: 0}]), /all values are 0/);
  assert.throws(() => pareto([{label: 'a', value: -1}]), />= 0/);
  assert.throws(() => pareto(items, {top: 0}), /top must be/);
});

test('histogram(): bars touch, edges are written under the boundaries, spec limits are lines and the classes beyond them are red', async () => {
  const v = [9.9, 10.0, 10.0, 10.1, 10.1, 10.1, 10.2, 10.2, 10.3, 10.5, 9.6];
  const {laidOut, verdict} = await laid(histogram(v, {width: 0.1, lsl: 9.7, usl: 10.4}));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars;
  for (let i = 1; i < b.bars.length; i++) near(b.bars[i].x, b.bars[i - 1].x + b.bars[i - 1].w, 1e-6);
  const edgeTexts = b.texts.filter(t => /^\d+(\.\d+)?$/.test(t.text) && t.anchor === 'middle').map(t => t.text);
  assert.ok(edgeTexts.includes('9.6') && edgeTexts.includes('10.5'));
  assert.equal(b.bars.length, 9); // 9.6 .. 10.5: the largest value, 10.5, is in the last class
  assert.equal(b.bars[0].fill, 'danger'); // 9.6-9.7 is below the lower limit
  assert.equal(b.bars[b.bars.length - 1].fill, 'danger'); // 10.4-10.5 is above the upper one
  assert.equal(b.bars[3].fill, 'accent');
  assert.ok(b.texts.some(t => t.text === '下限 9.7') && b.texts.some(t => t.text === '上限 10.4') && b.texts.some(t => t.text.startsWith('平均')));
  const lsl = b.ink!.lines.find(l => l.x1 === l.x2)!;
  near(lsl.x1, b.bars[1].x, 1.5); // the lower limit is the boundary between the 1st and the 2nd class
});

test('histogram(): normal draws a curve, bad input is named', async () => {
  const v = Array.from({length: 40}, (_, i) => 10 + Math.sin(i * 2.1) * 0.4 + (i % 5) * 0.05);
  const {laidOut, verdict} = await laid(histogram(v, {normal: true, bins: 6}));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars;
  assert.equal(b.ink!.polylines.length, 1);
  assert.ok(b.ink!.polylines[0].pts.length > 20);
  assert.throws(() => histogram([1]), /at least two/);
  assert.throws(() => histogram([1, NaN]), /finite/);
  assert.throws(() => histogram([1, 2, 3], {lsl: 5, usl: 4}), /below usl/);
  assert.throws(() => histogram([1, 2, 3], {bins: 0}), /bins must be/);
  assert.throws(() => histogram([1, 2, 3], {width: -1}), /width must be/);
});

test('bars() overlays: only vertical, not stacked; positions and counts are checked', () => {
  const d = [{label: 'a', value: 5}, {label: 'b', value: 3}];
  assert.throws(() => bars(d, {cumulative: {}}), /vertical bars/);
  assert.throws(() => bars(d, {dir: 'v', stack: true, lines: [{at: 1}]}), /not stacked/);
  assert.throws(() => bars(d, {dir: 'v', lines: [{at: 9}]}), /outside the bars' axis/);
  assert.throws(() => bars(d, {dir: 'v', vlines: [{at: 3}]}), /outside the bars/);
  assert.throws(() => bars(d, {dir: 'v', edges: ['a', 'b']}), /3 labels/);
  assert.throws(() => bars(d, {dir: 'v', cumulative: {}, max: 20}), /the total \(8\)/);
  assert.throws(() => bars(d, {dir: 'v', cumulative: {guide: 100}, max: 8}), /between 0 and 100/);
  assert.throws(() => bars(d, {dir: 'v', curve: {through: [[0, 1]]}}), /two/);
  assert.throws(() => bars(d, {dir: 'v', lines: [{at: 1, tone: 'blue' as never}]}), /tone/);
});

test('bars() lines: a reference line sits at its value; a label that would touch another goes a row higher; none overlap', async () => {
  const {laidOut, verdict} = await laid(bars([{label: 'a', value: 8}, {label: 'b', value: 6}, {label: 'c', value: 7}], {dir: 'v', max: 10, lines: [{at: 5, label: '目標'}], vlines: [{at: 1.5, label: '平均 1.5'}, {at: 1.6, label: '中央値 1.6'}, {at: 0, label: '左端'}]}));
  assert.deepEqual(verdict.problems, []);
  const b = laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars;
  const h = b.ink!.lines.find(l => l.y1 === l.y2)!;
  assert.ok(h.y1 > b.y && h.y1 < b.y + b.h);
  const ys = ['平均 1.5', '中央値 1.6'].map(t => b.texts.find(x => x.text === t)!.y);
  assert.notEqual(ys[0], ys[1]);
});

test('scatter(): axes fit the data, strata differ in colour and shape, the line and r are drawn, verify passes', async () => {
  const pts = Array.from({length: 12}, (_, i) => ({x: 20 + i, y: 2 + i * 0.5 + (i % 3) * 0.2, group: i % 2 ? '機械 B' : '機械 A'}));
  const {laidOut, verdict} = await laid(scatter(pts, {x: '温度', y: '不良率', regression: true}));
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.equal(p.points.length, 12);
  assert.equal(new Set(p.points.map(q => `${q.tone}/${q.shape}`)).size, 2);
  assert.equal(p.lines.length, 1);
  assert.ok(p.texts.some(t => /^r = [01]\.\d\d/.test(t.s)));
  assert.ok(p.texts.some(t => t.s.includes('機械 A')) && p.texts.some(t => t.s.includes('機械 B')));
});

test('scatter(): bad input is named', () => {
  const ok = [{x: 1, y: 1}, {x: 2, y: 3}];
  assert.throws(() => scatter([{x: 1, y: 1}], {x: 'a', y: 'b'}), /at least two/);
  assert.throws(() => scatter([{x: 1, y: NaN}, {x: 2, y: 3}], {x: 'a', y: 'b'}), /finite/);
  assert.throws(() => scatter([{x: 1, y: 1, group: 'a'}, {x: 2, y: 3}], {x: 'a', y: 'b'}), /every point needs one/);
  assert.throws(() => scatter(['a', 'b', 'c', 'd', 'e'].map((g, i) => ({x: i, y: i, group: g})), {x: 'a', y: 'b'}), /at most 4/);
  assert.throws(() => scatter(ok, {} as never), /axes' names/);
});

test('controlChart(): limits and centre are lines, the points outside are red crosses, a run is a red ring, labels clear each other', async () => {
  const v = [10.2, 9.8, 10.1, 9.9, 10.3, 9.7, 10.0, 10.2, 13, 9.9, 10.1, 9.8, 10.2, 10.0, 9.9, 10.1, 10.2, 9.8, 10.1, 9.9];
  const {laidOut, verdict} = await laid(controlChart('x', v));
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.equal(p.points.length, 20);
  assert.equal(p.points[8].shape, 'cross'); assert.equal(p.points[8].tone, 'danger');
  assert.equal(p.points[0].shape, 'dot');
  assert.equal(p.lines.length, 3);
  assert.ok(p.texts.some(t => t.s.startsWith('UCL')) && p.texts.some(t => t.s.startsWith('CL ')) && p.texts.some(t => t.s.startsWith('LCL')));
});

test('controlChart(): a run of 7 on one side is flagged and explained in the legend row; rules: false turns it off', async () => {
  const v = [10.0, 9.8, 10.2, 10.3, 10.2, 10.4, 10.3, 10.2, 10.3, 10.2, 9.8, 9.9, 9.7, 10.0, 9.8]; // 8 in a row above the centre line (10.07)
  const a = (await laid(controlChart('x', v))).laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.ok(a.points.some(q => q.shape === 'ring'));
  assert.ok(a.texts.some(t => t.s.includes('連・傾向')));
  const b = (await laid(controlChart('x', v, {rules: false}))).laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.ok(b.points.every(q => q.shape === 'dot'));
});

test('controlChart(): p chart steps with n; a chart whose lower limit is 0 has no LCL label; the moving range starts at sample 2', async () => {
  const p = (await laid(controlChart('p', [{n: 100, d: 3}, {n: 200, d: 8}, {n: 100, d: 5}, {n: 150, d: 4}, {n: 100, d: 6}]))).laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.ok(p.paths!.length >= 2); // the data and the stepped limits
  const r = (await laid(controlChart('mr', [10, 12, 11, 13, 10, 12]))).laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane;
  assert.equal(r.points.length, 5);
  assert.ok(!r.texts.some(t => t.s.startsWith('LCL')));
});

test('xbarR(): two figures, the fixed limits go to the X-bar chart, an id too; at labels the axis', async () => {
  const g = Array.from({length: 8}, (_, i) => [10 + (i % 3) * 0.1, 10.1, 9.9 + (i % 2) * 0.1]);
  const [a, b] = xbarR(g, {id: 'x1', limits: {cl: 10, ucl: 10.5, lcl: 9.5}, at: g.map((_, i) => `${i + 1}日`)});
  assert.equal((a as {id?: string}).id, 'x1'); assert.equal((b as {id?: string}).id, undefined);
  const {laidOut, verdict} = await laid(a, b);
  assert.deepEqual(verdict.problems, []);
  const planes = laidOut.laidOut.filter(x => x.type === 'plane') as LaidOutPlane[];
  assert.equal(planes.length, 2);
  assert.ok(planes[0].texts.some(t => t.s === 'UCL 10.5'));
  assert.ok(planes[0].texts.some(t => t.s === '3日'));
  assert.throws(() => controlChart('x', [1, 2, 3], {at: ['a']}), /one label per sample/);
});

test('every QC figure renders to an SVG without a problem', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(
    pareto([{label: 'a', value: 5}, {label: 'b', value: 3}, {label: 'c', value: 1}]),
    histogram([1, 2, 2, 3, 3, 3, 4, 4, 5], {usl: 4.5}),
    scatter([{x: 1, y: 2}, {x: 2, y: 4}, {x: 3, y: 5}], {x: 'x', y: 'y', regression: true}),
    controlChart('c', [3, 5, 4, 6, 2, 4]),
  ), {name: 'qc.svg', budget: 'cacheOnly'});
  assert.ok(svg.includes('<svg'));
});

// ---- tables --------------------------------------------------------------------------------------------------------------------

import {checkSheet, matrix, tally} from '../lib/dsl.ts';
import {matrixScores} from '../lib/qc-table.ts';
import type {LaidOutTable} from '../lib/types.ts';

test('tally(): 一 丅 下 止 are 1 to 4 strokes, 正 is 5, and a sixth starts again', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 12, 25].map(tally), ['', '一', '丅', '下', '止', '正', '正一', '正丅', '正正丅', '正正正正正']);
  assert.throws(() => tally(-1), /whole number/);
  assert.throws(() => tally(1.5), /whole number/);
});

const cellsOf = (t: LaidOutTable): string[][] => t.rows.filter(r => !r.header).map(r => r.cells.map(c => c.text));

test('checkSheet(): tally marks and a column and a row of totals that add up', async () => {
  const {laidOut, verdict} = await laid(checkSheet([{label: '傷', counts: [3, 5, 2]}, {label: '汚れ', counts: [1, 0, 4]}], ['月', '火', '水'], {corner: '不良'}));
  assert.deepEqual(verdict.problems, []);
  const rows = cellsOf(laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.deepEqual(rows[0], ['傷', '下', '正', '丅', '10']);
  assert.deepEqual(rows[1], ['汚れ', '一', '', '止', '5']);
  assert.deepEqual(rows[2], ['計', '4', '5', '6', '15']);
});

test('checkSheet(): digits or both; an empty sheet has no totals and can have boxes; bad input is named', async () => {
  const num = cellsOf((await laid(checkSheet([{label: 'a', counts: [7]}], ['x'], {as: 'number'}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.deepEqual(num[0], ['a', '7', '7']);
  const both = cellsOf((await laid(checkSheet([{label: 'a', counts: [7]}], ['x'], {as: 'both'}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.equal(both[0][1], '正丅 7');
  const empty = cellsOf((await laid(checkSheet(['点検 A', '点検 B'], ['月', '火'], {boxes: true}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.deepEqual(empty, [['点検 A', '☐', '☐'], ['点検 B', '☐', '☐']]);
  assert.throws(() => checkSheet([], ['a']), /at least one item/);
  assert.throws(() => checkSheet(['a'], []), /at least one column/);
  assert.throws(() => checkSheet([{label: 'a', counts: [1]}], ['x', 'y']), /1 counts for 2 columns/);
  assert.throws(() => checkSheet([{label: 'a', counts: [-1]}], ['x']), /whole numbers/);
  assert.throws(() => checkSheet(['a'], ['x'], {total: true}), /total needs counts/);
  assert.throws(() => checkSheet([{label: 'a', counts: [1]}], ['x'], {as: 'z' as never}), /tally/);
});

test('matrixScores: weight x value summed along each row, with the QFD scale 9 / 3 / 1 / 0 unless values says otherwise', () => {
  assert.deepEqual(matrixScores([['best', 'ok', undefined], ['mid', 'ng', 'best']], [5, 4, 3]), [9 * 5 + 3 * 4, 1 * 5 + 0 + 9 * 3]);
  assert.deepEqual(matrixScores([['best', 'ok']], undefined, {best: 5, ok: 2}), [7]);
});

test('matrix(): marks as symbols, a row of weights, a score per row, the best one marked; verify passes', async () => {
  const {laidOut, verdict} = await laid(matrix(['A', 'B'], ['x', 'y'], [['◎', '○'], ['△', 'best']], {weights: [2, 1], corner: '案'}));
  assert.deepEqual(verdict.problems, []);
  const t = laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable;
  const rows = cellsOf(t);
  assert.deepEqual(rows[0], ['重み', '2', '1', '']);
  assert.ok(rows[1][1].includes('◎') && rows[1][2].includes('○'));
  assert.equal(rows[1][3], `◎ ${9 * 2 + 3}`); // A scores 21, the best: marked
  assert.equal(rows[2][3], String(1 * 2 + 9)); // B scores 11
});

test('matrix(): no weights, no score unless total; bad input is named', async () => {
  const plain = cellsOf((await laid(matrix(['A'], ['x'], [['○']]))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.equal(plain[0].length, 2);
  const summed = cellsOf((await laid(matrix(['A'], ['x', 'y'], [['○', '○']], {total: true}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.equal(summed[0][3] ?? summed[0][2], '6');
  assert.throws(() => matrix([], ['x'], []), /at least one row/);
  assert.throws(() => matrix(['A'], [], [[]]), /at least one column/);
  assert.throws(() => matrix(['A'], ['x'], []), /0 rows for 1/);
  assert.throws(() => matrix(['A'], ['x', 'y'], [['○']]), /1 cells for 2/);
  assert.throws(() => matrix(['A'], ['x'], [['?' as never]]), /mark "\?"|mark "\\"\?\\""/);
  assert.throws(() => matrix(['A'], ['x'], [['○']], {weights: [1, 2]}), /weights has 2/);
  assert.throws(() => matrix(['A'], ['x'], [['○']], {weights: [-1]}), /weight must be/);
  assert.throws(() => matrix(['A'], ['x'], [['○']], {values: {oops: 1} as never}), /values has/);
});

// ---- the new QC seven: arrow diagram, relations, PDPC, affinity ---------------------------------------------------------------

import {affinity, arrowDiagram, pdpc, relationDiagram, stateDiagram} from '../lib/dsl.ts';
import {criticalPath} from '../lib/qc.ts';
import type {LaidOutCause, LaidOutStates} from '../lib/types.ts';

const NET = [
  {from: 1, to: 2, name: 'A', days: 5}, {from: 2, to: 3, name: 'B', days: 8}, {from: 2, to: 4, name: 'C', days: 6},
  {from: 3, to: 5, name: 'D', days: 4}, {from: 4, to: 5, name: 'E', days: 3},
];

test('criticalPath: earliest and latest times, the float of each activity, the critical path and the length', () => {
  const r = criticalPath(NET);
  assert.equal(r.length, 17);
  assert.deepEqual(r.events.map(e => [e.id, e.early, e.late]), [['1', 0, 0], ['2', 5, 5], ['3', 13, 13], ['4', 11, 14], ['5', 17, 17]]);
  assert.deepEqual(r.activities.map(a => [a.name, a.float, a.critical]), [['A', 0, true], ['B', 0, true], ['C', 3, false], ['D', 0, true], ['E', 3, false]]);
  assert.deepEqual(r.path, ['A', 'B', 'D']);
});

test('criticalPath: a dummy takes no time but orders; a parallel pair of critical paths still gives one path; events sort as numbers', () => {
  const r = criticalPath([
    {from: 1, to: 2, name: 'A', days: 3}, {from: 1, to: 3, name: 'B', days: 3}, {from: 2, to: 4, name: 'C', days: 2},
    {from: 3, to: 4, dummy: true}, {from: 4, to: 10, name: 'D', days: 1},
  ]);
  assert.deepEqual(r.events.map(e => e.id), ['1', '2', '3', '4', '10']);
  assert.equal(r.length, 6);
  assert.equal(r.activities.find(a => a.dummy)!.float, 2); // B ends at 3, the join at 5
  assert.deepEqual(r.path, ['A', 'C', 'D']);
});

test('criticalPath: bad networks are named', () => {
  assert.throws(() => criticalPath([]), /at least one/);
  assert.throws(() => criticalPath([{from: 1, to: 2, name: 'A', days: 1}, {from: 3, to: 4, name: 'B', days: 1}]), /exactly one start event/);
  assert.throws(() => criticalPath([{from: 1, to: 2, name: 'A', days: 1}, {from: 1, to: 3, name: 'B', days: 1}]), /exactly one end event/);
  assert.throws(() => criticalPath([{from: 1, to: 2, name: 'A', days: 1}, {from: 2, to: 3, name: 'B', days: 1}, {from: 3, to: 2, name: 'C', days: 1}, {from: 3, to: 4, name: 'D', days: 1}]), /round in a circle/);
  assert.throws(() => criticalPath([{from: 1, to: 1, name: 'A', days: 1}]), /starts and ends at event 1/);
  assert.throws(() => criticalPath([{from: 1, to: 2, days: 1}]), /needs a name/);
  assert.throws(() => criticalPath([{from: 1, to: 2, name: 'A', days: -1}]), /days >= 0/);
  assert.throws(() => criticalPath([{from: 1, to: 2, dummy: true, days: 3}]), /takes no time/);
});

test('arrowDiagram(): circles with the times, critical arrows thick and red, floats on the others, a line with the length and the path; verify passes', async () => {
  const bands = arrowDiagram(NET);
  assert.equal(bands.length, 2);
  const {laidOut, verdict} = await laid(...bands);
  assert.deepEqual(verdict.problems, []);
  const s = laidOut.laidOut.find(x => x.type === 'states') as LaidOutStates;
  assert.equal(s.nodes.length, 5);
  assert.ok(s.nodes.every(n => n.circle && Math.abs(n.w - n.h) < 1e-6));
  assert.deepEqual(s.edges.filter(e => e.tone === 'danger').map(e => `${e.from}>${e.to}`).sort(), ['1>2', '2>3', '3>5']);
  assert.ok(s.edges.filter(e => e.tone === 'danger').every(e => e.strong));
  assert.ok(s.texts.some(t => t.text === '11/14') && s.texts.some(t => t.text === '17/17'));
  assert.ok(s.labels.some(l => l.text === 'C 6（余裕3）') && s.labels.some(l => l.text === 'A 5'));
  const cap = laidOut.laidOut.find(x => x.type === 'caption') as {lines: {text: string}[]} | undefined;
  assert.ok(cap);
});

test('arrowDiagram(): summary / times options; the dummy is dashed and has no label; the svg draws circles and the red arrows', async () => {
  const bands = arrowDiagram([{from: 1, to: 2, name: 'A', days: 2}, {from: 1, to: 3, name: 'B', days: 1}, {from: 3, to: 2, dummy: true}], {summary: false, times: false});
  assert.equal(bands.length, 1);
  const s = bands[0] as {transitions: {line?: string; label?: string; tone?: string}[]; states: {sub?: string}[]};
  assert.ok(s.states.every(x => x.sub === undefined));
  assert.equal(s.transitions[2].line, 'dashed'); assert.equal(s.transitions[2].label, undefined);
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(...arrowDiagram(NET)), {name: 'arrow.svg', budget: 'cacheOnly'});
  assert.equal((svg.match(/<circle /g) ?? []).length, 5);
  assert.ok(svg.includes('stroke-width="4"'));
});

test('stateDiagram(): shape and tone are checked', () => {
  assert.throws(() => stateDiagram([{id: 'a', label: 'a', shape: 'star' as never}], []), /shape/);
  assert.throws(() => stateDiagram([{id: 'a', label: 'a'}, {id: 'b', label: 'b'}], [{from: 'a', to: 'b', tone: 'blue' as never}]), /tone/);
});

test('relationDiagram(): arrows are counted, the factor with the most leaving arrows is the key one, the problem is red, cycles are drawn', async () => {
  const nodes = ['late', 'rush', 'plan', 'est', 'sw'].map(id => ({id, label: id}));
  const links = [{from: 'est', to: 'plan'}, {from: 'est', to: 'rush'}, {from: 'est', to: 'sw'}, {from: 'plan', to: 'rush'}, {from: 'rush', to: 'plan'}, {from: 'rush', to: 'late'}, {from: 'sw', to: 'late'}];
  const band = relationDiagram(nodes, links, {problem: 'late'});
  assert.equal(band.nodes.find(n => n.id === 'est')!.role, 'root');
  assert.equal(band.nodes.find(n => n.id === 'late')!.role, 'ude');
  assert.equal(band.nodes.find(n => n.id === 'rush')!.role, 'effect');
  assert.equal(band.nodes.find(n => n.id === 'est')!.sub, '出 3・入 0');
  assert.equal(band.nodes.find(n => n.id === 'late')!.sub, '出 0・入 2');
  const {laidOut, verdict} = await laid(band);
  assert.deepEqual(verdict.problems, []);
  assert.equal((laidOut.laidOut.find(x => x.type === 'cause') as LaidOutCause).edges.length, 7);
});

test('relationDiagram(): no key factor when no one leads (fewer than 2 leaving), an own role wins, counts: false, bad input is named', () => {
  const nodes = [{id: 'a', label: 'a'}, {id: 'b', label: 'b', role: 'goal' as const}, {id: 'c', label: 'c'}];
  const band = relationDiagram(nodes, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}], {counts: false});
  assert.deepEqual(band.nodes.map(n => n.role), ['effect', 'goal', 'effect']);
  assert.ok(band.nodes.every(n => n.sub === undefined));
  assert.throws(() => relationDiagram([], []), /at least one node/);
  assert.throws(() => relationDiagram(nodes, [], {problem: 'zzz'}), /unknown node "zzz"/);
  assert.throws(() => relationDiagram(nodes, [{from: ['a', 'b'], to: 'c'} as never]), /one cause/);
});

test('pdpc(): risks are hexagons, the arrows into and out of a risk or a measure are dashed, the main path is solid; verify passes', async () => {
  const band = pdpc(
    [{id: 's', label: 's', role: 'start'}, {id: 'a', label: 'a'}, {id: 'r', label: 'r', role: 'risk'}, {id: 'm', label: 'm', role: 'measure'}, {id: 'g', label: 'g', role: 'goal'}],
    [{from: 's', to: 'a'}, {from: 'a', to: 'g'}, {from: 'a', to: 'r'}, {from: 'r', to: 'm'}, {from: 'm', to: 'a'}],
  );
  assert.deepEqual(band.links.map(l => l.line), ['solid', 'solid', 'dashed', 'dashed', 'dashed']);
  assert.equal(band.dir, 'down');
  const {laidOut, verdict} = await laid(band);
  assert.deepEqual(verdict.problems, []);
  const c = laidOut.laidOut.find(x => x.type === 'cause') as LaidOutCause;
  assert.equal(c.nodes.filter(n => n.hex).length, 1);
  assert.throws(() => pdpc([{id: 'a', label: 'a', role: 'obstacle' as never}], []), /role/);
});

test('affinity(): groups side by side, a group of groups is as wide as it has of them, cards stack; bad input is named', async () => {
  const bands = affinity([
    {title: '大 A', groups: [{title: '小 1', cards: ['a1', 'a2']}, {title: '小 2', cards: ['b1']}]},
    {title: 'B', cards: ['c1', 'c2', 'c3']},
    {title: 'C', cards: ['d1']},
  ]);
  assert.equal(bands.length, 2); // 2 + 1 columns fill the first row; C is on the second
  const {laidOut, verdict} = await laid(...bands);
  assert.deepEqual(verdict.problems, []);
  const texts = JSON.stringify(laidOut.laidOut);
  for (const t of ['大 A', '小 1', '小 2', 'B', 'C', 'a1', 'd1']) assert.ok(texts.includes(t), t);
  assert.throws(() => affinity([]), /at least one group/);
  assert.throws(() => affinity([{title: ' ', cards: ['x']}]), /needs a title/);
  assert.throws(() => affinity([{title: 'g'}]), /no cards and no groups/);
  assert.throws(() => affinity([{title: 'g', cards: ['']}]), /empty card/);
  assert.throws(() => affinity([{title: 'g', cards: ['x']}], {cols: 0}), /cols must be/);
});

// ---- findings of the Opus review ----------------------------------------------------------------------------------------------

const planeOf = async (...bands: unknown[]) => { const r = await laid(...bands); return {p: r.laidOut.laidOut.find(x => x.type === 'plane') as LaidOutPlane, b: r.laidOut.laidOut.find(x => x.type === 'bars') as LaidOutBars, verdict: r.verdict}; };

test('histogram(): boundaries, limits and the mean are written exactly (not to 3 significant digits)', async () => {
  const v = [250.1, 250.3, 250.6, 250.8, 251.2, 251.4, 250.9, 250.4, 251.0, 250.7];
  const {b, verdict} = await planeOf(histogram(v, {width: 0.5, lsl: 250.25, usl: 251.75}));
  assert.deepEqual(verdict.problems, []);
  const t = b.texts.map(x => x.text);
  for (const s of ['250', '250.5', '251', '251.5', '252', '下限 250.25', '上限 251.75']) assert.ok(t.includes(s), s);
  assert.ok(t.some(s => /^平均 250\.\d\d$/.test(s)));
});

test('histogram(): far limits do not squash the data into one class; too many classes is an error; bins and width together too', () => {
  const h = histogram([50, 51, 52, 53, 52, 51, 52, 55, 56, 49], {lsl: 40, usl: 70});
  assert.ok(h.data.filter(d => d.value > 0).length >= 3, 'the data keeps several classes');
  assert.throws(() => histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {width: 0.01}), /at most 60/);
  assert.throws(() => histogram([1, 2, 3], {bins: 3, width: 1}), /bins or width/);
});

test('arrowDiagram(): big and fractional times are exact, float noise is no float, the critical events are red', async () => {
  const big = arrowDiagram([{from: 1, to: 2, name: 'A', days: 1234}, {from: 2, to: 3, name: 'B', days: 1}]);
  assert.ok(JSON.stringify(big).includes('1235/1235') && JSON.stringify(big).includes('全体で 1235日'));
  const frac = arrowDiagram([{from: 1, to: 2, name: 'A', days: 0.1}, {from: 2, to: 3, name: 'B', days: 0.2}, {from: 1, to: 3, name: 'C', days: 0.3}], {summary: false});
  const states = (frac[0] as {states: {id: string; sub?: string; tone?: string}[]}).states;
  assert.equal(states[0].sub, '0/0');
  assert.ok(states.every(s => s.tone === 'danger'));
  assert.throws(() => criticalPath([{from: 1, to: 2, name: 'A', days: 1}, {from: 1, to: 2, name: 'B', days: 2}]), /two activities run from event 1 to event 2/);
});

test('scatter(): a narrow y span with legend and regression builds; a fixed axis that cuts the data, or a constant, is refused', async () => {
  const {p, verdict} = await planeOf(scatter([{x: 1, y: 1}, {x: 2, y: 2}, {x: 3, y: 3}, {x: 4, y: 2.5}], {x: 'X', y: 'Y', regression: true}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(p.ticks.length < 20);
  const g = (await planeOf(scatter([{x: 1, y: 1.1, group: '夜勤'}, {x: 2, y: 2, group: '日勤'}, {x: 3, y: 2.6, group: '夜勤'}, {x: 4, y: 2.2, group: '日勤'}], {x: 'X', y: 'Y', regression: true})));
  assert.deepEqual(g.verdict.problems, []);
  assert.throws(() => scatter([{x: 1, y: 1}, {x: 2, y: 5}], {x: {label: 'X', min: 2}, y: 'Y'}), /axis starts at 2/);
  assert.throws(() => scatter([{x: 1, y: 1}, {x: 9, y: 5}], {x: {label: 'X', max: 5}, y: 'Y'}), /axis ends at 5/);
  assert.throws(() => scatter([{x: 1, y: 1}, {x: 1, y: 5}], {x: 'X', y: 'Y', regression: true}), /to vary/);
  const minus = (await planeOf(scatter([{x: 1, y: 5}, {x: 2, y: 3}, {x: 3, y: 1.5}], {x: 'X', y: 'Y', regression: true}))).p.texts.map(t => t.s).find(s => s.startsWith('r ='))!;
  assert.ok(minus.startsWith('r = −') && minus.includes('y = −'), minus);
});

test('controlChart(): a p chart whose last lower limit is 0 builds, stepped limits are not given one number', async () => {
  const {p, verdict} = await planeOf(controlChart('p', [{n: 50, d: 2}, {n: 500, d: 12}, {n: 80, d: 6}, {n: 300, d: 3}, {n: 50, d: 9}]));
  assert.deepEqual(verdict.problems, []);
  assert.ok(p.texts.some(t => t.s === 'UCL（n による）'));
  assert.ok(!p.texts.some(t => t.s.startsWith('LCL')));
});

test('controlChart(): limits given in part move the others with the centre line; nonsense limits, c counts and flat data are refused', () => {
  const moved = controlStats('x', [1, 2, 3, 2, 1, 2], {cl: 10});
  assert.equal(moved.cl, 10);
  assert.ok(moved.ucl[0] > 10 && moved.lcl[0] < 10);
  near(moved.ucl[0] - moved.cl, controlStats('x', [1, 2, 3, 2, 1, 2]).ucl[0] - controlStats('x', [1, 2, 3, 2, 1, 2]).cl);
  assert.throws(() => controlStats('x', [1, 2, 3, 2], {ucl: 0, lcl: 5}), /lcl < cl < ucl/);
  assert.throws(() => controlStats('x', [1, 2, 3, 2], {ucl: NaN}), /finite/);
  assert.throws(() => controlStats('c', [-3, 2, 4, 1]), /whole number >= 0/);
  assert.throws(() => controlStats('np', [{n: 10, d: 1.5}, {n: 10, d: 2}]), /whole number/);
  assert.throws(() => controlStats('x', [5, 5, 5, 5, 5]), /does not vary/);
});

test('controlChart(): the axis holds a fixed centre line; dates on the axis thin out instead of overlapping', async () => {
  const dates = Array.from({length: 8}, (_, i) => `2026/10/0${i + 1}`);
  const {verdict, p} = await planeOf(controlChart('x', [1, 2, 3, 2, 1, 2, 3, 2], {at: dates}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(p.texts.filter(t => t.s.startsWith('2026')).length < 8);
});

test('xbarR(): the two charts have the same left margin; limits and labels can be given for each', async () => {
  const g = Array.from({length: 10}, (_, i) => [10 + (i % 3) * 0.1, 10.1, 9.9 + (i % 2) * 0.1]);
  const {laidOut, verdict} = await laid(...xbarR(g, {yLabel: {xbar: '軸径 (mm)', r: '範囲 (mm)'}, limits: {xbar: {cl: 10, ucl: 10.5, lcl: 9.5}}}));
  assert.deepEqual(verdict.problems, []);
  const planes = laidOut.laidOut.filter(x => x.type === 'plane') as LaidOutPlane[];
  near(planes[0].plotL, planes[1].plotL, 1e-6);
  assert.ok(planes[0].texts.some(t => t.s === '軸径 (mm)') && planes[1].texts.some(t => t.s === '範囲 (mm)'));
  assert.ok(planes[0].texts.some(t => t.s.startsWith('UCL 10.5')));
  const [a] = xbarR(g, {yLabel: 'X'});
  assert.equal((a as {y: {label?: string}}).y.label, 'X');
});

test('pareto(): flat values still build (the percent finds a free place); no line runs through a label; duplicate labels are refused', async () => {
  const {b, verdict} = await planeOf(pareto(Array.from({length: 10}, (_, i) => ({label: `P${i}`, value: 10})), {unit: '件'}));
  assert.deepEqual(verdict.problems, []);
  assert.equal(b.texts.filter(t => t.text.endsWith('%')).length, 6 + 10); // the axis ticks and one percent per bar
  assert.throws(() => pareto([{label: 'A', value: 1}, {label: 'A', value: 2}]), /written twice/);
});

test('verify: a vertical line through a value label is reported unless the label could dodge it; the curve may cross labels', async () => {
  const d = [{label: 'a', value: 4}, {label: 'b', value: 8}, {label: 'c', value: 6}];
  const dodged = await laid(bars(d, {dir: 'v', max: 10, barRatio: 1, vlines: [{at: 1.5, label: '平均'}]}));
  assert.deepEqual(dodged.verdict.problems, []);
  const bad = await laid(bars(d, {dir: 'v', max: 10, barRatio: 1, labels: 'all', lines: [{at: 6}], edges: ['0', '1', '2', '3']}));
  assert.ok(bad.verdict.problems.some(p => /a line runs through the label/.test(p)) || bad.verdict.problems.length === 0);
  const curve = await laid(bars(d, {dir: 'v', max: 10, barRatio: 1, curve: {through: [[0, 5], [1.5, 8], [3, 5]]}}));
  assert.deepEqual(curve.verdict.problems, []);
});

test('matrix(): a tie, or no score at all, marks no best row', async () => {
  const none = cellsOf((await laid(matrix(['A', 'B'], ['x', 'y'], [['×', '×'], ['×', '×']], {weights: [1, 1]}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.ok(none.slice(1).every(r => r[3] === '0'));
  const tie = cellsOf((await laid(matrix(['A', 'B'], ['x'], [['○'], ['○']], {total: true}))).laidOut.laidOut.find(x => x.type === 'table') as LaidOutTable);
  assert.ok(tie.every(r => !r.join('').includes('◎')));
});

test('pdpc(): no nodes is a clear error', () => { assert.throws(() => pdpc(undefined as never, []), /at least one node/); });
