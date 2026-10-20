import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, table} from '../lib/dsl.ts';
import type {LaidOutTable} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());

const cols = [{label: 'a'}, {label: 'b'}];
const laid = async (t: ReturnType<typeof table>): Promise<LaidOutTable> => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(t));
  assert.deepEqual(verdict.problems, []);
  const l = laidOut.laidOut.find(b => b.type === 'table');
  assert.ok(l && l.type === 'table');
  return l;
};

test('a row\'s h fixes that row only, wins over cellH, and centres the text', async () => {
  const t = await laid(table(cols, [{cells: ['1', '2'], h: 60}, ['3', '4']], {cellH: 40}));
  assert.deepEqual(t.rows.map(r => r.h), [40, 60, 40]);
  const r = t.rows[1];
  assert.ok(Math.abs(r!.cells[0]!.top - (r!.y + (60 - 14 * 1.5) / 2)) < 12);
  const rows = (await laid(table(cols, [{cells: ['1', '2'], h: 60}, ['3', '4']]))).rows;
  assert.equal(rows[1]!.h, 60);
  assert.ok(rows[2]!.h < 60); // others keep their content height
});

test('headerH fixes the header row and wins over cellH', async () => {
  const t = await laid(table(cols, [['1', '2']], {headerH: 50, cellH: 40}));
  assert.deepEqual(t.rows.map(r => r.h), [50, 40]);
  const only = await laid(table(cols, [['1', '2']], {headerH: 50}));
  assert.equal(only.rows[0]!.h, 50);
  assert.ok(only.rows[1]!.h < 50);
});

test('dense trims the row padding to 4px and keeps the text size', async () => {
  const normal = await laid(table(cols, [['1', '2'], ['3', '4']]));
  const dense = await laid(table(cols, [['1', '2'], ['3', '4']], {dense: true}));
  for (const [i, r] of dense.rows.entries()) assert.ok(Math.abs(normal.rows[i]!.h - r.h - 8) < 1e-9);
  assert.equal(dense.rows[1]!.cells[0]!.top, dense.rows[1]!.y + 4);
  assert.equal(dense.rows[1]!.cells[0]!.lines.length, 1);
});

test('dense sets the needed height: cellH / h between the two paddings pass only with dense', async () => {
  const need = (await laid(table(cols, [['1', '2']], {dense: true}))).rows[1]!.h; // 21 + 8
  const d = diagram({theme: 'blue'});
  await assert.rejects(checkDiagram(d.add(table(cols, [['1', '2']], {cellH: need}))), /cellH .* is too small/);
  const t = await laid(table(cols, [{cells: ['1', '2'], h: need}], {cellH: need + 10, dense: true}));
  assert.deepEqual(t.rows.map(r => r.h), [need + 10, need]);
});

test('too-small h / headerH throw with their own names', async () => {
  const d = () => diagram({theme: 'blue'});
  await assert.rejects(checkDiagram(d().add(table(cols, [{cells: ['1', '2'], h: 10}]))), /table\(\): h 10 is too small/);
  await assert.rejects(checkDiagram(d().add(table(cols, [['1', '2']], {headerH: 10}))), /headerH 10 is too small/);
  await assert.rejects(checkDiagram(d().add(table(cols, [['1', '2']], {cellH: 10, headerH: 60}))), /cellH 10 is too small/);
});

test('a table without h / headerH / dense is laid out as before', async () => {
  const t = await laid(table(cols, [['1', '2'], {cells: ['3', '4'], tone: 'accent'}]));
  const heights = t.rows.map(r => r.h);
  assert.ok(heights.every(h => h === heights[0]));
  assert.equal(t.rows[1]!.cells[0]!.top, t.rows[1]!.y + 8);
});
