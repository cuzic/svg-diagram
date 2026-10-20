import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {checkDiagram, closeMeasurer, diagram, fmea, journeyMap, qfd, raci, renderDiagram} from '../lib/dsl.ts';
import {fmeaParts, qfdParts} from '../lib/semantic-table.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());

test('raci validates responsibility/accountability and reports an empty role column', async () => {
  const b = raci(['設計', '承認'], ['担当', '責任者', '監査'], [['R', 'A', ''], ['R', 'A/R', '']], {legend: true, id: 'raci'});
  assert.equal(b.right, 'raci:right');
  const result = await checkDiagram(diagram({theme: 'blue', title: 'RACI'}).add(b));
  assert.ok(result.verdict.findings.some(f => f.rule === 'semantic-table-warning' && f.message.includes('監査')));
  assert.throws(() => raci(['設計'], ['担当'], [['R']]), /^Error: raci\(\):.*exactly one A/);
  assert.throws(() => raci(['設計'], ['担当'], [['A']]), /^Error: raci\(\):.*at least one R/);
  assert.throws(() => raci(['設計'], ['担当'], [['X']]), /^Error: raci\(\):.*unknown letter/);
  assert.doesNotThrow(() => raci(['設計'], ['担当'], [['R']], {allowNoA: true}));
  const narrow = raci(['設計'], ['担当', '責任者'], [['R', 'A']], {legend: true});
  assert.deepEqual((narrow.rows.at(-1) as {cells: readonly string[]}).cells, ['凡例', 'R: 実行責任\nA: 説明責任', 'C: 相談先\nI: 報告先'], 'all four letters survive with two roles');
});

test('fmea validates ratings, computes/sorts RPN and adds after-action RPN', () => {
  const p = fmeaParts([
    {item: '軸', mode: '摩耗', effect: '停止', cause: '潤滑不足', action: '給油', s: 8, o: 5, d: 4, after: {s: 6, o: 2, d: 2}},
    {item: '表示', mode: '消灯', effect: '見えない', cause: '断線', action: '交換', s: 3, o: 2, d: 2},
  ], {sort: 'rpn'});
  assert.deepEqual(p.computed.map(r => r.rpn), [160, 12]);
  assert.equal(p.computed[0]!.afterRpn, 24);
  assert.equal(p.columns.at(-1)?.label, '改善\nRPN');
  const top = (p.rows[0] as readonly ({text?: string; bold?: boolean; mark?: string} | string | number)[])[8];
  assert.deepEqual(typeof top === 'object' && [top.text, top.bold, top.mark], ['160', true, undefined], 'the worst RPN is bold, never ◎');
  assert.throws(() => fmea([{item: '', mode: '', effect: '', cause: '', action: '', s: 11, o: 1, d: 1}]), /^Error: fmea\(\):.*1 to 10/);
});

test('qfd computes weighted raw/relative scores and marks the unique best characteristic', () => {
  const p = qfdParts([{label: '速い', importance: 5}, {label: '静か', importance: 3}], ['速度', '騒音'], [['◎', '△'], ['○', '◎']]);
  assert.deepEqual(p.scores.raw, [54, 32]);
  assert.ok(Math.abs(p.scores.relative.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  const raw = (p.rows[2] as {cells: readonly (string | {text?: string; bold?: boolean; mark?: string})[]}).cells;
  assert.deepEqual(raw.slice(2).map(c => typeof c === 'string' ? c : [c.text, c.bold ?? false, c.mark]), [['54', true, undefined], ['32', false, undefined]], 'top score bold, no ◎ (◎ means a 9 relation here)');
  assert.ok(!qfdParts([{label: 'x', importance: 1}], ['a'], [['×']]).rows.some(r => 'cells' in r && r.cells.some(c => typeof c === 'object' && c !== null && 'bold' in c && c.bold)), 'an all-zero score is not highlighted');
  assert.throws(() => qfd([{label: 'x', importance: 1}], ['a'], [['?' as never]]), /^Error: qfd\(\):.*mark/);
});

test('journey emotion values retain numeric cues and validate their range', () => {
  const b = journeyMap(['認知', '購入', '利用'], [
    {id: 'action', label: '行動', cells: ['検索', '注文', '開始']},
    {id: 'emotion', label: '感情', cells: [-2, 1, 2]},
  ], {emotionRange: [-2, 2]});
  const emotion = (b.rows[1] as {cells: readonly ({text?: string; tone?: string; mark?: string} | string)[]}).cells;
  assert.deepEqual(emotion.slice(1).map(c => typeof c === 'string' ? c : c.text), ['-2', '+1', '+2']);
  assert.deepEqual(b.rowCurve, {row: 1, values: [-2, 1, 2], min: -2, max: 2});
  assert.equal((b.rows[1] as {h?: number}).h, 80);
  assert.throws(() => journeyMap(['認知'], [{id: 'emotion', label: '感情', cells: [9]}]), /^Error: journeyMap\(\): emotion/);
});

test('all semantic tables render valid SVG and pass structural verification', async () => {
  const bands = [
    raci(['設計'], ['担当', '責任者'], [['R', 'A']]),
    fmea([{item: '軸', mode: '摩耗', effect: '停止', cause: '不足', action: '給油', s: 8, o: 5, d: 4}]),
    qfd([{label: '速い', importance: 5}], ['速度'], [['◎']]),
    journeyMap(['認知', '利用'], [{id: 'emotion', label: '感情', cells: [-1, 2]}]),
  ];
  for (const [i, band] of bands.entries()) {
    const d = diagram({theme: 'blue', title: `semantic ${i}`}).add(band);
    const checked = await checkDiagram(d);
    assert.equal(checked.verdict.ok, true, checked.verdict.problems.join('\n'));
    const rendered = await renderDiagram(d, {name: `semantic-${i}.svg`, budget: 'cacheOnly'});
    assert.deepEqual(xmlProblems(rendered.svg), []);
    if (i === 3) {
      assert.match(rendered.svg, /<polyline points=/);
      assert.equal((rendered.svg.match(/A4,4 0 1 0/g) ?? []).length, 4, 'two outlined curve dots');
      const table = checked.laidOut.laidOut.find(x => x.type === 'table');
      assert.ok(table?.type === 'table' && table.rowCurve);
      const emotion = table.rows.find(r => !r.header)!;
      assert.ok(table.rowCurve.top > Math.max(...emotion.cells.slice(1).map(c => c.top + c.lines.length * table.bodySize * 1.4)));
    }
  }
});

test('journey emotion curve stays below a wrapped value and its guide marks the middle of the range', async () => {
  const stages = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const d = diagram({theme: 'blue', title: 'journey'}).add(journeyMap(stages, [{id: 'emotion', label: '感情', cells: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5]}], {emotionRange: [1, 5], width: 420}));
  const table = (await checkDiagram(d)).laidOut.laidOut.find(x => x.type === 'table');
  assert.ok(table?.type === 'table' && table.rowCurve);
  const emotion = table.rows.find(r => !r.header)!;
  assert.ok(emotion.cells.slice(1).some(c => c.lines.length > 1), 'the narrow columns wrap the values');
  assert.ok(table.rowCurve.top >= Math.max(...emotion.cells.slice(1).map(c => c.top + c.lines.length * table.bodySize * 1.4)));
  assert.equal(table.rowCurve.midY, table.rowCurve.points[2]!.y, 'value 3 sits on the guide');
});
