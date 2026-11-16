import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, compare, diagram} from '../lib/dsl.ts';
import {compareAlt, compareTexts, layoutCompare, resolveCompare} from '../lib/charts-compare.ts';
import {compareBand} from '../lib/charts-dsl.ts';
import {layoutRatingTable} from '../lib/charts-rating-table.ts';
import type {ChartGeom} from '../lib/charts-base.ts';
import type {LaidOutChart} from '../lib/charts.ts';

test.after(() => closeMeasurer());

const chartOf = async (band: unknown, width?: number): Promise<{chart: LaidOutChart; problems: string[]}> => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', ...(width ? {width} : {})}).add(band as never));
  return {chart: laidOut.laidOut.find(b => b.type === 'chart') as LaidOutChart, problems: verdict.problems};
};
const textOf = (c: LaidOutChart, s: string) => c.items.find((i): i is Extract<typeof i, {k: 'text'}> => i.k === 'text' && i.s === s)!;
const dashes = (c: LaidOutChart) => c.items.flatMap(i => i.k === 'path' && i.dash ? [i.d.match(/^M([\d.]+),([\d.]+) L([\d.]+),([\d.]+)$/)!.slice(1).map(Number) as [number, number, number, number]] : []);

test('compare(): a dashed line splits each cell, the mark centred on its left and the note on its right', async () => {
  const {chart, problems} = await chartOf(compare(['コスト', '拡張性'], ['案A', '案B'], [[['○', '既存設備を流用できる'], ['△', '追加ライセンスが必要になるので少し費用がかかります']], [['×', '不可'], ['best', '自由に拡張できる']]], {corner: '比較軸'}));
  assert.deepEqual(problems, []);
  const ds = dashes(chart);
  assert.equal(ds.length, 4, 'one dashed line per cell');
  for (const [x1, , x2] of ds) assert.equal(x1, x2, 'the line is vertical');
  const [[lineX, top, , bottom]] = ds as [[number, number, number, number]];
  const left = lineX - 36; // the mark column is 36px wide at the note size
  const mark = textOf(chart, '○'), note = textOf(chart, '既存設備を流用できる');
  assert.equal(mark.anchor, 'middle');
  assert.ok(Math.abs(mark.x - (left + lineX) / 2) <= 0.5, 'the mark is centred between the column edge and the dashed line');
  assert.ok(Math.abs(mark.y - mark.size * 0.36 - (top + bottom) / 2) <= 1, 'the mark is centred on the height of the line');
  assert.ok(note.anchor === 'start' && note.x > lineX, 'the note is right of the line');
  assert.ok(textOf(chart, '比較軸') && textOf(chart, '◎').bold && textOf(chart, '×').fill === 'danger');
});

test('compare(): a long note wraps and makes its row taller, and the mark stays in the middle of the row', async () => {
  const {chart, problems} = await chartOf(compare(['a', 'b'], ['X', 'Y', 'Z'], [[['○', 'とても長い説明文がここに入っていて、列の幅には一行で収まらないので折り返します'], null, ['△', '短い']], [['×', '短い'], ['○', '短い'], null]]), 800);
  assert.deepEqual(problems, []);
  const ds = dashes(chart), [, top, , bottom] = ds[0]!, [, top2, , bottom2] = ds[1]!;
  assert.equal(top, top2);
  assert.ok(bottom === bottom2 && bottom - top > 2 * textOf(chart, '○').size, 'the whole row grows');
  const m = textOf(chart, '△');
  assert.ok(Math.abs(m.y - m.size * 0.36 - (top + bottom) / 2) <= 1);
  assert.equal(chart.items.filter(i => i.k === 'text' && i.s === '—').length, 2, 'a null cell is a dash');
  assert.equal(ds.length, 4, 'and has no dashed line');
  for (const b of chart.boxes) assert.ok(b.x + b.w <= chart.x + chart.w + 0.5, `${b.label} stays inside`);
  for (const [x] of ds) for (const b of chart.boxes) assert.ok(b.x + b.w <= x || b.x >= x || b.y + b.h <= ds[0]![1], `${b.label} does not cross a dashed line`);
});

test('compare(): the description lists every rating and its reason; marks may be written by name', () => {
  const s = resolveCompare(['a'], ['X', 'Y'], [[['ok', '良い'], null]]);
  assert.equal(compareAlt(s), '比較表: a: X ○ 良い、Y 未評価');
  assert.ok(compareTexts(s).some(([t]) => t === '良い'));
  assert.equal(compareBand(['a'], ['X'], [[['○', '良い']]], {alt: '説明'}).alt, '説明');
});

test('compare(): ragged tables, bad marks and tables that cannot fit are refused with a reason', async () => {
  assert.throws(() => compare(['a', 'b'], ['x'], [[['○', 'n']]]), /needs 2 rows/);
  assert.throws(() => compare(['a'], ['x', 'y'], [[['○', 'n']]]), /needs 2 cells/);
  assert.throws(() => compare(['a'], ['x'], [[['?' as never, 'n']]]), /compare\(\).*has mark "\?"/);
  assert.throws(() => compare(['a'], ['x'], [[['' as never, 'n']]]), /has no mark/);
  assert.throws(() => compare(['a'], ['x'], [[['○', '']]]), /note/);
  assert.throws(() => compare(['a'], ['x'], [['○' as never]]), /\[mark, note\]/);
  assert.throws(() => compare(['a', 'a'], ['x'], [[null], [null]]), /unique/);
  await assert.rejects(chartOf(compare(['a'], ['1', '2', '3', '4', '5', '6'], [[null, null, null, null, null, null]], {width: 300})), /do not fit/);
  await assert.rejects(chartOf(compare(['a'], ['x'], [[['○', 'n']]], {height: 10})), /too small/);
});

const geom: ChartGeom = {x: 0, y: 0, w: 800, size: 14, widthOf: (s: string) => [...s].length * 14, wrap: 'char'} as ChartGeom;

test('layoutRatingTable(): a ruled table splits the cell and tints the header; a plain one centres the rating in the column', () => {
  const t = {rows: ['r'], cols: ['A', 'B'], corner: '', cells: [[{rating: 1, note: 'n'}, null]]};
  const drawn: number[] = [];
  const look = {who: 'x', ratingW: 40, ratingH: 40, draw: (_c: unknown, cx: number) => { drawn.push(cx); }};
  const ruled = layoutRatingTable({...t, ruled: true}, look, geom), plain = layoutRatingTable({...t, ruled: false}, look, geom);
  const colW = (800 - (14 + 16)) / 2, left = 14 + 16;
  assert.deepEqual(drawn, [left + 20, left + colW / 2]);
  assert.equal(ruled.items.filter(i => i.k === 'path' && i.dash).length, 1);
  assert.ok(ruled.items.some(i => i.k === 'rect' && i.fill === 'accent'));
  assert.equal(plain.items.filter(i => i.k === 'path' && i.dash).length, 0);
  assert.ok(!plain.items.some(i => i.k === 'text' && i.s === 'n'), 'a plain table has no room for notes');
  assert.ok(!plain.items.some(i => i.k === 'rect'));
});

test('layoutCompare(): needs a mark column and room for the note in every option', () => {
  const part = layoutCompare(resolveCompare(['r'], ['A'], [[['△', 'n']]]), geom);
  assert.ok(part.items.some(i => i.k === 'text' && i.s === '△' && i.anchor === 'middle'));
  assert.throws(() => layoutCompare(resolveCompare(['r'], ['A', 'B', 'C', 'D'], [[null, null, null, null]]), {...geom, w: 300}), /do not fit/);
});
