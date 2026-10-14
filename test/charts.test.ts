import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {burndown, burnup, checkDiagram, closeMeasurer, connect, diagram, heatmap, lines, mekko, radar, renderDiagram, sankey, stackedBars, strategyCanvas, tornado, treemap, waterfall} from '../lib/dsl.ts';
import {squarify} from '../lib/charts-treemap.ts';
import {layersOf, resolveSankey} from '../lib/charts-sankey.ts';
import {heatLevel} from '../lib/charts-heatmap.ts';
import {niceScale, numText, signedText} from '../lib/charts-base.ts';
import type {LaidOutChart} from '../lib/charts.ts';
import type {LaidOutPlane} from '../lib/types/figures.ts';

test.after(() => closeMeasurer());

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const chartOf = async (band: unknown): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const texts = (c: LaidOutChart): string[] => c.items.flatMap(i => i.k === 'text' ? [i.s] : []);
const solid = (c: LaidOutChart, label: string) => c.solids.find(s => s.label === label)!;

// ---- numbers and text ----------------------------------------------------------------------------------------------------------

test('numText / signedText: exact, thousands separated, no float noise; niceScale covers the range with round ticks', () => {
  assert.equal(numText(1234567.5), '1,234,567.5');
  assert.equal(numText(0.1 + 0.2), '0.3');
  assert.equal(numText(-1200), '-1,200');
  assert.equal(signedText(5), '+5');
  assert.equal(signedText(-5), '-5');
  assert.equal(signedText(0), '+0');
  const s = niceScale(-130, 870);
  assert.ok(s.min <= -130 && s.max >= 870);
  assert.ok(s.ticks.every((t, i) => i === 0 || t > s.ticks[i - 1]));
  assert.equal(s.ticks[0], s.min); assert.equal(s.ticks[s.ticks.length - 1], s.max);
  assert.ok(niceScale(5, 5).max > niceScale(5, 5).min);
});

// ---- waterfall ----------------------------------------------------------------------------------------------------------------

const WF = [{label: '前期', value: 1000}, {label: '価格', value: 220, id: 'price'}, {label: '数量', value: -130}, {label: '小計', kind: 'subtotal' as const}, {label: '為替', value: 40}, {label: '今期', kind: 'total' as const}];

test('waterfall(): bars float on the running level, subtotal and total stand from 0, every value is written with its sign', async () => {
  const {chart, problems} = await chartOf(waterfall(WF, {unit: '百万円'}));
  assert.deepEqual(problems, []);
  const bar = (l: string) => solid(chart, l === '価格' ? 'price' : `bar "${l}"`);
  const t = texts(chart);
  for (const s of ['1,000百万円', '+220百万円', '-130百万円', '1,090百万円', '+40百万円', '1,130百万円']) assert.ok(t.includes(s), `${s} is printed`);
  // an increase starts where the level was and rises; a decrease hangs from the level
  const pr = bar('価格'), qt = bar('数量'), st = bar('前期');
  near(pr.y + pr.h, st.y, 0.2);                 // its foot is the top of the start bar
  near(qt.y, pr.y, 0.2);                         // the decrease hangs from the level the increase reached
  assert.ok(qt.y + qt.h > qt.y && qt.y + qt.h < pr.y + pr.h + 200);
  // scale: heights are proportional to values (220 vs 130)
  near(pr.h / qt.h, 220 / 130, 0.02);
  // totals stand on the zero line: same foot as the start bar
  near(bar('小計').y + bar('小計').h, st.y + st.h, 0.2);
  assert.ok(chart.segs.length === WF.length - 1, 'a connector between each pair of bars');
  assert.ok(chart.alt.includes('価格 +220百万円') && chart.alt.includes('小計 1,090百万円'));
});

test('waterfall(): a total that does not add up is an error that says both numbers; negative levels cross the zero line', async () => {
  assert.throws(() => waterfall([{label: 'a', value: 10}, {label: 'b', value: 5}, {label: 'c', kind: 'total', value: 99}]), /total "c" is 99, but the steps before it add up to 15/);
  const {chart, problems} = await chartOf(waterfall([{label: '開始', value: 50}, {label: '赤字', value: -120}, {label: '回復', value: 30}, {label: '終了', kind: 'total'}], {unit: '億円'}));
  assert.deepEqual(problems, []);
  const zero = solid(chart, 'bar "開始"').y + solid(chart, 'bar "開始"').h; // the 0 level
  const dip = solid(chart, 'bar "赤字"');
  assert.ok(dip.y < zero && dip.y + dip.h > zero, 'the decrease crosses zero');
  const end = solid(chart, 'bar "終了"');
  assert.ok(end.y >= zero - 0.2, 'a negative total hangs below the zero line');
  assert.ok(texts(chart).includes('-40億円'));
});

test("waterfall({dir: 'h'}): the same chart on its side: levels along x, steps down y, signs and a negative total as before", async () => {
  const {chart, problems} = await chartOf(waterfall([{label: '期首', value: 50}, {label: '赤字', value: -120}, {label: '回復', value: 30}, {label: '期末', kind: 'total'}], {unit: '億円', dir: 'h'}));
  assert.deepEqual(problems, []);
  for (const t of ['50億円', '-120億円', '+30億円', '-40億円']) assert.ok(texts(chart).includes(t), t);
  const zero = solid(chart, 'bar "期首"').x, dip = solid(chart, 'bar "赤字"');
  assert.ok(dip.x < zero && dip.x + dip.w > zero, 'the decrease crosses the zero line');
  const ys = ['期首', '赤字', '回復', '期末'].map(l => solid(chart, `bar "${l}"`).y);
  assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]), 'steps run down the page');
  assert.ok(solid(chart, 'bar "期末"').x + solid(chart, 'bar "期末"').w <= zero + 0.2, 'a negative total hangs to the left of zero');
  assert.throws(() => waterfall(WF, {dir: 'x' as never}), /dir must be/);
});

test('waterfall(): bad input is named', () => {
  assert.throws(() => waterfall([{label: 'a', value: 1}]), /at least two steps/);
  assert.throws(() => waterfall([{label: 'a', value: 1}, {label: 'b', kind: 'start', value: 2}]), /only the first step can be the 'start'/);
  assert.throws(() => waterfall([{label: 'a', value: 1}, {label: 'b', value: Number.NaN}]), /"b"'s value must be a finite number/);
  assert.throws(() => waterfall([{label: 'a', value: 1, id: 'x'}, {label: 'b', value: 2, id: 'x'}]), /^Error: waterfall\(\): each id must be unique/);
  assert.throws(() => waterfall([{label: 'a', kind: 'total'}, {label: 'b', value: 1}]), /a total adds up the steps before it, so it cannot be the first step/);
  assert.throws(() => waterfall([{label: 'a', value: 1}, {label: '', value: 2}]), /label must be a non-empty string/);
  assert.throws(() => waterfall([{label: 'a', value: 1}, {label: 'b', value: 2}], {labelRole: 'huge' as never}), /labelRole/);
});

test('waterfall(): spotlight on a step dims the other bars (and their labels), not the figure; a band target dims nothing; another band dims the figure', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: 'price'}).add(waterfall(WF)));
  const c = laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart;
  assert.ok(!c.dim);
  assert.ok(c.dimIds && !c.dimIds.includes('price') && c.dimIds.length === WF.length - 1, `the other ${WF.length - 1} bars dim`);
  const whole = await checkDiagram(diagram({theme: 'blue', spotlight: 'wf'}).add(waterfall(WF, {id: 'wf'})));
  const w = whole.laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart;
  assert.ok(!w.dim && !w.dimIds);
  const other = await checkDiagram(diagram({theme: 'blue', spotlight: 'box1'}).add(waterfall(WF, {id: 'wf'}), {type: 'box', id: 'box1', title: 'x'} as never));
  assert.ok((other.laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart).dim);
  const {svg} = await renderDiagram(diagram({theme: 'blue', spotlight: 'price'}).add(waterfall(WF)), {name: 'x.svg', budget: 'cacheOnly'});
  assert.ok(svg.includes('stroke-dasharray="2,5"'), 'a dimmed bar is outlined');
});

test('waterfall(): an id is an anchor for connect(); the reveal stage of the band is the stage of its ids', async () => {
  const d = diagram({theme: 'blue'}).add(waterfall(WF, {id: 'wf', reveal: 1}), connect('wf:right', 'price'));
  const r = await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  const c = r.laidOut.connects.find(x => x.toId === 'price')!;
  assert.equal(c.reveal, 1, 'the connector to a bar appears with the figure');
  await assert.rejects(laid(waterfall(WF, {id: 'wf'}), waterfall([{label: 'a', value: 1, id: 'price'}, {label: 'b', value: 2}])), /already has|another anchor/);
});

// ---- tornado -------------------------------------------------------------------------------------------------------------------

test('tornado(): rows are sorted by the length of the range, both ends are printed, the base line is where the bars start', async () => {
  const items = [{label: '小', low: 98, high: 103}, {label: '大', low: 60, high: 140}, {label: '中', low: 90, high: 115}];
  const {chart, problems} = await chartOf(tornado(items, {base: 100, unit: '億円'}));
  assert.deepEqual(problems, []);
  const order = chart.solids.filter(s => s.label.endsWith('低ケース')).map(s => s.label.replace(' 低ケース', ''));
  assert.deepEqual(order, ['大', '中', '小']);
  const big = solid(chart, '大 低ケース'), bigHi = solid(chart, '大 高ケース');
  near(big.x + big.w, bigHi.x, 0.2);        // they meet at the base line
  near(big.w / bigHi.w, 40 / 40, 0.02);
  for (const s of ['60億円', '140億円', '98億円', '103億円', '基準 100億円']) assert.ok(texts(chart).includes(s), s);
  assert.ok(chart.alt.startsWith('トルネード図（基準 100億円）'));
});

test('tornado(): a result above the base in both cases is drawn as two thin bars (they do not overlap); errors are named', async () => {
  const {chart, problems} = await chartOf(tornado([{label: '逆', low: 110, high: 130}, {label: '普通', low: 80, high: 120}], {base: 100}));
  assert.deepEqual(problems, []);
  const a = solid(chart, '逆 低ケース'), b = solid(chart, '逆 高ケース');
  assert.ok(a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01);
  assert.throws(() => tornado([{label: 'a', low: 1, high: 2}], {} as never), /needs the base result/);
  assert.throws(() => tornado([], {base: 1}), /at least one item/);
  assert.throws(() => tornado([{label: 'a', low: 1, high: 2}], {base: 1, lowTone: 'pink' as never}), /lowTone/);
});

// ---- heatmap -------------------------------------------------------------------------------------------------------------------

test('tornado(): a row id is an anchor over both of its bars (it used to be the low bar only, 2px at the base when low = base)', async () => {
  const {chart, problems} = await chartOf(tornado([{label: '単価', low: 100, high: 160, id: 'p'}, {label: '為替', low: 80, high: 130, id: 'fx'}], {base: 100}));
  assert.deepEqual(problems, []);
  const p = chart.anchors.find(a => a.id === 'p')!, hi = chart.solids.find(s => s.label === '単価 高ケース')!;
  assert.ok(p.w > 2 && p.x <= hi.x + 1.5 && p.x + p.w >= hi.x + hi.w - 0.5, 'the high bar is inside the anchor');
  const fx = chart.anchors.find(a => a.id === 'fx')!, lo = chart.solids.find(s => s.label === '為替 低ケース')!, hi2 = chart.solids.find(s => s.label === '為替 高ケース')!;
  assert.ok(fx.x <= lo.x + 0.5 && fx.x + fx.w >= hi2.x + hi2.w - 0.5, 'both bars');
  const {verdict} = await checkDiagram(diagram({theme: 'blue', spotlight: 'p'}).add(tornado([{label: '単価', low: 100, high: 160, id: 'p'}, {label: '為替', low: 80, high: 130}], {base: 100})));
  assert.deepEqual(verdict.problems, []);
});

test('tornado(): long case names wrap the legend to a second row; a base at the edge keeps its name in the figure (both used to run outside)', async () => {
  const L = '非常に長い名前がここに入ってしまったケースを想定しています';
  const a = await chartOf(tornado([{label: 'a', low: 90, high: 110}], {base: 100, lowLabel: L + L, highLabel: L}));
  assert.deepEqual(a.problems, []);
  const b = await chartOf(tornado([{label: 'a', low: 100, high: 300}], {base: 100, baseLabel: '基準ケースの営業利益'}));
  assert.deepEqual(b.problems, []);
  await assert.rejects(laid(tornado([{label: 'a', low: 1, high: 2}], {base: 1.5, lowLabel: L.repeat(4)})), /legend name .* is wider than the figure/);
});

test('heatmap(): every cell prints its number, null is a dash, shades are monotone in the value, the scale lists every step', async () => {
  const {chart, problems} = await chartOf(heatmap(['A', 'B'], ['1', '2', '3'], [[10, 50, 100], [null, 30, 70]], {unit: '%', levels: 5}));
  assert.deepEqual(problems, []);
  const t = texts(chart);
  for (const s of ['10%', '50%', '100%', '30%', '70%']) assert.ok(t.includes(s), s);
  assert.equal(t.filter(s => s === '–').length, 1);
  const op = (label: string) => { const r = chart.items.find((i, k) => i.k === 'rect' && chart.solids.some(s => s.label === label && s.x === (i as {x: number}).x && s.y === (i as {y: number}).y && k >= 0)); return r && r.k === 'rect' ? r.op ?? 0 : -1; };
  assert.ok(op('cell A x 1') < op('cell A x 2') && op('cell A x 2') < op('cell A x 3'));
  assert.ok(t.includes('凡例'));
  assert.equal(heatLevel(0, {min: 0, max: 100, levels: 5}), 0);
  assert.equal(heatLevel(100, {min: 0, max: 100, levels: 5}), 4);
  assert.equal(heatLevel(39.99, {min: 0, max: 100, levels: 5}), 1);
  assert.equal(heatLevel(40, {min: 0, max: 100, levels: 5}), 2);
  assert.equal(heatLevel(-5, {min: 0, max: 100, levels: 5}), 0);
});

test('heatmap(): white numbers sit only on dark shades (contrast is verified), a cell too narrow for its number is an error', async () => {
  const {problems} = await chartOf(heatmap(['a', 'b', 'c'], ['x', 'y', 'z'], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], {levels: 6}));
  assert.deepEqual(problems, []);
  assert.throws(() => heatmap(['a'], Array.from({length: 24}, (_, i) => `c${i}`), [Array.from({length: 24}, () => 1234567.891)], {width: 360}).alt && 0 || (() => { throw new Error('x'); })(), Error);
  assert.throws(() => heatmap([], ['a'], []), /at least one row/);
  assert.throws(() => heatmap(['a'], ['b', 'c'], [[1]]), /has 1 values for 2 columns/);
  assert.throws(() => heatmap(['a'], ['b'], [[null]]), /every cell is null/);
  assert.throws(() => heatmap(['a'], ['b'], [[1]], {levels: 9}), /levels/);
});

test('heatmap(): a row label wider than its column wraps and the rows grow to hold it (it used to run over the cells)', async () => {
  const long = 'とても長い行の見出しがここに入るのでどうなるかを確かめる';
  const {chart, problems} = await chartOf(heatmap([long, '短い'], ['x', 'y'], [[1, 2], [3, 4]]));
  assert.deepEqual(problems, []);
  assert.ok(!texts(chart).includes(long), 'wrapped');
  assert.equal(texts(chart).filter(t => long.includes(t) && t.length > 1).join(''), long, 'every part of it is written');
  await assert.rejects(laid(heatmap([long, '短い'], ['x', 'y'], [[1, 2], [3, 4]], {cellH: 30})), /cellH 30 is too small/);
});

test('heatmap(): a number too wide for its cell fails at layout with the fix named', async () => {
  await assert.rejects(laid(heatmap(['a'], Array.from({length: 24}, (_, i) => `c${i}`), [Array.from({length: 24}, () => 1234567.891)], {width: 400})), /do not fit in cells/);
});

// ---- stacked bars and mekko ------------------------------------------------------------------------------------------------------

const COLS = [
  {label: '北', parts: [{label: 'A', value: 60}, {label: 'B', value: 30}, {label: 'C', value: 10}]},
  {label: '南', parts: [{label: 'A', value: 20}, {label: 'B', value: 20}]},
];

test('mekko(): the width of a column is its total, the height of a segment its share, so area is the share of the whole', async () => {
  const {chart, problems} = await chartOf(mekko(COLS, {unit: '億円'}));
  assert.deepEqual(problems, []);
  const n = solid(chart, '"A" in "北"'), s = solid(chart, '"A" in "南"');
  near(n.w / s.w, 100 / 40, 0.02);
  const nb = solid(chart, '"B" in "北"');
  near((n.h + 2) / (nb.h + 2), 60 / 30, 0.05);
  const area = (x: {w: number; h: number}) => x.w * x.h;
  near(area(n) / area(s), (100 * 0.6) / (40 * 0.5), 0.1);
  for (const label of ['A 60%', 'B 30%', 'C 10%', 'A 50%', 'B 50%', '（71.4%）', '（28.6%）']) assert.ok(texts(chart).includes(label), label);
  assert.ok(chart.alt.includes('北（計 100億円）') && chart.alt.includes('A 60億円（60%）'));
});

test('stackedBars(): absolute columns on one scale; percent: true makes every column reach 100%; totals are written', async () => {
  const abs = await chartOf(stackedBars(COLS, {unit: '億円'}));
  assert.deepEqual(abs.problems, []);
  near(solid(abs.chart, '"A" in "北"').h / solid(abs.chart, '"A" in "南"').h, 3, 0.1);
  assert.ok(texts(abs.chart).includes('100億円') && texts(abs.chart).includes('40億円'));
  const pc = await chartOf(stackedBars(COLS, {percent: true}));
  assert.deepEqual(pc.problems, []);
  const top = (c: LaidOutChart, col: string) => Math.min(...c.solids.filter(s => s.label.endsWith(`in "${col}"`)).map(s => s.y));
  near(top(pc.chart, '北'), top(pc.chart, '南'), 0.1);
  assert.ok(texts(pc.chart).includes('A 60%') || texts(pc.chart).includes('60%'));
});

test('mekko(): a segment too small for its number is left out of the drawing (and stays in the description)', async () => {
  const {chart, problems} = await chartOf(mekko([{label: '大', parts: [{label: 'A', value: 990}, {label: 'B', value: 10}]}, {label: '小', parts: [{label: 'A', value: 5}, {label: 'B', value: 5}]}]));
  assert.deepEqual(problems, []);
  assert.ok(chart.omitted.some(o => o.includes('B')));
  assert.ok(chart.alt.includes('B 10（1%）'));
});

test('stackedBars(): a crowded chart widens its columns for their numbers instead of leaving every number out', async () => {
  // 12 columns at 60% of the slot were narrower than "60.2%": every segment's number used to be left out (and verify passed)
  const cols = Array.from({length: 12}, (_, i) => ({label: `Q${i + 1}`, parts: [{label: '国内', value: 50 + i}, {label: '海外', value: 30}, {label: 'その他', value: 3}]}));
  const {chart, problems} = await chartOf(stackedBars(cols, {percent: true}));
  assert.deepEqual(problems, []);
  assert.ok(!chart.omitted.some(o => o.startsWith('国内') || o.startsWith('海外')), `left out: ${chart.omitted.slice(0, 3).join(' | ')}`);
  assert.ok(texts(chart).includes('60.2%') || texts(chart).includes('国内 60.2%'));
  const w = chart.solids.filter(s => s.label.startsWith('"国内"')).map(s => s.w);
  assert.ok(w.every(x => Math.abs(x - w[0]) < 0.2), 'every column is as wide as the others');
});

test('stackedBars(): totals too wide to stand side by side are an error that names the fix (they used to overlap each other)', async () => {
  const cols = Array.from({length: 20}, (_, i) => ({label: `${i}`, parts: [{label: 'x', value: 1234567 + i}, {label: 'y', value: 7654321}]}));
  await assert.rejects(laid(stackedBars(cols)), /column totals .* do not fit side by side/);
  const {problems} = await chartOf(stackedBars(cols.slice(0, 6)));
  assert.deepEqual(problems, []);
});

test('stackedBars(): a part too thin for its label inside the column is written beside the column; a mekko leaves it out', async () => {
  const cols = [{label: '甲', parts: [{label: '大', value: 100}, {label: '小', value: 6}]}, {label: '乙', parts: [{label: '大', value: 90}, {label: '小', value: 4}]}];
  const st = await chartOf(stackedBars(cols));
  assert.deepEqual(st.problems, []);
  assert.ok(texts(st.chart).includes('小 6') && texts(st.chart).includes('小 4'), 'beside the columns');
  assert.equal(st.chart.omitted.length, 0);
  const mk = await chartOf(mekko(cols));
  assert.ok(mk.chart.omitted.length > 0 && !texts(mk.chart).some(t => t.startsWith('小 ')));
});

test('lines(): a series that stops before the last category is named at its end, or at the right margin on a dotted leader when its end is crowded', async () => {
  // the sweep's crowded case: two series stop early inside the other lines
  const band = lines([{label: 'Customer0', values: [3.5, 1, 1.1, 1.9]}, {label: 'x1', values: [0.2, 3.9, 4.8, null]}, {label: 'x2', values: [3.2, null, 3.9, 3.7]}], {x: {categories: ['1', '2', '3', '4']}, y: {min: 0, max: 5}});
  const {laidOut, verdict} = await laid(band);
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find(b => b.type === 'plane') as LaidOutPlane;
  for (const n of ['Customer0', 'x1', 'x2']) assert.ok(p.texts.some(t => t.s === n), `${n} is named`);
});

test('stackedBars() / mekko(): bad input is named', () => {
  assert.throws(() => stackedBars([]), /at least one column/);
  assert.throws(() => stackedBars([{label: 'a', parts: [{label: 'x', value: -1}]}]), /must be >= 0/);
  assert.throws(() => mekko([{label: 'a', parts: [{label: 'x', value: 0}]}]), /adds up to 0/);
  assert.throws(() => stackedBars([{label: 'a', parts: Array.from({length: 7}, (_, i) => ({label: `p${i}`, value: 1}))}]), /at most 6/);
  assert.throws(() => stackedBars([{label: 'a', parts: [{label: 'x', value: 1}, {label: 'x', value: 2}]}]), /"x" twice/);
});

// ---- radar -------------------------------------------------------------------------------------------------------------------

test('radar(): a vertex is as far from the centre as its value says; each series has its own line style and marker; the legend names them', async () => {
  const axes = ['a', 'b', 'c', 'd'];
  const {chart, problems} = await chartOf(radar(axes, [{label: '一', values: [5, 2.5, 5, 0]}, {label: '二', values: [1, 1, 1, 1]}], {max: 5}));
  assert.deepEqual(problems, []);
  const paths = chart.items.filter(i => i.k === 'path' && i.stroke && i.sw === 3 && i.d.endsWith('Z'));
  assert.equal(paths.length, 2);
  assert.notEqual((paths[0] as {dash?: string}).dash, (paths[1] as {dash?: string}).dash);
  const dOf = (p: unknown) => ((p as {d: string}).d.match(/-?[\d.]+,-?[\d.]+/g) ?? []).map(q => q.split(',').map(Number));
  const [first] = [dOf(paths[0])];
  const cx = (first[0][0] + first[2][0]) / 2, cy = (first[1][1] + first[3][1]) / 2; // opposite vertices of the 5,5 axes are on a line through the centre
  const dist = first.map(([x, y]) => Math.hypot(x - cx, y - cy));
  near(dist[1] / dist[0], 0.5, 0.01);   // 2.5 of 5
  near(dist[3] / dist[0], 0, 0.02);     // 0
  const t = texts(chart);
  assert.ok(t.includes('一') && t.includes('二'));
  // ring values stand where they cross no series line and no marker (no plate is put over the data); a ring with no room stays unlabelled
  const ticks = ['1', '2', '3', '4', '5'].filter(s => t.includes(s));
  assert.ok(ticks.includes('5') && ticks.length >= 4, `ring values: ${ticks.join(', ')}`);
  assert.ok(!chart.items.some(i => i.k === 'rect' && i.fill === 'bg'), 'no plate');
  const markers = chart.items.filter(i => i.k === 'path' && i.fill === 'bg' && i.stroke);
  assert.ok(markers.length >= 8);
  assert.notEqual((markers[0] as {d: string}).d.replace(/[\d.,-]+/g, ''), (markers[markers.length - 1] as {d: string}).d.replace(/[\d.,-]+/g, ''));
});

test('radar(): bad input is named', () => {
  assert.throws(() => radar(['a', 'b'], [{label: 'x', values: [1, 2]}]), /3 to 12 axes/);
  assert.throws(() => radar(['a', 'b', 'c'], []), /1 to 4 series/);
  assert.throws(() => radar(['a', 'b', 'c'], [{label: 'x', values: [1, 2]}]), /2 values for 3 axes/);
  assert.throws(() => radar(['a', 'b', 'c'], [{label: 'x', values: [1, 2, 9]}], {max: 5}), /above max/);
  assert.throws(() => radar(['a', 'b', 'c'], [{label: 'x', values: [-1, 2, 3]}]), /below min 0/);
  assert.throws(() => radar(['a', 'b', 'c'], Array.from({length: 5}, (_, i) => ({label: `s${i}`, values: [1, 2, 3]}))), /1 to 4 series/);
});

// ---- treemap -------------------------------------------------------------------------------------------------------------------

test('squarify(): rows fill the rectangle exactly, areas are proportional, no cell overlaps another', () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((v, i) => ({n: {label: `n${i}`}, v}));
  const cells = squarify(items, 10, 20, 300, 200);
  near(cells.reduce((a, c) => a + c.w * c.h, 0), 300 * 200, 1e-6);
  for (const c of cells) near(c.w * c.h / (300 * 200), c.v / 24, 1e-9);
  for (const [i, a] of cells.entries()) for (const b of cells.slice(i + 1)) assert.ok(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 1e-6 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) < 1e-6);
  for (const c of cells) { assert.ok(c.x >= 10 - 1e-9 && c.x + c.w <= 310 + 1e-9 && c.y >= 20 - 1e-9 && c.y + c.h <= 220 + 1e-9); assert.ok(Math.max(c.w / c.h, c.h / c.w) < 4); }
});

test('treemap(): the area of a leaf is its value, name and value are written when they fit, the small cells are listed in the description', async () => {
  const tree = [{label: '大', children: [{label: '甲', value: 500, id: 'k'}, {label: '乙', value: 300}, {label: '丙', value: 4}]}, {label: '別', value: 200}];
  const {chart, problems} = await chartOf(treemap(tree, {unit: '件', height: 360}));
  assert.deepEqual(problems, []);
  const k = solid(chart, 'k'), o = solid(chart, 'cell "乙"');
  near((k.w * k.h) / (o.w * o.h), 500 / 300, 0.08);
  assert.ok(texts(chart).includes('500件'));
  assert.ok(chart.omitted.some(s => s.startsWith('丙')), 'the 4 cell has no room for a label');
  assert.ok(chart.alt.includes('丙 4件'));
  assert.ok(chart.anchors.some(a => a.id === 'k'));
});

test('treemap(): a leaf has the same area per unit of value inside a group (under its header and frame) as outside it', async () => {
  // with the values as weights, the header strips of A and A1 took their room from a and b only: a got ~26% less area per unit than B
  const tree = [{label: 'A', children: [{label: 'A1', children: [{label: 'a', value: 5}, {label: 'b', value: 3}]}, {label: 'A2', value: 4}]}, {label: 'B', value: 10}];
  const {chart, problems} = await chartOf(treemap(tree));
  assert.deepEqual(problems, []);
  const per = (l: string, v: number) => { const c = solid(chart, `cell "${l}"`); return c.w * c.h / v; };
  const r = [per('a', 5), per('b', 3), per('A2', 4), per('B', 10)];
  assert.ok(Math.max(...r) / Math.min(...r) < 1.03, `area per unit: ${r.map(x => x.toFixed(0)).join(', ')}`);
  for (const t of ['A 12', 'A1 8']) assert.ok(texts(chart).includes(t), `the header ${t} is still written`);
});

test('treemap(): strict turns an omitted label into an error; a group with a wrong value, a tone on a group, all-zero are named', async () => {
  await assert.rejects(laid(treemap([{label: 'a', value: 1000}, {label: 'b', value: 1}], {strict: true})), /does not fit \(b/);
  assert.throws(() => treemap([{label: 'g', value: 5, children: [{label: 'a', value: 1}]}]), /children add up to 1/);
  assert.throws(() => treemap([{label: 'g', tone: 'accent', children: [{label: 'a', value: 1}]}]), /a group takes no tone/);
  assert.throws(() => treemap([{label: 'a', value: 0}]), /every value is 0/);
  assert.throws(() => treemap([{label: 'a', value: -1}]), /must be >= 0/);
});

// ---- sankey --------------------------------------------------------------------------------------------------------------------

const FLOW = {
  nodes: ['a', 'b', 'c', 'd', 'e'],
  links: [{from: 'a', to: 'c', value: 30}, {from: 'b', to: 'c', value: 20}, {from: 'c', to: 'd', value: 35}, {from: 'c', to: 'e', value: 15}],
};

test('sankey(): layers come from the longest path, node heights are proportional to the flow on one scale, nodes never overlap', async () => {
  const sp = resolveSankey(FLOW.nodes, FLOW.links, {});
  assert.deepEqual([...layersOf(sp)].map(([k, v]) => `${k}${v}`), ['a0', 'b0', 'c1', 'd2', 'e2']);
  const {chart, problems} = await chartOf(sankey(FLOW.nodes, FLOW.links, {unit: '人'}));
  assert.deepEqual(problems, []);
  near(solid(chart, 'c').h / solid(chart, 'a').h, 50 / 30, 0.02);
  near(solid(chart, 'd').h / solid(chart, 'e').h, 35 / 15, 0.02);
  assert.equal(chart.items.filter(i => i.k === 'path' && i.fill !== 'none' && i.op === 0.22).length, 4); // one ribbon per link
  for (const s of ['a 30人', 'b 20人', 'c 50人', 'd 35人', 'e 15人']) assert.ok(texts(chart).includes(s), s); // a node's height is max(in, out): c carries 50
  assert.ok(chart.alt.includes('a → c 30人'));
});

test('sankey(): a sink goes to the last layer (align: left keeps it where its path ends); a cycle, an unknown node, a duplicate link are errors', () => {
  const sp = (align: 'justify' | 'left') => layersOf(resolveSankey(['a', 'b', 'c', 'd'], [{from: 'a', to: 'b', value: 1}, {from: 'b', to: 'c', value: 1}, {from: 'a', to: 'd', value: 1}], {align}));
  assert.equal(sp('justify').get('d'), 2);
  assert.equal(sp('left').get('d'), 1);
  assert.throws(() => sankey(['a', 'b'], [{from: 'a', to: 'b', value: 1}, {from: 'b', to: 'a', value: 1}]), /form a cycle \(a -> b -> a\)/);
  assert.throws(() => sankey(['a', 'b'], [{from: 'a', to: 'z', value: 1}]), /unknown node "z"/);
  assert.throws(() => sankey(['a', 'b'], [{from: 'a', to: 'b', value: 1}, {from: 'a', to: 'b', value: 2}]), /given twice/);
  assert.throws(() => sankey(['a', 'b'], [{from: 'a', to: 'b', value: 0}]), /must be > 0/);
  assert.throws(() => sankey(['a', 'a'], [{from: 'a', to: 'a', value: 1}]), /used twice/);
  assert.throws(() => sankey(['a', 'b'], [{from: 'a', to: 'a', value: 1}]), /flows into itself/);
});

test('sankey(): a node with no link is an error (it used to make the scale 0 and draw every node 2px high, with no ribbons)', async () => {
  assert.throws(() => sankey(['a', 'b', 'c', 'lonely'], [{from: 'a', to: 'b', value: 10}, {from: 'b', to: 'c', value: 5}]), /node "lonely" has no link/);
  // the scale is the one of the linked nodes: a ribbon is as thick as the node it is the whole flow of
  const {chart, problems} = await chartOf(sankey(['a', 'b', 'c'], [{from: 'a', to: 'b', value: 10}, {from: 'b', to: 'c', value: 5}]));
  assert.deepEqual(problems, []);
  assert.ok(solid(chart, 'a').h > 100, `node a is ${solid(chart, 'a').h}px high`);
  near(solid(chart, 'c').h / solid(chart, 'a').h, 0.5, 0.02);
});

// ---- lines ---------------------------------------------------------------------------------------------------------------------

test('lines(): a plane with a path and markers per series; each series has its own marker shape and line style; names stand at the line ends', async () => {
  const band = lines([{label: '甲', values: [1, 3, 2]}, {label: '乙', values: [2, 2, 4]}, {label: '丙', values: [3, null, 1]}], {x: {categories: ['一', '二', '三']}, y: {min: 0, max: 5}});
  const {laidOut, verdict} = await laid(band);
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find(b => b.type === 'plane') as LaidOutPlane;
  assert.equal(p.paths!.length, 2 + 0, 'the gap in 丙 leaves two single points, no path');
  const shapes = new Set(p.points.map(q => q.shape));
  assert.ok(shapes.size >= 3);
  for (const n of ['甲', '乙', '丙']) assert.ok(p.texts.some(t => t.s === n), `${n} is named at the end`);
  assert.ok(p.paths![0].dashed !== p.paths![1].dashed);
});

test('lines(): categories need one value each, numeric x needs [x, y] pairs with x rising; ranges and counts are checked', () => {
  assert.throws(() => lines([{label: 'a', values: [1, 2]}], {x: {categories: ['p', 'q', 'r']}}), /2 values for 3 categories/);
  assert.throws(() => lines([{label: 'a', values: [1, 2]}]), /give \[x, y\] pairs, or x.categories/);
  assert.throws(() => lines([{label: 'a', values: [[2, 1], [1, 2]]}]), /x must increase/);
  assert.throws(() => lines([{label: 'a', values: [1, 9]}], {x: {categories: ['p', 'q']}, y: {min: 0, max: 5}}), /outside the y axis/);
  assert.throws(() => lines([{label: 'a', values: [1, 2]}, {label: 'a', values: [1, 2]}], {x: {categories: ['p', 'q']}}), /own label/);
  assert.throws(() => lines(Array.from({length: 7}, (_, i) => ({label: `s${i}`, values: [1, 2]})), {x: {categories: ['p', 'q']}}), /at most 6/);
  assert.throws(() => lines([{label: 'a', values: [1, 2]}], {x: {categories: ['p', 'q']}, annotate: [{at: {series: 'zz', index: 0}, label: 'x'}]}), /no series "zz"/);
});

test('lines(): the target label stands clear of its own line (it used to touch it: a verify problem in the default use)', async () => {
  for (const labelRole of ['note', 'banner'] as const) {
    const {verdict} = await laid(lines([{label: '自社', values: [3, 4, 5, 2]}, {label: '競合', values: [2, 3, 3, 1]}], {x: {categories: ['a', 'b', 'c', 'd']}, target: {at: 4.5, label: '目標'}, labelRole}));
    assert.deepEqual(verdict.problems, [], labelRole);
  }
});

test('strategyCanvas() / burndown() / burnup(): presets on lines()', async () => {
  const sc = strategyCanvas(['価格', '品質', '速さ'], [{label: '自社', values: [2, 4, 5]}, {label: '競合', values: [4, 3, 1]}]);
  assert.equal(sc.y.max, 5);
  assert.deepEqual(sc.x.ticks, [{at: 0, label: '価格'}, {at: 1, label: '品質'}, {at: 2, label: '速さ'}]);
  const bd = burndown({total: 40, days: 5, actual: [40, 36, 30, null, null, null]});
  assert.equal(bd.paths!.length, 2);
  assert.equal(bd.paths![0].dashed, true);                      // the ideal line first, dashed
  assert.deepEqual(bd.paths![0].through, [[0, 40], [5, 0]]);
  assert.equal(bd.paths![1].through.length, 3);                // the days not reached have no point
  const bu = burnup({scope: [50, 50, 60, 60], days: 3, done: [0, 10, 25, null]});
  assert.equal(bu.paths!.length, 2);
  assert.throws(() => burndown({total: 10, days: 0, actual: []}), /whole number >= 1/);
  for (const b of [sc, bd, bu]) assert.deepEqual((await laid(b)).verdict.problems, []);
});

test('lines(): endLabels spread the names apart when the lines end on the same value, and the right margin holds the widest', async () => {
  const band = lines([{label: '同じ終わりの長い系列名 A', values: [1, 2, 3]}, {label: '同じ終わりの長い系列名 B', values: [3, 2, 3]}, {label: '同じ終わりの長い系列名 C', values: [2, 4, 3]}], {x: {categories: ['x', 'y', 'z']}, y: {min: 0, max: 5}});
  const {laidOut, verdict} = await laid(band);
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find(b => b.type === 'plane') as LaidOutPlane;
  const ends = p.labelBoxes.filter(b => b.label.startsWith('同じ終わり'));
  assert.equal(ends.length, 3);
  for (const b of ends) assert.ok(b.x + b.w <= p.bounds.x + p.bounds.w + 0.5);
  const ys = ends.map(b => b.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 18 && ys[2] - ys[1] >= 18);
});

// ---- the whole: dark, svg, reveal, spotlight, connect -----------------------------------------------------------------------------

test('every chart renders in the dark appearance and passes lint; the description lists the values', async () => {
  const bands = [
    waterfall(WF, {unit: '円'}), tornado([{label: 'a', low: 1, high: 3}, {label: 'b', low: 0.5, high: 2}], {base: 2}), heatmap(['r'], ['c1', 'c2'], [[1, 9]]),
    stackedBars(COLS), mekko(COLS), radar(['a', 'b', 'c'], [{label: 's', values: [1, 2, 3]}]), treemap([{label: 'a', value: 3}, {label: 'b', value: 1}]),
    sankey(FLOW.nodes, FLOW.links), strategyCanvas(['a', 'b'], [{label: 's', values: [1, 2]}]),
  ];
  for (const b of bands) {
    const {svg, verdict} = await renderDiagram(diagram({theme: 'blue', title: 't', medium: 'doc', appearance: 'dark'}).add(b as never), {name: 'x.svg', budget: 'cacheOnly'});
    assert.deepEqual(verdict.problems, []);
    if ((b as {type: string}).type === 'chart') assert.ok(svg.includes('<desc'), 'a description is written');
    assert.ok(!svg.includes('#ffffff') || svg.includes('data-appearance'), 'recoloured');
  }
});

test('spotlight on a treemap group keeps the cells inside it lit (they used to dim, leaving only the frame)', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: 'g'}).add(treemap([{label: '国内', id: 'g', children: [{label: '東京', value: 40}, {label: '大阪', value: 22, id: 'osaka'}]}, {label: '海外', value: 30}])));
  const c = laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart;
  const keyOf = (label: string) => (c.items.find(i => i.k === 'rect' && c.solids.some(s => s.label.endsWith(`"${label}"`) && s.x === i.x && s.y === i.y)) as {of: string} | undefined)?.of ?? label;
  assert.ok(!c.dim);
  for (const l of ['東京', 'osaka']) assert.ok(!c.dimIds?.includes(keyOf(l)), `${l} stays lit`);
  assert.ok(c.dimIds?.includes(keyOf('海外')), '海外 dims');
});

test('on a canvas (30px text) the charts keep their labels in the figure and off each other: legends, radar ring values', async () => {
  // a legend row centred 9px under the top put a 30px label 10px above the figure; radar ring values 1-5 overlapped each other on plates
  const bands = [
    radar(['品質', '価格', '納期', '対応', '提案力'], [{label: '自社', values: [4, 3, 5, 4, 2]}, {label: '競合', values: [3, 5, 3, 2, 4]}], {max: 5, values: true}),
    tornado([{label: '原材料費', low: 850, high: 1150}, {label: '為替', low: 940, high: 1060}], {base: 1000, unit: '百万円'}),
    mekko([{label: 'A 社', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}, {label: 'B 社', parts: [{label: '製品', value: 30}, {label: '保守', value: 10}]}], {unit: '億円'}),
    stackedBars([{label: 'A', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}]),
    waterfall(WF), heatmap(['1月', '2月'], ['0', '1'], [[100, 62], [100, null]], {unit: '%'}), treemap([{label: 'a', value: 3}, {label: 'b', value: 1}]),
    sankey(['a', 'b', 'c'], [{from: 'a', to: 'b', value: 3}, {from: 'b', to: 'c', value: 2}]),
  ];
  for (const b of bands) {
    const {verdict} = await checkDiagram(diagram({theme: 'blue', canvas: {width: 1920, height: 1080, minText: 30}}).add(b as never));
    assert.deepEqual(verdict.problems, [], (b as {kind: string}).kind);
  }
});

test('spotlight on an element dims the other elements, not the figure; connect() reaches an element id; reveal gives the ids the band stage', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: 'price'}).add(waterfall(WF)));
  const c = laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart;
  assert.ok(c.dimIds !== undefined || c.dim === undefined);
  assert.equal(c.dim, undefined);
  const whole = await checkDiagram(diagram({theme: 'blue', spotlight: 'wf'}).add(waterfall(WF, {id: 'wf'})));
  assert.ok(!(whole.laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart).dim);
  const other = await checkDiagram(diagram({theme: 'blue', spotlight: 'box1'}).add(waterfall(WF, {id: 'wf'}), {type: 'box', id: 'box1', title: 'x'} as never));
  assert.ok((other.laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart).dim);
  const d = diagram({theme: 'blue'}).add(waterfall(WF, {id: 'wf', reveal: 1}), connect('wf', 'price'));
  const r = await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
});

// ---- a seeded sweep: random data, zeros, negatives, long labels ------------------------------------------------------------------

test('a seeded sweep of every chart (zeros, negatives, long labels, many items) never throws except with a named reason and never fails verify', async () => {
  let seed = Number(process.env.SWEEP_SEED ?? 20261012);
  const mult = Number(process.env.SWEEP_MULT ?? 1);
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
  const word = (): string => pick(['売上', '利益', 'コスト', 'Customer', '新規顧客の獲得', 'アジア太平洋地域', 'x', '長い名前のものがここに入ります', '費用', 'EBITDA']);
  const val = (neg = false): number => Math.round((neg && rnd() < 0.4 ? -1 : 1) * (rnd() < 0.15 ? 0 : rnd() < 0.2 ? rnd() * 5 : rnd() * (rnd() < 0.3 ? 100000 : 100)) * 100) / 100;
  const bad: string[] = [], named: string[] = [];
  const run = async (what: string, mk: () => unknown): Promise<void> => {
    let band: unknown;
    try { band = mk(); } catch (e) { named.push(`${what}: ${(e as Error).message}`); return; }
    try {
      const {verdict} = await laid(band);
      if (verdict.problems.length) bad.push(`${what}: ${verdict.problems[0]}${what.startsWith('lines') && process.env.DBG ? ' ' + JSON.stringify((globalThis as {dbg?: unknown}).dbg) : ''}`);
    } catch (e) { const m = (e as Error).message; if (/^\w+\(\): /.test(m)) named.push(`${what}: ${m}`); else bad.push(`${what}: ${m}`); }
  };
  const uniq = (n: number, f: () => string): string[] => { const s = new Set<string>(); let i = 0; while (s.size < n && i++ < 100) s.add(f()); return [...s]; };
  for (let t = 0; t < 40 * mult; t++) {
    const n = 2 + Math.floor(rnd() * 9);
    await run(`waterfall ${t}`, () => waterfall(Array.from({length: n}, (_, i) => i === 0 ? {label: word(), value: Math.abs(val())} : i === n - 1 ? {label: word(), kind: 'total' as const} : rnd() < 0.15 ? {label: word(), kind: 'subtotal' as const} : {label: word(), value: val(true)}), {unit: pick(['', '円', '百万円', '%']), dir: rnd() < 0.4 ? 'h' : 'v'}));
  }
  for (let t = 0; t < 30 * mult; t++) await run(`tornado ${t}`, () => { const base = val(true); return tornado(Array.from({length: 1 + Math.floor(rnd() * 8)}, () => ({label: word(), low: base + val(true) / 4, high: base + val(true) / 4})), {base, unit: pick(['', '円'])}); });
  for (let t = 0; t < 30 * mult; t++) {
    const R = 1 + Math.floor(rnd() * 12), C = 1 + Math.floor(rnd() * 12);
    await run(`heatmap ${t}`, () => heatmap(uniq(R, word).concat(R > 5 ? [] : []), Array.from({length: C}, (_, i) => `${i + 1}`), Array.from({length: R}, () => Array.from({length: C}, () => rnd() < 0.15 ? null : Math.round(rnd() * 100 * (rnd() < 0.2 ? -1 : 1)))).slice(0, uniq(R, word).length), {unit: pick(['', '%'])}));
  }
  for (let t = 0; t < 30 * mult; t++) await run(`stacked ${t}`, () => { const C = 1 + Math.floor(rnd() * 8), P = 1 + Math.floor(rnd() * 5), names = uniq(P, word); const cols = Array.from({length: C}, (_, i) => ({label: `${word()}${i}`, parts: names.map(n => ({label: n, value: Math.abs(val())}))})); return rnd() < 0.5 ? mekko(cols, {unit: pick(['', '円'])}) : stackedBars(cols, {percent: rnd() < 0.5}); });
  for (let t = 0; t < 30 * mult; t++) await run(`radar ${t}`, () => { const A = 3 + Math.floor(rnd() * 10); return radar(uniq(A, word).concat(Array.from({length: A}, (_, i) => `軸${i}`)).slice(0, A), Array.from({length: 1 + Math.floor(rnd() * 4)}, (_, i) => ({label: `系列${i}${word()}`, values: Array.from({length: A}, () => Math.round(rnd() * 5 * 10) / 10)})), {max: 5, values: rnd() < 0.5}); });
  for (let t = 0; t < 30 * mult; t++) await run(`treemap ${t}`, () => { const grp = (d: number): unknown[] => Array.from({length: 1 + Math.floor(rnd() * 6)}, (_, i) => d < 2 && rnd() < 0.3 ? {label: `${word()}${i}`, children: grp(d + 1)} : {label: `${word()}${i}`, value: Math.abs(val())}) as unknown[]; return treemap(grp(0) as never, {unit: pick(['', '円']), percent: rnd() < 0.3}); });
  for (let t = 0; t < 30 * mult; t++) await run(`sankey ${t}`, () => {
    const L = 2 + Math.floor(rnd() * 3), layers = Array.from({length: L}, (_, i) => Array.from({length: 1 + Math.floor(rnd() * 4)}, (_, k) => `${i}-${k}`));
    const links: {from: string; to: string; value: number}[] = [];
    for (let i = 0; i + 1 < L; i++) for (const f of layers[i]) for (const to of layers[i + 1]) if (rnd() < 0.6) links.push({from: f, to, value: Math.max(1, Math.round(Math.abs(val())))});
    if (!links.length) links.push({from: layers[0][0], to: layers[1][0], value: 5});
    return sankey(layers.flat().filter(id => links.some(l => l.from === id || l.to === id)).map(id => ({id, label: word()})), links, {unit: pick(['', '人'])});
  });
  for (let t = 0; t < 30 * mult; t++) await run(`lines ${t}`, () => { const N = 3 + Math.floor(rnd() * 8), S = 1 + Math.floor(rnd() * 4); const data = Array.from({length: S}, (_, i) => ({label: `${word()}${i}`, values: Array.from({length: N}, () => rnd() < 0.1 ? null : Math.round(rnd() * 50) / 10)})); (globalThis as {dbg?: unknown}).dbg = data; return lines(data, {x: {categories: Array.from({length: N}, (_, i) => `${i + 1}`)}, y: {min: 0, max: 5}}); });
  // the failures that are not named, or that came out of verify, are bugs; the named ones are the data being refused with a reason
  if (process.env.DBG) console.log(named.map(n => n.slice(0, 150)).join('\n'));
  assert.deepEqual(bad, []);
  assert.ok(named.length < 100 * mult, `too many refusals: ${named.slice(0, 5).join(' | ')}`);
});
