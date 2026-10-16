import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, isIsNot, isIsNotTests, renderDiagram, table} from '../lib/dsl.ts';
import type {LaidOutTable} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());

const ROWS = [
  {dim: 'what', is: 'API A がタイムアウトする', isNot: 'API B は正常', distinct: 'A だけ外部 DB を使う', change: '接続設定を変更した'},
  {dim: 'where', is: 'リージョン X', isNot: 'リージョン Y は正常', distinct: 'X だけ旧い接続プール', change: ''},
  {dim: 'when', is: 'デプロイ後から', isNot: 'デプロイ前は正常', distinct: '', change: '先週のデプロイ'},
  {dim: 'extent', is: '全体の 3%', isNot: 'それ以外', distinct: '長いクエリだけ'},
];
const svgOf = async (band: unknown) => (await renderDiagram(diagram({theme: 'blue'}).add(band as never), {name: 'x.svg', budget: 'cacheOnly'})).svg;
const rcaOf = (b: {rca?: {findings: {rule: string}[]}}) => b.rca?.findings.map(f => f.rule) ?? [];

test('isIsNot(): the table has the five columns, and its SVG is the same as a hand-written table() (the rca field is never drawn)', async () => {
  const band = isIsNot(ROWS);
  assert.deepEqual(band.columns.map(c => c.label).slice(0, 1), ['観点']);
  assert.equal(band.columns.length, 5);
  assert.equal(band.rows.length, 4);
  const hand = table(band.columns, band.rows, {});
  assert.equal(await svgOf(band), await svgOf(hand));
});

test('isIsNot(): a dim is a known heading or your own; "違い" and "変化" are separate columns', () => {
  const band = isIsNot([{dim: 'what', is: 'a', isNot: 'b'}, {dim: '誰が', is: 'c', isNot: 'd'}]);
  const first = band.rows as unknown as string[][];
  assert.equal(first[0][0], '何に（対象・欠陥）');
  assert.equal(first[1][0], '誰が');
  assert.deepEqual(band.columns.slice(3).map(c => c.label), ['違い', '変化']);
});

test('isIsNot(): mistakes throw', () => {
  assert.throws(() => isIsNot([]), /at least one row/);
  assert.throws(() => isIsNot([{dim: '', is: 'a', isNot: 'b'}]), /needs a dim/);
  assert.throws(() => isIsNot([{dim: 'what', is: 1 as never, isNot: 'b'}]), /is must be text/);
});

test('isIsNot(): rca findings — an empty IS NOT, and no "違い" anywhere', () => {
  assert.deepEqual(rcaOf(isIsNot(ROWS)), []);
  const noIsNot = isIsNot([{dim: 'what', is: 'a', isNot: '', distinct: 'x'}]);
  assert.deepEqual(rcaOf(noIsNot), ['isisnot-no-isnot']);
  assert.match(noIsNot.rca!.findings[0].message, /何に/);
  assert.deepEqual(rcaOf(isIsNot([{dim: 'what', is: 'a', isNot: 'b'}, {dim: 'where', is: 'c', isNot: 'd'}])), ['isisnot-no-distinct-at-all']);
});

const HYP = [
  {text: '接続設定の変更', results: ['yes', 'yes', 'ifAssumed', 'yes'] as const, assumes: ['古い接続が残っていた']},
  {text: 'ネットワーク障害', results: ['no', 'yes', 'no', 'no'] as const},
  {text: 'DB の負荷', results: ['yes', 'yes', 'yes', 'yes'] as const},
];

test('isIsNotTests(): a row per hypothesis, a column per row; the hypotheses that explain everything are bold, the fewest assumptions is said in words', async () => {
  const band = isIsNotTests(ROWS, HYP);
  assert.equal(band.rows.length, 3);
  assert.equal(band.columns.length, 1 + 4 + 2);
  const cells = band.rows as {text?: string; bold?: boolean}[][];
  assert.ok(cells[0].every(c => c.bold) && cells[2].every(c => c.bold), 'both hypotheses with no "no" are bold');
  assert.ok(cells[1].every(c => !c.bold));
  assert.match(cells[2][0].text!, /最少の仮定/);
  assert.doesNotMatch(cells[0][0].text!, /最少の仮定/);
  assert.match(cells[0][0].text!, /仮定: 古い接続が残っていた/);
  assert.deepEqual(cells[0].slice(1, 5).map(c => c.text), ['説明できる', '説明できる', '仮定すれば', '説明できる']);
  assert.equal(cells[1].at(-2)!.text, '3', 'rows it cannot explain');
  assert.equal(cells[0].at(-1)!.text, '1', 'assumptions');
  assert.ok(!JSON.stringify(band.rows).match(/[◎○△×]/), 'no matrix marks (◎ means 9 points in QFD)');
  assert.deepEqual(rcaOf(band), []);
});

test('isIsNotTests(): none stands → isisnot-no-hypothesis-stands (info); mistakes throw', () => {
  assert.deepEqual(rcaOf(isIsNotTests(ROWS, [HYP[1]])), ['isisnot-no-hypothesis-stands']);
  assert.throws(() => isIsNotTests(ROWS, []), /at least one hypothesis/);
  assert.throws(() => isIsNotTests(ROWS, [{text: 'x', results: ['yes']}]), /1 results for 4 rows/);
  assert.throws(() => isIsNotTests(ROWS, [{text: '', results: ['yes', 'yes', 'yes', 'yes']}]), /needs a text/);
  assert.throws(() => isIsNotTests(ROWS, [{text: 'x', results: ['yes', 'ifAssumed', 'yes', 'yes']}]), /no assumes/);
  assert.throws(() => isIsNotTests(ROWS, [{text: 'x', results: ['yes', 'maybe' as never, 'yes', 'yes']}]), /yes' \| 'ifAssumed' \| 'no'/);
});

const sev = async (opts: object, ...bands: unknown[]) => {
  let d = diagram({theme: 'blue', ...opts});
  for (const b of bands) d = d.add(b as never);
  const {laidOut, verdict} = await checkDiagram(d);
  return {findings: verdict.findings.filter(f => f.rule.startsWith('isisnot-')), problems: verdict.problems, laidOut};
};

test('check: info by default, warn under rcaCheck: strict (the stand-nowhere rule stays info); accept works; the default output has no warning', async () => {
  const bad = isIsNot([{dim: 'what', is: 'a', isNot: ''}]);
  assert.ok((await sev({}, bad)).findings.every(f => f.severity === 'info'));
  const strict = await sev({rcaCheck: 'strict'}, bad);
  assert.ok(strict.findings.length === 2 && strict.findings.every(f => f.severity === 'warn'));
  const none = await sev({rcaCheck: 'strict'}, isIsNotTests(ROWS, [HYP[1]]));
  assert.ok(none.findings.length === 1 && none.findings[0].severity === 'info');
  const acc = await sev({rcaCheck: 'strict', accept: {'isisnot-no-isnot': '比較対象は後で足す', 'isisnot-no-distinct-at-all': '調査中'}}, bad);
  assert.ok(acc.findings.every(f => f.severity === 'info'));
  const ok = await checkDiagram(diagram({theme: 'blue', rcaCheck: 'strict', title: 'IS/IS NOT'}).add(isIsNot(ROWS), isIsNotTests(ROWS, HYP)));
  assert.equal(ok.verdict.problems.length, 0, ok.verdict.problems.join('\n'));
  assert.deepEqual(ok.verdict.findings.filter(f => f.severity === 'warn'), []);
});
