// ADR 0082 U1 + U2: a horizontal chevron wraps onto rows (`rows` / `perRow` / rows: 'auto').
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, checkDiagram, chevron, closeMeasurer, diagram, renderDiagram, tree} from '../lib/dsl.ts';
import {chevronBand} from '../lib/flow-chevron.ts';
import {layoutFlowShape} from '../lib/flow-shapes.ts';
import {ROLES} from '../lib/tokens.ts';
import type {ChevronOpts, FlowStep, LaidOutFlowShape} from '../lib/flow-shapes.ts';
import {must} from '../lib/must.ts';

test.after(() => closeMeasurer());

// a rough width (0.58 em per character): enough to check the geometry without measuring fonts
const roughWidth = (atom: string, size: number) => Array.from(atom).length * size * .58;
const figure = (steps: readonly FlowStep[], opts: ChevronOpts = {}, width = 892): LaidOutFlowShape => layoutFlowShape(chevronBand(steps, opts), 24, 24, width, roughWidth, ROLES, 'phrase');
const steps = (n: number, sub?: string, label = '手順'): FlowStep[] => Array.from({length: n}, (_, i) => ({id: `s${i}`, label: `${label}${String.fromCharCode(65 + i)}`, ...(sub ? {sub} : {})}));
const svgOf = async (...bands: unknown[]) => (await renderDiagram(diagram({theme: 'blue'}).add(...(bands as [never])), {name: 'rows.svg', budget: 'cacheOnly'})).svg;
const paths = (f: LaidOutFlowShape) => f.primitives.flatMap(p => p.k === 'path' ? [p] : []);
const polys = (f: LaidOutFlowShape) => f.primitives.flatMap(p => p.k === 'polygon' ? [p] : []);

test('rows: 2 puts 7 steps as 4 + 3, every step the same width, the last row left-aligned, one cellH', () => {
  const f = figure(steps(7), {rows: 2});
  const a = f.anchors;
  assert.equal(a.length, 7);
  assert.equal(new Set(a.map(x => x.w)).size, 1, 'one cellW');
  assert.equal(new Set(a.map(x => x.h)).size, 1, 'one cellH');
  const cellW = must(a[0]).w, cellH = must(a[0]).h;
  assert.equal(cellW, (892 - 4 * 3) / 4);
  assert.deepEqual(a.map(x => x.y), [24, 24, 24, 24, 24 + cellH + 40, 24 + cellH + 40, 24 + cellH + 40]);
  assert.deepEqual(a.slice(4).map(x => x.x), [24, 24 + cellW + 4, 24 + 2 * (cellW + 4)], 'the last row starts at column 0');
  assert.equal(f.h, 2 * cellH + 40);
});

test('rows / perRow arithmetic: 8 steps rows: 3 is 3 + 3 + 2; 5 steps rows: 4 is 3 rows of 2, 2, 1; perRow: 4 is 4 + 3', () => {
  const rowsOf = (f: LaidOutFlowShape) => [...new Set(f.anchors.map(x => x.y))].map(y => f.anchors.filter(x => x.y === y).length);
  assert.deepEqual(rowsOf(figure(steps(8), {rows: 3})), [3, 3, 2]);
  assert.deepEqual(rowsOf(figure(steps(5), {rows: 4})), [2, 2, 1]);
  assert.deepEqual(rowsOf(figure(steps(7), {perRow: 4})), [4, 3]);
  assert.deepEqual(rowsOf(figure(steps(3), {perRow: 1})), [1, 1, 1], 'perRow: 1 stacks horizontal chevrons');
  assert.deepEqual(rowsOf(figure(steps(3), {rows: 5})), [1, 1, 1], 'rows >= n gives n rows');
});

test('the continuation arrow: a 4-point elbow of integers from the last step of a row to the first of the next', () => {
  const f = figure(steps(7), {rows: 2});
  const [p, ...more] = paths(f);
  assert.equal(more.length, 0, 'one arrow for two rows');
  const a = f.anchors, last = must(a[3]), first = must(a[4]);
  const x1 = Math.round(last.x + last.w / 2), x2 = Math.round(first.x + first.w / 2);
  const yb = last.y + last.h, ym = yb + 20, yt = first.y;
  assert.equal(must(p).d, `M${x1},${Math.round(yb)} L${x1},${Math.round(ym)} L${x2},${Math.round(ym)} L${x2},${Math.round(yt)}`);
  assert.match(must(p).d, /^M-?\d+,-?\d+ L-?\d+,-?\d+ L-?\d+,-?\d+ L-?\d+,-?\d+$/, 'integers only');
  assert.deepEqual({tone: must(p).tone, arrow: must(p).arrow, thin: must(p).thin}, {tone: 'text', arrow: true, thin: true});
  assert.equal(f.primitives.at(-1), p, 'pushed after every polygon');
  assert.equal(f.primitives.findLastIndex(q => q.k === 'polygon'), f.primitives.length - 2);
});

test('three rows give two arrows; perRow: 1 gives straight 2-point lines', () => {
  assert.equal(paths(figure(steps(7), {perRow: 3})).length, 2);
  const f = figure(steps(3), {perRow: 1});
  assert.equal(paths(f).length, 2);
  for (const p of paths(f)) assert.match(p.d, /^M\d+,\d+ L\d+,\d+$/);
});

test('a notch is cut in the first step of every later row', () => {
  const f = figure(steps(7), {rows: 2});
  assert.deepEqual(polys(f).map(p => p.points.length), [5, 6, 6, 6, 6, 6, 6]);
});

test('byte identity (D8): no option = rows: 1 = perRow: n = perRow > n', async () => {
  const base = await svgOf(chevron(steps(5, '説明の文'), {current: 1}));
  assert.equal(await svgOf(chevron(steps(5, '説明の文'), {current: 1, rows: 1})), base);
  assert.equal(await svgOf(chevron(steps(5, '説明の文'), {current: 1, perRow: 5})), base);
  assert.equal(await svgOf(chevron(steps(5, '説明の文'), {current: 1, perRow: 9})), base);
  assert.doesNotMatch(base, /dsl-arrow/, 'a one-row chevron brings no arrow marker');
  const f1 = figure(steps(5, '説明の文')), f2 = figure(steps(5, '説明の文'), {rows: 1}), f3 = figure(steps(5, '説明の文'), {perRow: 5});
  assert.deepEqual(f2, f1);
  assert.deepEqual(f3, f1);
});

test('svgDefs: a wrapped chevron declares the arrow marker; a dimmed one takes dsl-arrow-dim', async () => {
  const svg = await svgOf(chevron(steps(7), {rows: 2}));
  assert.match(svg, /<marker id="dsl-arrow"/);
  assert.match(svg, /marker-end="url\(#dsl-arrow\)"/);
  const dim = (await renderDiagram(diagram({theme: 'blue', spotlight: 'lit'}).add(box({id: 'lit', title: '強調'}), chevron(steps(7), {rows: 2})), {name: 'dim.svg', budget: 'cacheOnly'})).svg;
  assert.match(dim, /marker-end="url\(#dsl-arrow-dim\)"/);
  assert.doesNotMatch(dim, /marker-end="url\(#dsl-arrow\)"/);
});

test('current / tone / focus act on a step in any row', () => {
  const f = figure(steps(7), {rows: 2, current: 5});
  assert.deepEqual(polys(f).map(p => p.tone), ['plain', 'plain', 'plain', 'plain', 'plain', 'accent', 'plain']);
  const g = figure([...steps(6), {label: '手順G', tone: 'solid'}], {rows: 2});
  assert.equal(must(polys(g)[6]).tone, 'solid');
  const h = chevronBand(steps(7), {rows: 2, focus: 5});
  assert.equal(h.steps.length, 7);
});

test('connect() reaches a step of the second row; its anchor is the arrow rectangle', async () => {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(chevron([{id: 's0', label: '手順A'}, {id: 's1', label: '手順B'}, {id: 's2', label: '手順C'}, {id: 's3', label: '手順D'}, {id: 's4', label: '手順E'}], {rows: 2}), box({id: 'memo', title: '補足'})).connect('s4:bottom', 'memo:top'));
  assert.equal(r.laidOut.connects.length, 1);
});

test('a tree node band with from pointing at a step of the upper row does not throw', async () => {
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(tree({label: 'top', id: 'top', w: 900, band: chevron(steps(7), {rows: 2}), children: [{label: '子', from: 's1', w: 300, band: chevron([{label: '手順X'}, {label: '手順Y'}])}]})));
  assert.ok(r.laidOut);
});

test('mistakes throw, in Japanese, with the way to fix them', () => {
  const s = steps(7);
  assert.throws(() => chevronBand(s, {rows: 2, perRow: 4}), /chevron\(\): rows と perRow は一緒に/);
  for (const rows of [0, 1.5, Number.NaN, -1, 'foo' as never]) assert.throws(() => chevronBand(s, {rows}), /chevron\(\): rows は 1 以上の整数か 'auto'/, String(rows));
  for (const perRow of [0, 1.5, Number.NaN, -2]) assert.throws(() => chevronBand(s, {perRow}), /chevron\(\): perRow は 1 以上の整数/, String(perRow));
  assert.throws(() => chevronBand(s, {rows: 2, direction: 'vertical'}), /縦の chevron は折り返さない/);
  assert.throws(() => chevronBand(s, {perRow: 3, direction: 'vertical'}), /縦の chevron は折り返さない/);
  assert.doesNotThrow(() => chevronBand(s, {direction: 'vertical'}));
});

test('loopBack with a chevron that may wrap throws; with one that cannot, it does not', () => {
  const s = steps(7), lb = {from: 4, to: 2};
  assert.throws(() => chevronBand(s, {loopBack: lb, rows: 2}), /loopBack を外すか、rows \/ perRow を外す/);
  assert.throws(() => chevronBand(s, {loopBack: lb, rows: 'auto'}), /loopBack を外すか/);
  assert.throws(() => chevronBand(s, {loopBack: lb, perRow: 6}), /loopBack を外すか/);
  assert.throws(() => chevronBand(steps(2), {loopBack: {from: 2, to: 1}, rows: 2}), /loopBack を外すか/, 'also when only two steps stand');
  assert.doesNotThrow(() => chevronBand(s, {loopBack: lb}));
  assert.doesNotThrow(() => chevronBand(s, {loopBack: lb, rows: 1}));
  assert.doesNotThrow(() => chevronBand(s, {loopBack: lb, perRow: 7}));
});

// ---- U2: rows: 'auto' ----
const rowCount = (f: LaidOutFlowShape) => new Set(f.anchors.map(x => x.y)).size;

test("'auto': a narrow width wraps 7 steps with an 8-character sub onto 2 rows (4 + 3); a wide one stays on one row, byte-identical to no option", async () => {
  const sub = '八文字の説明です。';
  assert.equal(rowCount(figure(steps(7, sub), {rows: 'auto'}, 500)), 2);
  assert.equal(figure(steps(7, sub), {rows: 'auto'}, 500).anchors.filter(a => a.y === 24).length, 4);
  assert.equal(rowCount(figure(steps(7, sub), {rows: 'auto'}, 892)), 1);
  assert.deepEqual(figure(steps(7, sub), {rows: 'auto'}, 892), figure(steps(7, sub)));
  const wide = await svgOf(chevron(steps(7, '説明の文'), {rows: 'auto'}));
  assert.equal(wide, await svgOf(chevron(steps(7, '説明の文'))));
});

test("'auto': a sub that wraps only at one row asks for another row (stage 1); a label that wraps at one row too", () => {
  assert.equal(rowCount(figure(steps(7, '十二文字の説明の文です'), {rows: 'auto'}, 600)), 2);
  assert.equal(rowCount(figure(steps(7, undefined, '長めの手順名'), {rows: 'auto'}, 500)), 2);
});

test("'auto': stage 2 accepts a sub with one extra line; stage 3 falls back to the fewest lines, never throws", () => {
  const f2 = figure(steps(7, '十六文字の長めの説明の文章です。'), {rows: 'auto'}, 500);
  assert.equal(rowCount(f2), 2);
  const f3 = figure(steps(7, '四十文字ほどもある、たいへん長い説明の文章がここに入ります。折り返しが何行にもなる。'), {rows: 'auto'}, 500);
  assert.equal(rowCount(f3), 2, 'two rows give the fewest lines (maxR is 2 for 7 steps)');
});

test("'auto': at most 8 steps stand in a row, and 5 steps or fewer never wrap", () => {
  assert.ok(rowCount(figure(steps(9), {rows: 'auto'}, 4000)) >= 2, '9 steps never make one row (minR = 2)');
  assert.equal(rowCount(figure(steps(5, '十二文字の説明の文です'), {rows: 'auto'}, 300)), 1, 'maxR is 1 for 5 steps');
  assert.equal(rowCount(figure(steps(12), {rows: 'auto'}, 4000)), 2);
});

test("'auto': an explicit newline in a label is not an extra line", () => {
  const f = figure([{id: 'a', label: '手順\nA'}, {id: 'b', label: '手順B'}, {id: 'c', label: '手順C'}], {rows: 'auto'}, 892);
  assert.equal(rowCount(f), 1);
});

test("'auto' with loopBack throws", () => {
  assert.throws(() => chevronBand(steps(4), {rows: 'auto', loopBack: {from: 3, to: 1}}), /loopBack/);
});
