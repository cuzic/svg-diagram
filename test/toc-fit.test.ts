import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram, pdpc} from '../lib/dsl.ts';
import {layoutCauseBand, layoutCauseBandOnce} from '../lib/toc.ts';
import {andClashes} from '../lib/cause-clash.ts';
import {scoreOf} from '../lib/polyline-metrics.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';

// ADR 0010 U1: fitting the width. Font-free: layoutCauseBand with a fixed text width, and widths measured from the figure itself.
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const place = (band: CauseBand, w: number, heightBudget?: number): LaidOutCause => layoutCauseBand(band, 0, 0, w, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}, heightBudget);
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
  assert.throws(() => place(wide({maxNodeW: 200, fold: false}), tight()), /maxNodeW is explicit/);
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

// ADR 0010 D7 (G5): fold. The width is 60% of the natural width, measured first (no absolute px).
const naturalW = (opts: object = {}): number => extent(place(wide(opts), 6000));
const sixty = (): number => Math.floor(naturalW() * 0.6);
const rowsOf = (t: LaidOutCause, ids: string[]): number => new Set(ids.map(id => Math.round(t.anchors.find(a => a.id === id)!.y))).size;

test('causeTree() whose top layer is wider than the figure even at the narrowest nodes: folded into rows, still upward, and recorded', () => {
  const w = sixty();
  assert.ok(extent(place(wide({maxNodeW: 110}), 6000)) > w, 'narrowing alone does not make it fit');
  const t = place(wide(), w);
  assert.ok(extent(t) <= w + 0.5, `${extent(t)} > ${w}`);
  const fold = t.fitApplied?.filter(a => a.what === 'fold');
  assert.ok(fold?.length && fold.every(a => a.mode === 'omitted' && (a.from as number) >= 2));
  const ys = (ids: string[]) => ids.map(id => t.anchors.find(a => a.id === id)!);
  assert.ok(rowsOf(t, udes.map(u => u.id)) >= 2, 'the eight UDEs sit in two rows or more');
  for (const u of ys(udes.map(u => u.id))) assert.ok(u.y + u.h < t.anchors.find(a => a.id === 'root')!.y, 'effects stay above the cause');
  // the nodes do not overlap
  for (const [i, a] of t.nodes.entries()) for (const b of t.nodes.slice(i + 1)) assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  // dir: 'auto' is the same attempt; a node of each original layer is still there (the same number of boxes)
  assert.equal(JSON.stringify(place(wide({dir: 'auto'}), w).nodes), JSON.stringify(t.nodes));
  assert.equal(t.nodes.length, 12);
  assert.equal(JSON.stringify(place(wide(), w)), JSON.stringify(t), 'deterministic');
});

test("causeTree() dir: 'up' written does not fold, and the error offers fold: true; fold: true folds it and fold: false does not", () => {
  const w = sixty();
  assert.throws(() => place(wide({dir: 'up'}), w), (e: Error) => /fix: dir: 'auto', or fold: true/.test(e.message));
  const t = place(wide({dir: 'up', fold: true}), w);
  assert.ok(extent(t) <= w + 0.5 && t.fitApplied?.some(a => a.what === 'fold' && a.mode === 'written'));
  assert.throws(() => place(wide({fold: false}), w), /does not fit/);
});

test('causeTree() that fits is not changed by fold: true', () => {
  const w = naturalW() + 40;
  assert.equal(JSON.stringify(place(wide({fold: true}), w)), JSON.stringify(place(wide(), w)));
  assert.equal(place(wide({fold: true}), w).fitApplied, undefined);
});

test('causeTree() fold keeps the returns in the layers it folds: an outer return and an inline one still route', () => {
  const w = sixty();
  const t = place(causeTree([N('root', {role: 'root'}), N('m0'), N('m1'), N('m2'), ...udes],
    [...['m0', 'm1', 'm2'].map(m => ({from: 'root', to: m})), ...udes.map((u, i) => ({from: `m${i % 3}`, to: u.id})), {from: 'u0', to: 'root', back: true}]), w);
  assert.ok(extent(t) <= w + 0.5 && t.edges.every(e => e.points.length >= 2));
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
// G5 (ADR 0010 acceptance): eight UDEs, a width of 60% of the natural one: upward, folded, no absolute px.
test('a current reality tree with eight UDEs at 60% of its natural width: fits upward by folding (dir left out and auto); dir: up written throws and offers fold: true', async () => {
  const us = Array.from({length: 8}, (_, i) => N(`u${i}`, {role: 'ude', label: `現場が協力せず形だけ使う状態が続く事例その${i + 1}`}));
  const mk = (opts: object) => causeTree([N('root', {role: 'root', label: '評価の指標が部分最適になっている'}), N('m0'), N('m1'), N('m2'), ...us],
    [...['m0', 'm1', 'm2'].map(m => ({from: 'root', to: m})), ...us.map((u, i) => ({from: `m${i % 3}`, to: u.id}))], opts);
  const run = async (opts: object, W: number): Promise<LaidOutCause> => {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue', width: W}).add(mk(opts) as never));
    return laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  };
  const narrowest = extent(await run({maxNodeW: 110}, 6000)), natural = extent(await run({}, 6000));
  const W = Math.floor(Math.min(natural * 0.6, narrowest * 0.9)) + 40; // 60% of the natural width, and less than the narrowest nodes take (the fonts differ)
  assert.ok(narrowest > W - 40, 'narrowing alone is not enough');
  for (const opts of [{}, {dir: 'auto'}]) {
    const t = await run(opts, W);
    assert.ok(extent(t) <= W - 40 + 0.5);
    assert.ok(t.fitApplied?.some(a => a.what === 'fold'));
    const by = (id: string) => t.anchors.find(a => a.id === id)!;
    assert.ok(us.every(u => by(u.id).y + by(u.id).h < by('root').y), 'up: every UDE is above the root cause');
  }
  await assert.rejects(() => run({dir: 'up'}, W), /fix: dir: 'auto', or fold: true/);
  assert.ok(extent(await run({dir: 'up', fold: true}, W)) <= W - 40 + 0.5);
});
test.after(() => closeMeasurer());

test('causeTree() narrow but too tall: the failure says the height, and does not tell to widen the figure', () => {
  const chain = causeTree(['a', 'b', 'c', 'd', 'e'].map(id => N(id)), [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'e'}]);
  const natural = place(chain, 900).h;
  assert.throws(() => place(chain, 900, natural - 20), (e: Error) => /does not fit 900px wide by \d+px tall/.test(e.message) && !/widen the figure/.test(e.message) && /split the figure/.test(e.message));
  assert.doesNotThrow(() => place(chain, 900, natural + 20));
});

// ADR 0019 D2: maxNodeW: 'auto' looks for the widest node width that fits the width and the height budget
test("causeTree({maxNodeW: 'auto'}): the widest width that fits, also with dir written; a numeric maxNodeW is untouched", () => {
  const w = tight();
  assert.throws(() => place(wide({dir: 'up'}), w), /does not fit/, 'dir written, maxNodeW left out: nothing changes, so it throws (as before)');
  const t = place(wide({dir: 'up', maxNodeW: 'auto'}), w);
  assert.ok(extent(t) <= w + 0.5);
  assert.ok(t.fitApplied?.every(a => a.what === 'maxNodeW' && a.mode === 'auto'), 'what auto changed is a note');
  const roomy = place(wide({maxNodeW: 'auto'}), 6000), roomyDefault = place(wide(), 6000);
  assert.ok(extent(roomy) >= extent(roomyDefault), 'with room to spare the nodes may be wider than the default');
  assert.ok(extent(place(wide({maxNodeW: 'auto'}), w)) <= w + 0.5);
  assert.equal(JSON.stringify(place(wide({maxNodeW: 200}), 6000)), JSON.stringify(roomyDefault), 'a written 200 is the default picture');
});

test("causeTree({maxNodeW: 'auto'}): the height budget picks a wider node (shorter figure); no value fits: the failure is about the height", () => {
  const h = (maxNodeW: number) => place(wide({maxNodeW}), 6000).h;
  assert.ok(h(260) < h(110), 'wider nodes make a shorter figure');
  const budget = (h(200) + h(160)) / 2;
  const t = place(wide({maxNodeW: 'auto'}), 6000, budget);
  assert.ok(t.h <= budget + 0.5, 'the chosen figure fits the height budget');
  assert.throws(() => place(wide({maxNodeW: 'auto'}), 6000, h(260) - 20), /does not fit 6000px wide by \d+px tall/);
});

test('causeTree() that fits nowhere: the failure says where to split (ADR 0019 D3)', () => {
  const chain = causeTree(['a', 'b', 'c', 'd', 'e'].map(id => N(id)), [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'e'}]);
  const natural = place(chain, 900).h;
  assert.throws(() => place(chain, 900, natural - 20), /\n {2}split: after layer \d \(1 arrow crosses: [a-e]→[a-e]\)\. Draw the nodes up to that layer/, 'too tall: a cut between layers, both halves within the budget');
  assert.throws(() => place(chain, 900, 40), /split: no cut between two layers leaves both halves within the height/, 'nothing fits: three or more figures');
  assert.throws(() => place(wide({dir: 'up'}), 300), /\n {2}split: layer \d is the widest \(\d+ nodes: u\d/, 'too wide: the widest layer');
});

// ADR 0019 D4: the arrows into an effect with an AND cross; another written order is tried and kept only when it is strictly better
const nine = () => causeTree(Array.from({length: 9}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), JSON.parse('[{"from":"n0","to":"n2"},{"from":["n0","n1"],"to":"n3"},{"from":"n1","to":"n4"},{"from":"n0","to":"n4"},{"from":"n2","to":"n5"},{"from":"n3","to":"n5"},{"from":"n0","to":"n6"},{"from":"n0","to":"n7"},{"from":"n6","to":"n7"},{"from":"n1","to":"n7"},{"from":"n1","to":"n8"}]'), {tree: 'frt'});
const andCrossings = (t: LaidOutCause): number => andClashes(t.edges, t.ands).filter(c => c.how === 'crosses').length;
test('causeTree(): arrows into an AND that cross are searched again in another written order; the figure only gets better', () => {
  const once = layoutCauseBandOnce(nine(), 0, 0, 1400, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}), now = place(nine(), 1400);
  assert.ok(andCrossings(once) >= 1, 'the written order leaves a crossing');
  assert.equal(andCrossings(now), 0, 'the search removes it');
  assert.equal(now.loose.length, 0);
  assert.ok(now.h <= once.h + 0.5, 'no taller');
  assert.deepEqual(place(nine(), 1400), now, 'deterministic');
});

test('causeTree(): a figure with no crossing into an AND, and a pdpc(), come out exactly as laid out once', () => {
  const fine = causeTree([N('a'), N('b'), N('c')], [{from: ['a', 'b'], to: 'c'}]);
  assert.deepEqual(place(fine, 900), layoutCauseBandOnce(fine, 0, 0, 900, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}));
  const plan = pdpc([{id: 's', label: 's', role: 'start'}, {id: 'g', label: 'g', role: 'goal'}], [{from: 's', to: 'g'}]);
  assert.deepEqual(place(plan, 900), layoutCauseBandOnce(plan, 0, 0, 900, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}));
});

// ADR 0016 D11: the long arrow into an AND and the direct one that runs side by side with it. A 12-node tree that had a `cause-parallel` before the lanes were shared.
test('causeTree(): arrows into an AND no longer run side by side (the long arrow turns on the tail side of the direct ones)', () => {
  const links = JSON.parse('[{"from":["n1","n0"],"to":"n2"},{"from":"n0","to":"n3"},{"from":"n1","to":"n4"},{"from":"n2","to":"n4"},{"from":["n2","n0"],"to":"n5"},{"from":["n5","n2"],"to":"n6"},{"from":"n0","to":"n7"},{"from":"n5","to":"n7"},{"from":"n2","to":"n8"},{"from":["n2","n7"],"to":"n9"},{"from":"n8","to":"n10"},{"from":["n5","n3","n10"],"to":"n11"}]');
  const t = place(causeTree(Array.from({length: 12}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), links, {tree: 'frt', dir: 'up'}), 1800);
  assert.deepEqual(andClashes(t.edges, t.ands).filter(c => c.how !== 'crosses'), [], 'no two arrows into an AND run side by side');
  assert.equal(t.loose.length, 0);
});

// ADR 0016 D12: the long arrow's run through the layers beside another arrow's last run into the same AND (a random 10-node tree that had one).
test('causeTree(): a long arrow into an AND moves its way points aside when its run lies along another arrow into the same head', () => {
  const links = JSON.parse('[{"from":"n0","to":"n1"},{"from":["n0","n1"],"to":"n2"},{"from":"n0","to":"n3"},{"from":"n2","to":"n4"},{"from":["n0","n2","n4"],"to":"n5"},{"from":"n3","to":"n6"},{"from":["n4","n0","n1"],"to":"n7"},{"from":"n6","to":"n8"},{"from":["n5","n1"],"to":"n9"}]');
  const t = place(causeTree(Array.from({length: 10}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), links, {tree: 'frt', dir: 'up'}), 1800);
  assert.deepEqual(andClashes(t.edges, t.ands).filter(c => c.how !== 'crosses'), []);
  assert.equal(t.loose.length, 0);
});

test('causeTree(): moving a long arrow aside (ADR 0016 D12) neither brings back an AND crossing nor leaves the band', () => {
  const up8 = JSON.parse('[{"from":"n0","to":"n1"},{"from":["n0","n1"],"to":"n2"},{"from":["n0","n2","n1"],"to":"n3"},{"from":"n3","to":"n4"},{"from":"n1","to":"n5"},{"from":"n1","to":"n6"},{"from":"n1","to":"n7"},{"from":["n0","n7","n4"],"to":"n8"},{"from":["n7","n1"],"to":"n9"},{"from":"n3","to":"n10"},{"from":"n4","to":"n11"},{"from":"n7","to":"n12"},{"from":"n3","to":"n13"}]');
  const a = place(causeTree(Array.from({length: 14}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), up8, {tree: 'frt', dir: 'up'}), 1800);
  assert.deepEqual(andClashes(a.edges, a.ands).filter(c => c.how === 'crosses'), [], 'no AND crossing');
  const r94 = JSON.parse('[{"from":"n0","to":"n1"},{"from":["n1","n0"],"to":"n2"},{"from":"n0","to":"n3"},{"from":["n0","n1","n2"],"to":"n4"},{"from":"n0","to":"n5"},{"from":["n4","n5","n3"],"to":"n6"},{"from":"n6","to":"n7"},{"from":"n4","to":"n8"},{"from":["n8","n1","n2"],"to":"n9"},{"from":"n0","to":"n10"},{"from":"n2","to":"n11"},{"from":"n10","to":"n12"},{"from":"n6","to":"n8"}]');
  const b = place(causeTree(Array.from({length: 13}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), r94, {tree: 'crt', dir: 'right'}), 1800);
  assert.deepEqual(andClashes(b.edges, b.ands), [], 'the run beside another arrow into the AND is moved aside');
  for (const e of b.edges) for (const p of e.points) assert.ok(p.y >= b.y - 0.5 && p.y <= b.y + b.h + 0.5, `${e.from}->${e.to} stays in the band (y ${p.y})`);
});

// ADR 0016 D13: a direct arrow's first run along the last run of another arrow into the same AND (an 11-node tree that had one).
test('causeTree(): a direct arrow into an AND turns beside the other, so its first run does not lie along the other\'s last run', () => {
  const links = JSON.parse('[{"from":"n0","to":"n1"},{"from":"n1","to":"n2"},{"from":["n0","n1"],"to":"n3"},{"from":["n2","n3"],"to":"n4"},{"from":"n3","to":"n5"},{"from":"n1","to":"n6"},{"from":"n6","to":"n7"},{"from":"n3","to":"n8"},{"from":["n8","n0"],"to":"n9"},{"from":"n0","to":"n10"}]');
  const t = place(causeTree(Array.from({length: 11}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), links, {tree: 'frt', dir: 'up'}), 1800);
  assert.deepEqual(andClashes(t.edges, t.ands), []);
  assert.equal(t.loose.length, 0);
});

// ADR 0016 D13: the order search is entered by the AND crossings of the figure as first laid out, before the side-by-side runs are moved aside (CRT left, 10 nodes: it was 40px taller without that).
test('causeTree(): clearing an AND crossing by moving a run aside does not keep the order search from finding a lower figure', () => {
  const links = JSON.parse('[{"from":"n0","to":"n1"},{"from":["n0","n1"],"to":"n2"},{"from":"n0","to":"n3"},{"from":"n2","to":"n4"},{"from":"n2","to":"n5"},{"from":["n1","n3","n4"],"to":"n6"},{"from":"n4","to":"n7"},{"from":"n6","to":"n8"},{"from":"n5","to":"n9"},{"from":["n9","n6","n2"],"to":"n10"}]');
  const t = place(causeTree(Array.from({length: 11}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), links, {tree: 'crt', dir: 'left'}), 1800);
  assert.ok(t.h < 230, `height ${t.h}`);
  assert.deepEqual(andClashes(t.edges, t.ands), []);
});

// ADR 0019 D4 (widened): the search is entered by any crossing, not only an AND's. An 8-node tree with no AND (so none to cross) had 2 crossings in the written order.
test('causeTree(): a figure whose arrows cross with no AND involved is searched again too; the crossings only go down', () => {
  const links = JSON.parse('[{"from":"n0","to":"n1"},{"from":"n1","to":"n2"},{"from":"n1","to":"n3"},{"from":"n0","to":"n4"},{"from":"n4","to":"n5"},{"from":"n1","to":"n6"},{"from":"n2","to":"n7"},{"from":"n1","to":"n7"}]');
  const band = (): CauseBand => causeTree(Array.from({length: 8}, (_, i) => N(`n${i}`, {label: `n${i} の説明の文`})), links, {tree: 'frt', dir: 'up', straighten: false}); // the figure as it was before the long arrows searched for their way (`straighten: false`)
  const crossings = (t: LaidOutCause): number => scoreOf(t.edges.map(e => e.points)).crossings;
  const once = layoutCauseBandOnce(band(), 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}), now = place(band(), 1800);
  assert.ok(crossings(once) >= 1, `the written order leaves a crossing (${crossings(once)})`);
  assert.ok(crossings(now) < crossings(once), `the search lowers it (${crossings(once)} -> ${crossings(now)})`);
  assert.ok(now.h <= once.h + 0.5, 'no taller');
  assert.equal(now.loose.length, 0);
});

test('fitFailure(): an attempt 0.3px over the width in the rounded record but inside the slack is "too tall", not "too wide"', async () => {
  const {fitFailure} = await import('../lib/fit-width.ts');
  const msg = fitFailure('x()', 900, [{label: 'a', w: 901, h: 400, fitsWidth: true}], 'fix', [], 300);
  assert.match(msg, /tall/);
  assert.doesNotMatch(fitFailure('x()', 900, [{label: 'a', w: 901, h: 400, fitsWidth: false}], 'fix', [], 300), /every attempt that fits the width is too tall/);
});

// A long arrow went out to the side of the boxes and back (4 bends) because it turned half-way between the way points of the layers; it now takes the way around the boxes with the fewest bends.
test('causeTree(): the arrows of a current reality tree bend less than they did, and no arrow bends more than 4 times', () => {
  const nodes = ['u1', 'u2', 'u3', 'a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5', 'c1', 'c2'].map(id => N(id, {label: `${id} の説明の文`}));
  const links = JSON.parse('[{"from":"c2","to":"b1"},{"from":"b1","to":"a1"},{"from":"a1","to":"u1"},{"from":["c1","b3"],"to":"b2"},{"from":"b2","to":"a2"},{"from":"a2","to":"u1"},{"from":"b3","to":"a3"},{"from":"a3","to":"u1"},{"from":"u1","to":"u2"},{"from":"a3","to":"u2"},{"from":"c2","to":"b5"},{"from":"b5","to":"b4"},{"from":"b4","to":"a4"},{"from":"a3","to":"a5"},{"from":"a5","to":"a4"},{"from":"a4","to":"u3"}]');
  const bends = (t: LaidOutCause): number[] => t.edges.map(e => scoreOf([e.points]).bends);
  const before = place(causeTree(nodes, links, {tree: 'crt', straighten: false}), 1800), now = place(causeTree(nodes, links, {tree: 'crt'}), 1800);
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  assert.ok(sum(bends(now)) < sum(bends(before)), `${sum(bends(before))} -> ${sum(bends(now))}`);
  assert.ok(Math.max(...bends(now)) <= 4, `${bends(now)}`);
  assert.equal(now.loose.length, 0);
});
