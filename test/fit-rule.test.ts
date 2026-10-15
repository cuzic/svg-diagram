import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {box, causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {applyConfig} from '../lib/config.ts';
import type {Finding} from '../lib/types/verdicts.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

// ADR 0010 U4: the auto-fit-applied rule and diagram({maxWidth}).
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const sentences = ['現場が協力せず、形だけ使う状態が続く', '稼働率で評価されるため仕掛りが増える', 'PoCは成功するが指標が動かない', '納期遅れが常態化している', '品質のばらつきが大きい', '在庫が過剰に積み上がる', '顧客からの苦情が減らない', '改善提案が出てこない'];
const us = sentences.map((label, i) => N(`u${i}`, {role: 'ude', label}));
const crt = (opts: object = {}) => causeTree([N('root', {role: 'root', label: '評価の指標が部分最適になっている'}), N('m0', {label: '部門ごとに目標が違う'}), N('m1', {label: '全体を見る人がいない'}), N('m2', {label: '会議が報告だけで終わる'}), ...us],
  [...['m0', 'm1', 'm2'].map(m => ({from: 'root', to: m})), ...us.map((u, i) => ({from: `m${i % 3}`, to: u.id}))], opts);
const run = async (opts: object, W: number, dopts: object = {}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 'CRT', width: W, ...dopts}).add(crt(opts) as never));
  return {t: laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, verdict};
};
const extent = (t: LaidOutCause): number => Math.max(...t.nodes.map(n => n.x + n.w)) - Math.min(...t.nodes.map(n => n.x));
const byRule = (fs: Finding[], rule: string) => fs.filter(f => f.rule === rule);
// a width that needs the nodes narrowed (as wide as the narrowest nodes need, plus a little), from the figure's own natural widths
const tightWidth = async (): Promise<number> => Math.ceil(extent((await run({maxNodeW: 110}, 4000)).t)) + 40 + 10;

test('auto-fit-applied: a figure that fits has no finding', async () => {
  const {verdict} = await run({}, 4000, {maxWidth: 4000});
  assert.deepEqual(byRule(verdict.findings, 'auto-fit-applied'), []);
});

test('auto-fit-applied: dir left out is a warning that says what changed, reaches the build warnings, and teaches dir: auto', async () => {
  const {t, verdict} = await run({}, await tightWidth());
  assert.ok(t.fitApplied?.length);
  const f = byRule(verdict.findings, 'auto-fit-applied');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'warn');
  assert.match(f[0].message, /maxNodeW を 200→\d+ に縮めた\(\d+→\d+px\)/);
  assert.match(f[0].message, /dir: 'auto'/);
  assert.ok(verdict.warnings.some(w => w.startsWith('[auto-fit-applied]')));
});

test("auto-fit-applied: dir: 'auto' is info and does not reach the warnings", async () => {
  const {verdict} = await run({dir: 'auto'}, await tightWidth());
  const f = byRule(verdict.findings, 'auto-fit-applied');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'info');
  assert.ok(!verdict.warnings.some(w => w.startsWith('[auto-fit-applied]')));
});

test('auto-fit-applied: accept turns the warning into info with the reason', async () => {
  const {verdict} = await run({}, await tightWidth(), {accept: {'auto-fit-applied': '自動で収めてよい'}});
  const f = byRule(verdict.findings, 'auto-fit-applied')[0];
  assert.equal(f.severity, 'info');
  assert.ok(f.message.endsWith('（許容: 自動で収めてよい）'));
});

test('auto-fit-applied is a known rule (accept in .svg-diagram.json accepts it)', () => {
  const d = applyConfig({accept: undefined, maxWidth: undefined} as never, {accept: {'auto-fit-applied': 'ok'}}) as {accept: Record<string, string>};
  assert.equal(d.accept['auto-fit-applied'], 'ok');
});

// ---- diagram({maxWidth}) ----
const wide = (opts: object) => { const d = diagram({theme: 'blue', title: 't', ...opts}); d.add(box({title: 'x'})); return d; };
const docWidth = async (d: ReturnType<typeof wide>) => byRule((await checkDiagram(d)).verdict.findings, 'doc-width');

test('diagram({maxWidth: 1200}) lets a width-1200 doc figure through without doc-width; without it the figure warns', async () => {
  assert.equal((await docWidth(wide({width: 1200}))).length, 1);
  assert.deepEqual(await docWidth(wide({width: 1200, maxWidth: 1200})), []);
  const over = await docWidth(wide({width: 1300, maxWidth: 1200}));
  assert.equal(over.length, 1);
  assert.match(over[0].message, /1200px 以下/);
});

test('diagram({maxWidth}) is the doc-width threshold, not the layout width: width stays 940', () => {
  assert.equal(diagram({theme: 'blue', maxWidth: 1200}).width, 940);
  assert.equal(diagram({theme: 'blue', maxWidth: 1200}).maxWidth, 1200);
  assert.equal('maxWidth' in diagram({theme: 'blue'}), false, 'left out: the key is not there');
});

test("the figure's maxWidth wins over the project's; the project's applies when it is left out", () => {
  const own = applyConfig(diagram({theme: 'blue', maxWidth: 1300}) as never, {maxWidth: 900}) as {maxWidth: number};
  assert.equal(own.maxWidth, 1300);
  const proj = applyConfig(diagram({theme: 'blue'}) as never, {maxWidth: 900}) as {maxWidth: number};
  assert.equal(proj.maxWidth, 900);
});

test('diagram({maxWidth}) must be a positive number', () => {
  for (const bad of [0, -1, NaN, Infinity, '1200' as never]) assert.throws(() => diagram({theme: 'blue', maxWidth: bad}), /maxWidth.*positive number/);
});

test('a canvas figure is not checked for doc-width, maxWidth or not', async () => {
  assert.deepEqual(await docWidth(wide({canvas: 'slide', maxWidth: 500})), []);
});
