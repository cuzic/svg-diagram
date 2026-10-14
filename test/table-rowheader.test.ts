import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, renderDiagram, table} from '../lib/dsl.ts';
import {lintDiagram} from '../lib/rules.ts';
import {PALETTE} from '../lib/tokens.ts';
import type {LaidOutTable, TableBand} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());

const cols = [{label: '層'}, {label: '役割'}];
const soft = PALETTE.blue.soft;
const run = async (t: TableBand) => {
  const d = diagram({theme: 'blue', title: 't'}).add(t);
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const findings = lintDiagram({...d, laidOut: laidOut.laidOut, connects: []});
  return {t: laidOut.laidOut.find(b => b.type === 'table') as LaidOutTable, findings};
};
const svgOf = async (t: TableBand) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(t), {name: 't.svg', budget: 'cacheOnly'})).svg;
const long = 'とても長い説明の文章がここに入っていて、列の幅を超えるので折り返して二行以上になる。'.repeat(2);

test('row-heading cells are bold, soft-filled, with a heavy rule on their right', async () => {
  const rows = [['画面', 'x'], ['業務', 'y']];
  const {t} = await run(table(cols, rows, {rowHeader: true, width: 300}));
  assert.equal(t.rowHeader, true);
  for (const r of t.rows.filter(r => !r.header)) { assert.equal(r.cells[0].bold, true); assert.equal(r.cells[1].bold, false); }
  const svg = await svgOf(table(cols, rows, {rowHeader: true, width: 300}));
  assert.equal(svg.split(`fill="${soft}"`).length - 1, 3); // header row + 2 label cells
  assert.match(svg, /stroke-width="3"/);
});

test('the top-left cell follows the header row', async () => {
  const {t} = await run(table(cols, [['a', 'b']], {rowHeader: true}));
  assert.equal(t.rows[0].header, true);
  assert.equal(t.rows[0].cells[0].text, '層');
  const svg = await svgOf(table(cols, [['a', 'b']], {rowHeader: true}));
  // rule starts at the first body row, not at the header
  const rule = /M(\d+),(\d+) V(\d+)" stroke="[^"]+" stroke-width="3"/.exec(svg);
  assert.ok(rule);
  assert.equal(Number(rule[2]), Math.round(t.rows[1].y));
});

test('a soft-filled row tone warns; code-filled tones do not, and the label cell stays soft', async () => {
  const mk = (tone: 'accent' | 'new' | 'muted' | 'removed') => table(cols, [{cells: ['a', 'b'], tone}], {rowHeader: true});
  for (const tone of ['accent', 'new'] as const) {
    const {findings} = await run(mk(tone));
    assert.ok(findings.some(f => f.rule === 'rowheader-tone-collides' && f.severity === 'warn'), tone);
  }
  for (const tone of ['muted', 'removed'] as const) {
    const {findings} = await run(mk(tone));
    assert.ok(!findings.some(f => f.rule === 'rowheader-tone-collides'), tone);
    assert.equal((await svgOf(mk(tone))).split(`fill="${soft}"`).length - 1, 2); // header + label cell
  }
  const {findings} = await run(table(cols, [{cells: ['a', 'b'], tone: 'accent'}]));
  assert.ok(!findings.some(f => f.rule === 'rowheader-tone-collides'));
});

test('labels are top-aligned like the body, centred when the row height is fixed', async () => {
  const free = (await run(table(cols, [['a', long], ['b', 'c']], {rowHeader: true}))).t;
  for (const r of free.rows.filter(r => !r.header)) assert.equal(r.cells[0].top, r.cells[1].top);
  const fixed = (await run(table(cols, [['a', 'b']], {rowHeader: true, cellH: 60}))).t;
  const r = fixed.rows[1];
  assert.ok(r.cells[0].top > r.y + 10);
  assert.equal(r.cells[0].top, r.cells[1].top);
});

test('a wrapping label sets the row height; cellH / row h / dense still apply', async () => {
  const longLabel = 'とても長い行ラベルの文字列です';
  const narrow = {rowHeader: true, width: 220} as const;
  const {t} = await run(table([{label: 'L', flex: 1}, {label: 'R', flex: 2}], [[longLabel, 'x'], ['b', 'c']], narrow));
  assert.ok(t.rows[1].cells[0].lines.length > 1);
  assert.ok(t.rows[1].h > t.rows[2].h);
  const fixedNarrow = diagram({theme: 'blue'}).add(table([{label: 'L', flex: 1}, {label: 'R', flex: 2}], [[longLabel, 'x']], {...narrow, cellH: 30}));
  await assert.rejects(checkDiagram(fixedNarrow), /cellH 30 is too small/);
  const mixed = (await run(table(cols, [{cells: ['a', 'b'], h: 70}, ['c', 'd']], {rowHeader: true, cellH: 40, headerH: 30, dense: true}))).t;
  assert.deepEqual(mixed.rows.map(r => r.h), [30, 70, 40]);
});

test('without rowHeader the output is unchanged', async () => {
  const a = await svgOf(table(cols, [['a', 'b']]));
  const b = await svgOf(table(cols, [['a', 'b']], {rowHeader: false}));
  assert.equal(a, b);
  assert.ok(!a.includes('stroke-width="3"'));
});

test('rowHeader needs two columns and a boolean', () => {
  assert.throws(() => table([{label: 'a'}], [['x']], {rowHeader: true}), /at least 2 columns/);
  assert.throws(() => table(cols, [['x', 'y']], {rowHeader: 'yes' as never}), /rowHeader must be/);
});
