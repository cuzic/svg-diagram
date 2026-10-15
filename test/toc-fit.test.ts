import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram, pdpc} from '../lib/dsl.ts';
import {layoutCauseBand} from '../lib/toc.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';

// ADR 0010 U1: fitting the width. Font-free: layoutCauseBand with a fixed text width, and widths measured from the figure itself.
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const place = (band: CauseBand, w: number, heightBudget?: number): LaidOutCause => layoutCauseBand(band, 0, 0, w, fixedW as never, ROLES, heightBudget);
const extent = (t: LaidOutCause): number => Math.max(...t.nodes.map(n => n.x + n.w)) - Math.min(...t.nodes.map(n => n.x));

// root -> 3 -> 8 UDEs with long sentences: the top layer is the wide one
const udes = Array.from({length: 8}, (_, i) => N(`u${i}`, {role: 'ude', label: `現場が協力せず形だけ使う状態が続く${i}`}));
const wide = (opts: object = {}) => causeTree(
  [N('root', {role: 'root'}), N('m0'), N('m1'), N('m2'), ...udes],
  [...['m0', 'm1', 'm2'].map(m => ({from: 'root', to: m})), ...udes.map((u, i) => ({from: `m${i % 3}`, to: u.id}))],
  opts,
);
// the width that needs narrowing: between the natural width at the narrowest maxNodeW and at the default
const tight = (): number => {
  const at = (maxNodeW: number) => extent(place(wide({maxNodeW}), 6000));
  const [lo, hi] = [at(110), at(200)];
  assert.ok(lo < hi, `the figure must get narrower with maxNodeW (${lo} vs ${hi})`);
  return Math.floor((lo + hi) / 2);
};

test('causeTree() too wide with dir left out: nodes are narrowed, the direction stays up, and what changed is recorded', () => {
  const w = tight(), t = place(wide(), w);
  assert.ok(extent(t) <= w + 0.5);
  assert.ok(t.fitApplied && t.fitApplied.length > 0);
  assert.ok(t.fitApplied.every(a => a.what === 'maxNodeW' && a.mode === 'omitted' && (a.to as number) < 200));
  assert.ok(t.fitApplied[0].wasW! > w && t.fitApplied[0].nowW! <= w);
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  assert.ok(by('u0').y + by('u0').h < by('root').y, 'effects stay above their causes');
});

test("causeTree() dir: 'auto' narrows the same way and is recorded as auto", () => {
  const t = place(wide({dir: 'auto'}), tight());
  assert.ok(t.fitApplied?.length && t.fitApplied.every(a => a.mode === 'auto'));
});

test('causeTree() that fits: nothing is recorded, and dir left out, auto and up lay out the same', () => {
  const w = extent(place(wide(), 6000)) + 40;
  const same = JSON.stringify(place(wide({dir: 'up'}), w));
  assert.equal(place(wide(), w).fitApplied, undefined);
  assert.equal(JSON.stringify(place(wide(), w)), same);
  assert.equal(JSON.stringify(place(wide({dir: 'auto'}), w)), same);
});

test("causeTree() with dir: 'up' written is not changed: the error lists what was tried, what was not, and one fix", () => {
  const w = tight();
  assert.throws(() => place(wide({dir: 'up'}), w), (e: Error) => /does not fit/.test(e.message) && /as written/.test(e.message) && /not tried: .*dir is explicit/.test(e.message) && /fix: dir: 'auto'/.test(e.message) && e.message.split('\n').filter(l => l.startsWith('  fix:')).length === 1);
});

test('causeTree() with maxNodeW written is not narrowed', () => {
  assert.throws(() => place(wide({maxNodeW: 200}), tight()), /maxNodeW is explicit/);
});

test('causeTree() that cannot fit even at the narrowest: every width is listed, and one fix is named', () => {
  assert.throws(() => place(wide(), 400), (e: Error) => ['200', '160', '130', '110'].every(n => e.message.includes(`maxNodeW ${n}`)) && /diagram\(\{width: \d+\}\)|split the figure/.test(e.message));
});

const steps = Array.from({length: 8}, (_, i) => N(`s${i}`, {label: `工程の名前が長い${i}`}));
const path = (opts: object = {}) => pdpc([N('start', {role: 'start'}), ...steps, N('goal', {role: 'goal'})], [...steps.map(s => ({from: 'start', to: s.id})), ...steps.map(s => ({from: s.id, to: 'goal'}))], opts);
// narrower than a row of the eight even at the narrowest nodes, so only turning right can fit
const rowTooWide = (): number => extent(place(path({dir: 'down', maxNodeW: 110}), 6000)) - 1;

test('pdpc() runs down; too wide it turns right (its axis may change), and an explicit dir does not', () => {
  const w = rowTooWide(), t = place(path(), w);
  assert.ok(extent(t) <= w + 0.5);
  assert.ok(t.fitApplied?.some(a => a.what === 'dir' && a.from === 'down' && a.to === 'right'));
  assert.throws(() => place(path({dir: 'down'}), w), /dir is explicit/);
});

test("pdpc() dir: 'auto' leaves out a turn that is taller than the height budget", () => {
  const w = rowTooWide(), free = place(path({dir: 'auto'}), w);
  assert.ok(free.fitApplied?.some(a => a.what === 'dir'));
  assert.throws(() => place(path({dir: 'auto'}), w, free.h - 10), /does not fit/);
});

// The requester's case through the whole pipeline (real fonts): eight UDEs on the top layer, up. The width is taken from the figure's own
// natural widths (no absolute px): as wide as the narrowest nodes need, plus a little.
test('a current reality tree with eight UDEs, wider than the diagram at the default nodes: dir left out fits upward; dir: up written does not change and says so', async () => {
  const sentences = ['現場が協力せず、形だけ使う状態が続く', '稼働率で評価されるため仕掛りが増える', 'PoCは成功するが指標が動かない', '納期遅れが常態化している', '品質のばらつきが大きい', '在庫が過剰に積み上がる', '顧客からの苦情が減らない', '改善提案が出てこない'];
  const us = sentences.map((label, i) => N(`u${i}`, {role: 'ude', label}));
  const mk = (opts: object) => causeTree([N('root', {role: 'root', label: '評価の指標が部分最適になっている'}), N('m0', {label: '部門ごとに目標が違う'}), N('m1', {label: '全体を見る人がいない'}), N('m2', {label: '会議が報告だけで終わる'}), ...us],
    [...['m0', 'm1', 'm2'].map(m => ({from: 'root', to: m})), ...us.map((u, i) => ({from: `m${i % 3}`, to: u.id}))], opts);
  const run = async (opts: object, W: number): Promise<LaidOutCause> => {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue', width: W}).add(mk(opts) as never));
    return laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  };
  const natural = extent(await run({}, 4000)), narrowest = extent(await run({maxNodeW: 110}, 4000));
  assert.ok(narrowest < natural, 'the narrowest nodes make the figure narrower');
  const W = Math.ceil(narrowest) + 40 + 10;
  const t = await run({}, W);
  assert.ok(extent(t) <= W - 40 + 0.5);
  assert.ok(t.fitApplied?.length);
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  assert.ok(by('u0').y + by('u0').h < by('root').y, 'the effects are above the cause: the direction is kept');
  await assert.rejects(() => run({dir: 'up'}, W), /dir 'up', maxNodeW 200 \(as written\) \d+px wide[\s\S]*not tried[\s\S]*fix: dir: 'auto'/);
});
test.after(() => closeMeasurer());
