import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {forestBand} from '../lib/dsl/forest.ts';
import {checkDiagram, closeMeasurer, diagram, forest} from '../lib/dsl.ts';
import {forestAlt, layoutForest, forestScale, forestTexts, forestSquare, forestValueText, resolveForest} from '../lib/charts-forest.ts';
import type {ForestRow} from '../lib/charts-forest.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());

const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue', title: '試験'}).add(...(bands as never[])));
const chartOf = async (band: unknown) => {
  const {laidOut, verdict} = await laid(band);
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, verdict};
};
const texts = (c: LaidOutChart): string[] => c.items.flatMap(i => i.k === 'text' ? [i.s] : []);
const study = (label: string, estimate: number, low: number, high: number, extra: object = {}): ForestRow => ({label, estimate, low, high, ...extra});
const spec = (rows: ForestRow[], opts: object = {}) => resolveForest(rows, opts);

// (i) the log axis: the 16x boundary
test('forest(): the log axis uses ref x 2^k up to 16x and 1-2-5 per decade beyond', () => {
  assert.deepEqual(forestScale(spec([study('a', 1, 0.25, 4)])).ticks, [0.25, 0.5, 1, 2, 4]);
  assert.deepEqual(forestScale(spec([study('a', 1, 0.5, 8)])).ticks, [0.5, 1, 2, 4, 8]);
  assert.deepEqual(forestScale(spec([study('a', 0.5, 0.0625, 1)])).ticks, [0.0625, 0.125, 0.25, 0.5, 1, 2], '16x exactly: still powers of two (and one tick past the reference line)');
  assert.deepEqual(forestScale(spec([study('a', 0.5, 0.06, 1)])).ticks, [0.05, 0.1, 0.2, 0.5, 1, 2], 'just over 16x: 1-2-5');
  assert.deepEqual(forestScale(spec([study('a', 2, 0.22, 5.9)])).ticks, [0.2, 0.5, 1, 2, 5, 10]);
  assert.deepEqual(forestScale(spec([study('a', 1, 1, 1)])).ticks, [0.5, 1, 2], 'a single point still has an axis');
  assert.deepEqual(forestScale(spec([study('a', 1.1, 1.02, 1.3)])).ticks, [0.5, 1, 2], 'every interval above ref: one tick below it');
  assert.deepEqual(forestScale(spec([study('a', 0.8, 0.6, 0.9)])).ticks, [0.5, 1, 2], 'every interval below ref: one tick above it');
  assert.deepEqual(forestScale(spec([study('a', 1.1, 1.02, 1.3)], {domain: [1, 2]})).ticks, [1, 2], 'a written domain is the axis');
  const lin = forestScale(spec([study('a', 2, 1, 3)], {scale: 'linear', ref: 0})).ticks;
  assert.ok(lin[0]! < 0 && lin.includes(0), 'linear: one step past ref');
  const sc = forestScale(spec([study('a', 1, 0.5, 2)]));
  assert.ok(Math.abs(sc.pos(1) - 0.5) < 1e-9, 'the reference line of a symmetric ratio is in the middle');
});

// (ii) errors
test('forest(): errors say what is wrong and how to fix it', () => {
  assert.throws(() => forest([study('A', 1.5, 1.6, 2)]), /"A": low 1.6 <= estimate 1.5 <= high 2 does not hold \(swap low and high, or fix the estimate\)/);
  assert.throws(() => forest([study('A', 3, 1, 2)]), /does not hold/);
  assert.throws(() => forest([study('A', 0.5, 0, 2)]), /low 0 is 0 or less; a log scale needs values above 0 \(for differences write scale: 'linear', ref: 0\)/);
  assert.doesNotThrow(() => forest([study('A', -1, -2, 0.5)], {scale: 'linear', ref: 0}));
  assert.throws(() => forest([]), /at least one row/);
  assert.throws(() => forest(Array.from({length: 41}, (_, k) => study(`r${k}`, 1, 0.5, 2))), /41 rows are too many/);
  assert.throws(() => forest([{heading: 'H'}]), /at least one row with an estimate/);
  assert.throws(() => forest([{heading: 'H', estimate: 1} as never, study('A', 1, 0.5, 2)]), /heading row: it holds only "heading" \(remove "estimate"/);
  assert.throws(() => forest([{heading: 'H', label: 'x'} as never, study('A', 1, 0.5, 2)]), /heading row/);
  assert.throws(() => forest([study('A', 1, 0.5, 2, {summary: true, weight: 3})]), /summary row: it has no weight/);
  assert.throws(() => forest([study('A', 1, 0.5, 2, {weight: 0})]), /weight must be above 0/);
  assert.throws(() => forest([study('A', NaN, 0.5, 2)]), /estimate must be a finite number/);
  assert.throws(() => forest([study('A', 1, 0.5, 2, {id: 'x'}), study('B', 1, 0.5, 2, {id: 'x'})]), /each id must be unique/);
  assert.throws(() => forest([study('A', 1, 0.5, 2)], {decimals: 4}), /decimals must be a whole number from 0 to 3/);
  assert.throws(() => forest([study('A', 1, 0.5, 2)], {scale: 'sqrt' as never}), /scale must be/);
  assert.throws(() => forest([study('A', 1, 0.5, 2)], {ref: 0}), /ref 0 is 0 or less/);
  assert.throws(() => forest([study('A', 1, 0.5, 2)], {values: false, valueHeader: 'OR'}), /valueHeader .* values is false/);
  assert.throws(() => forest([study('A', 1, 1e-7, 2)]), /below 0.000001/);
  assert.throws(() => forest([study('A', 1, 0.5, 2)], {domain: [0, 4]}), /domain \[0, 4\] has a value of 0 or less/);
});

// (iii) the weight squares
test('forest(): the squares grow with the weight (area ~ weight, 8 to 18px), 10px without one', async () => {
  assert.equal(forestSquare(100, 100), 18);
  assert.ok(Math.abs(forestSquare(25, 100) - 13) < 1e-9);
  assert.equal(forestSquare(undefined, 100), 10);
  const {chart, verdict} = await chartOf(forest([study('小', 1.2, 0.9, 1.6, {weight: 25}), study('大', 1.3, 1, 1.7, {weight: 100}), study('中', 1.1, 0.8, 1.5, {weight: 64})]));
  assert.deepEqual(verdict.problems, []);
  const side = (l: string) => chart.solids.find(s => s.label === l)!.w;
  assert.ok(side('小') < side('中') && side('中') < side('大'));
  assert.ok(Math.abs(side('大') - 18) < 0.2 && Math.abs(side('小') - 13) < 0.2);
  assert.ok(chart.solids.every(s => s.w === s.h), 'squares');
});

// (iv) the summary dotted line
test('forest(): one summary row draws a dotted line through all rows; two do not', async () => {
  const dotted = (c: LaidOutChart) => c.items.filter(i => i.k === 'path' && i.dash === '2 3');
  const rows = [study('A', 1.5, 1.2, 1.9), study('B', 1.3, 1, 1.7)];
  const one = await chartOf(forest([...rows, study('全体', 1.4, 1.2, 1.6, {summary: true})]));
  assert.equal(dotted(one.chart).length, 1);
  assert.deepEqual(one.verdict.problems, []);
  const two = await chartOf(forest([...rows, study('小計 1', 1.4, 1.2, 1.6, {summary: true}), study('小計 2', 1.2, 1, 1.4, {summary: true})]));
  assert.equal(dotted(two.chart).length, 0);
  assert.equal((await chartOf(forest(rows))).chart.items.filter(i => i.k === 'path' && i.dash === '2 3').length, 0);
});

// (v) the numbers column, negatives
test('forest(): the number column is fixed in form; a negative number changes the separator and the sign', async () => {
  assert.equal(forestValueText({decimals: 2}, {estimate: 1.5432, low: 1.221, high: 1.9549}), '1.54 (1.22–1.95)');
  assert.equal(forestValueText({decimals: 1}, {estimate: -4.2, low: -7.9, high: -0.5}), '−4.2 (−7.9, −0.5)');
  assert.equal(forestValueText({decimals: 1}, {estimate: 0.3, low: -0.5, high: 1.2}), '0.3 (−0.5, 1.2)');
  assert.equal(forestValueText({decimals: 1}, {estimate: 0, low: -0.04, high: 1.2}), '0.0 (0.0–1.2)', 'a rounded zero has no sign');
  assert.equal(forestValueText({decimals: 0}, {estimate: 12, low: 8, high: 17}), '12 (8–17)');
  assert.equal(forestValueText({decimals: 1, comma: true}, {estimate: 12.3, low: 3.5, high: 21}), '12.3 (3.5, 21.0)', 'once any row is negative the whole column uses the comma');
  const {chart, verdict} = await chartOf(forest([study('差', -4.2, -7.9, -0.5), study('差 2', 1, -1, 3)], {scale: 'linear', ref: 0, decimals: 1}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(texts(chart).includes('−4.2 (−7.9, −0.5)'));
  assert.ok(texts(chart).includes('1.0 (−1.0, 3.0)') && texts(chart).includes('−5') || texts(chart).includes('−4'), 'ticks use the same minus sign');
  assert.ok(!texts(chart).some(t => /^-\d/.test(t)));
  const mixed = await chartOf(forest([study('負', -4.2, -7.9, -0.5), study('正', 12.3, 3.5, 21)], {scale: 'linear', ref: 0, decimals: 1}));
  assert.ok(texts(mixed.chart).includes('12.3 (3.5, 21.0)'));
  assert.ok(chart.alt.includes('−4.2 (−7.9, −0.5)'));
  const off = await chartOf(forest([study('A', 1.5, 1.2, 1.9)], {values: false}));
  assert.ok(!texts(off.chart).some(t => t.includes('(')));
});

// (vi) domain, arrowheads, info
const path = (c: LaidOutChart, pick: (i: {d: string; stroke?: string; fill?: string; sw?: number; dash?: string}) => boolean) => c.items.flatMap(i => i.k === 'path' && pick(i as never) ? [(i as {d: string}).d] : []);
const nums = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
test('forest({domain}): an interval past the axis is cut at the plot end with an arrowhead and an info; an estimate or ref past it is an error', async () => {
  const rows = [study('A', 1.5, 0.9, 12), study('L', 1.2, 0.3, 1.6), study('B', 1.3, 1, 1.7)];
  const {chart, verdict} = await chartOf(forest(rows, {domain: [0.5, 4]}));
  assert.deepEqual(verdict.problems, []);
  const info = verdict.findings.filter(f => f.rule === 'forest-clipped');
  assert.equal(info.length, 1);
  assert.equal(info[0]!.severity, 'info');
  assert.match(info[0]!.message, /「A」/);
  assert.match(info[0]!.message, /「L」/);
  assert.doesNotMatch(info[0]!.message, /「B」/);
  const [axis] = path(chart, i => i.stroke === 'muted').map(nums);
  const plotL = axis![0]!, plotR = axis![2]!;
  const lines = path(chart, i => i.stroke === 'text' && i.sw === 1.5 && i.fill === 'none' && !i.dash).map(nums);
  assert.equal(lines.length, 3);
  assert.deepEqual([lines[0]![0]! > plotL, lines[0]![2]!], [true, plotR], 'A: runs to the right end of the plot, not past it');
  assert.deepEqual([lines[1]![0]!, lines[1]![2]! < plotR], [plotL, true], 'L: starts at the left end of the plot');
  assert.ok(lines[2]![0]! > plotL && lines[2]![2]! < plotR, 'B is not cut');
  assert.equal(path(chart, i => i.fill === 'text').length, 2, 'one arrowhead on the right of A and one on the left of L');
  const free = await chartOf(forest(rows, {domain: [0.25, 16]}));
  assert.equal(free.verdict.findings.filter(f => f.rule === 'forest-clipped').length, 0);
  assert.equal(path(free.chart, i => i.fill === 'text').length, 0);
  assert.throws(() => forest([study('A', 9, 5, 12)], {domain: [0.5, 4]}), /"A": estimate 9 is outside the axis/);
  assert.throws(() => forest([study('A', 3, 2.5, 3.5)], {domain: [2, 4], ref: 1}), /ref 1 is outside the axis/);
});

test('forest({domain}): a summary row past the axis is a diamond cut flat at the plot end, and the info names it', async () => {
  const diamond = (c: LaidOutChart) => path(c, i => i.fill === 'accent' && /^M[\d. ]+ L/.test(i.d) && i.d.includes('Z')).map(nums).find(p => p.length >= 8)!;
  const {chart, verdict} = await chartOf(forest([study('A', 1.2, 0.9, 1.6), study('S', 1.5, 0.3, 3.5, {summary: true})], {domain: [0.5, 4]}));
  assert.deepEqual(verdict.problems, []);
  const [axis] = path(chart, i => i.stroke === 'muted').map(nums);
  const pts = diamond(chart), xy = (k: number) => [pts[2 * k]!, pts[2 * k + 1]!];
  assert.equal(pts.length, 10, 'five corners: a flat left edge');
  assert.equal(xy(0)[0], axis![0]!, 'the flat edge is at the left end of the plot');
  assert.equal(xy(4)[0], axis![0]!);
  assert.ok(xy(4)[1]! > xy(0)[1]!, 'the edge has height (the diamond is not a point there)');
  assert.ok(xy(1)[0]! > xy(0)[0]! && xy(1)[1]! < xy(0)[1]!, 'the top corner is at the estimate, higher than the cut');
  assert.ok(xy(2)[0]! < axis![2]!, 'the right end (3.5) is a point inside the axis');
  const info = verdict.findings.find(f => f.rule === 'forest-clipped')!;
  assert.match(info.message, /「S」\(ひし形を端で平らに切る\)/);
  assert.doesNotMatch(info.message, /「A」/);
  const both = diamond((await chartOf(forest([study('S', 1.5, 0.3, 9, {summary: true})], {domain: [0.5, 4]}))).chart);
  assert.equal(both.length, 12, 'cut on both sides: six corners');
});

// (vii) a 10-row figure passes the strict check
test('forest(): a 10-row figure (headings, summary, log axis, numbers, note) has no problem or warning', async () => {
  const rows: ForestRow[] = [{heading: '東の地域'}];
  for (let k = 0; k < 4; k++) rows.push(study(`拠点 ${'ABCD'[k]}`, 1.2 + k * 0.1, 0.9 + k * 0.05, 1.6 + k * 0.2, {weight: 80 + 20 * k, id: `e${k}`}));
  rows.push({heading: '西の地域'});
  for (let k = 0; k < 4; k++) rows.push(study(`拠点 ${'EFGH'[k]}`, 1.1 + k * 0.05, 0.8, 1.5 + k * 0.1, {weight: 60 + 10 * k}));
  rows.push(study('全体(統合)', 1.3, 1.12, 1.5, {summary: true, id: 'all'}));
  const band = forest(rows, {valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['対照が良い', '新方式が良い']});
  const {chart, verdict} = await chartOf(band);
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.findings.filter(f => f.severity === 'warn'), []);
  for (const t of ['OR (95% CI)', 'オッズ比(対数目盛)', '← 対照が良い', '新方式が良い →', '東の地域', '全体(統合)']) assert.ok(texts(chart).includes(t), t);
  assert.ok(chart.anchors.some(a => a.id === 'all') && chart.anchors.some(a => a.id === 'e2'));
  const {verdict: v2} = await checkDiagram(diagram({theme: 'blue', spotlight: 'e1'}).add(band));
  assert.deepEqual(v2.problems, []);
});

test('forest(): a long label wraps and makes its row taller; a long note that does not fit is an error', async () => {
  const L = 'とても長い名前の会場でここに入り切らないほど説明が付いているもの';
  const {chart, verdict} = await chartOf(forest([study(L, 1.5, 1.2, 1.9), study('B', 1.3, 1, 1.7)]));
  assert.deepEqual(verdict.problems, []);
  assert.ok(texts(chart).filter(t => L.includes(t)).length > 1, 'wrapped');
  await assert.rejects(laid(forest([study('A', 1.5, 1.2, 1.9)], {favours: [L.repeat(3), 'b']})), /wider than the room left of the reference line/);
  await assert.rejects(laid(forest([study('A', 1.5, 1.2, 1.9)], {height: 40})), /height 40 is too small/);
});

test('forest(): weights on some rows only give an info', async () => {
  const {verdict} = await chartOf(forest([study('A', 1.5, 1.2, 1.9, {weight: 10}), study('B', 1.3, 1, 1.7)]));
  assert.deepEqual(verdict.findings.filter(f => f.rule === 'forest-weight-partial').map(f => f.severity), ['info']);
});

test('forestBand(): the band holds the resolved spec, the alt text and the ids of the rows; forestTexts lists what is measured', () => {
  const rows: ForestRow[] = [{heading: '見出し'}, study('A', 1.5, 1.2, 1.9, {id: 'a'}), study('全体', 1.3, 1.1, 1.5, {summary: true})];
  const band = forestBand(rows, {valueHeader: 'OR', axisLabel: '軸', favours: ['左', '右']});
  assert.equal(band.kind, 'forest');
  assert.deepEqual(band.ids, ['a']);
  assert.equal(band.alt, forestAlt(band.spec as never));
  assert.equal(band.alt, 'フォレストプロット（基準 1）: 【見出し】、A 1.50 (1.20–1.90)、全体 1.30 (1.10–1.50)');
  const t = forestTexts(band.spec as never);
  for (const s of ['見出し', 'A', '1.50 (1.20–1.90)', 'OR', '軸', '← 左', '右 →', '1', '2']) assert.ok(t.some(([x]) => x === s), s);
  assert.deepEqual(t.find(([x]) => x === '全体'), ['全体', 700]);
});

test('layoutForest(): the placement itself, at a given width: rows in order, the reference line at the ref, the height from the rows', () => {
  const widthOf = (a: string, size: number) => [...a].length * size * 0.6;
  const geom = {x: 0, y: 0, w: 900, size: 14, widthOf, wrap: 'phrase' as const};
  const s = spec([{heading: 'H'}, study('A', 1.5, 1.2, 1.9, {id: 'a'}), study('B', 0.8, 0.5, 1.1)], {favours: ['左', '右']});
  const part = layoutForest(s, geom);
  assert.deepEqual(part.solids.map(x => x.label), ['A', 'B']);
  const [a, b] = part.solids;
  assert.ok(a!.y < b!.y && a!.x > b!.x, 'A is below the heading and right of B (a larger estimate)');
  assert.equal(part.h, Math.max(160, 6 + 3 * 26 + 6 + (14 + 14) + (14 + 10) + 4));
  assert.equal(part.anchors.length, 1);
  assert.throws(() => layoutForest(s, {...geom, w: 200}), /too narrow/);
  assert.throws(() => layoutForest(s, {...geom, height: 20}), /too small/);
});

test('forest(): findings of a forest inside a row are reported; the right-hand favours must fit; headings are 12px left of the rows', async () => {
  const {row} = await import('../lib/dsl.ts');
  const clipped = forest([study('A', 1.5, 0.9, 12)], {domain: [0.5, 4]});
  const d = await laid(row([clipped]));
  assert.equal(d.verdict.findings.filter(f => f.rule === 'forest-clipped').length, 1);
  const L = '右の注がとても長くてここに入らない言葉';
  await assert.rejects(laid(forest([study('A', 0.9, 0.7, 1.1)], {favours: ['左', L.repeat(3)]})), /right of the reference line/);
  const {chart} = await chartOf(forest([{heading: '見出し'}, study('行', 1.5, 1.2, 1.9)]));
  const x = (t: string) => (chart.items.find(i => i.k === 'text' && i.s === t) as {x: number}).x;
  assert.equal(x('行') - x('見出し'), 12);
});

test('forest(): when every interval is on one side of ref the notes still fit (the axis goes one tick past ref)', async () => {
  const {verdict, chart} = await chartOf(forest([study('甲', 1.1, 1.02, 1.3), study('乙', 1.2, 1.05, 1.4), study('全体', 1.15, 1.06, 1.25, {summary: true})], {favours: ['対照が良い', '新方式が良い'], valueHeader: 'OR'}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(texts(chart).includes('← 対照が良い'));
  const low = await chartOf(forest([study('甲', 0.8, 0.6, 0.9)], {favours: ['対照が良い', '新方式が良い'], values: false}));
  assert.deepEqual(low.verdict.problems, []);
});
