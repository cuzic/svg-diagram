import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, renderDiagram, table, whyWhyTable} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const CHAINS = [
  {whys: ['修正に時間がかかった', '影響範囲が広かった', '検証が最後に集中していた'], trueCause: '検証を早い段階でしていない', measure: '結合テストを毎週回す'},
  {whys: ['修正に時間がかかった', '不具合の発見が遅かった'], trueCause: '監視の項目が足りない', measure: 'アラートを足す'},
];
const rcaOf = (b: {rca?: {findings: {rule: string}[]}}) => b.rca?.findings.map(f => f.rule) ?? [];
const svgOf = async (band: unknown) => (await renderDiagram(diagram({theme: 'blue'}).add(band as never), {name: 'x.svg', budget: 'cacheOnly'})).svg;

test('whyWhyTable(): a row per chain; the columns are 問題, なぜ 1…N (the longest chain), 真因, 対策; a shorter chain is padded; the same cause is written again', async () => {
  const band = whyWhyTable('リリースが遅れた', CHAINS);
  assert.deepEqual(band.columns.map(c => c.label), ['問題', 'なぜ 1', 'なぜ 2', 'なぜ 3', '真因', '対策']);
  const rows = band.rows as unknown as (string | {text: string; bold?: boolean})[][];
  assert.equal(rows.length, 2);
  assert.equal(rows[0]![0], 'リリースが遅れた');
  assert.equal(rows[1]![1], '修正に時間がかかった', 'a shared cause is repeated');
  assert.equal(rows[1]![3], '', 'a short chain is padded');
  assert.equal((rows[0]![4] as {text: string}).text, '検証を早い段階でしていない');
  assert.equal(await svgOf(band), await svgOf(table(band.columns, band.rows, {})), 'the rca field is never drawn');
});

test('whyWhyTable(): mistakes throw', () => {
  assert.throws(() => whyWhyTable('', CHAINS), /problem/);
  assert.throws(() => whyWhyTable('x', []), /at least one chain/);
  assert.throws(() => whyWhyTable('x', [{whys: []}]), /needs whys/);
  assert.throws(() => whyWhyTable('x', [{whys: ['a', ' ']}]), /why 2 needs text/);
  assert.throws(() => whyWhyTable('x', [{whys: ['a'], measure: 5 as never}]), /measure must be text/);
});

test('whyWhyTable(): rca findings — no root, a measure without a root, a single chain', () => {
  assert.deepEqual(rcaOf(whyWhyTable('x', CHAINS)), []);
  assert.deepEqual(rcaOf(whyWhyTable('x', [CHAINS[0]!, {whys: ['a', 'b']}])), ['whywhy-no-root']);
  assert.deepEqual(rcaOf(whyWhyTable('x', [CHAINS[0]!, {whys: ['a', 'b'], measure: '周知する'}])), ['whywhy-no-root', 'whywhy-measure-without-root']);
  const one = whyWhyTable('x', [CHAINS[0]!]);
  assert.deepEqual(rcaOf(one), ['whywhy-single-chain']);
  assert.equal(one.rca!.findings[0]!.severity, 'info');
});

test('check: info by default, warn with rcaCheck: strict (a single chain stays info); the default output is clean', async () => {
  const chk = async (opts: object, band: unknown) => (await checkDiagram(diagram({theme: 'blue', title: 'なぜなぜ', ...opts}).add(band as never))).verdict;
  const bad = whyWhyTable('x', [CHAINS[0]!, {whys: ['a', 'b'], measure: '周知する'}]);
  const f = (v: {findings: {rule: string; severity: string}[]}) => v.findings.filter(x => x.rule.startsWith('whywhy-'));
  assert.ok(f(await chk({}, bad)).every(x => x.severity === 'info'));
  const strict = f(await chk({rcaCheck: 'strict'}, bad));
  assert.ok(strict.length === 2 && strict.every(x => x.severity === 'warn'));
  const one = f(await chk({rcaCheck: 'strict'}, whyWhyTable('x', [CHAINS[0]!])));
  assert.ok(one.length === 1 && one[0]!.severity === 'info');
  const ok = await chk({rcaCheck: 'strict'}, whyWhyTable('リリースが遅れた', CHAINS));
  assert.equal(ok.problems.length, 0, ok.problems.join('\n'));
  assert.deepEqual(ok.findings.filter(x => x.severity === 'warn'), []);
});
