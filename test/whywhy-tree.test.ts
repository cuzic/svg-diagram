import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, whyWhyTree} from '../lib/dsl.ts';
import type {CauseBand} from '../lib/types/diagrams.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const WHYS = [{
  why: '修正に時間がかかった',
  because: [
    {why: '影響範囲が広かった', because: [{why: '検証が最後に集中していた', trueCause: true as const, measure: '結合テストを毎週回す'}]},
    {why: '不具合の発見が遅かった'},
  ],
}];
const treeOf = (bands: unknown[]) => bands.find(b => (b as {type: string}).type === 'cause') as CauseBand;
const rcaOf = (b: CauseBand) => b.rca?.findings.map(f => f.rule) ?? [];
const laid = async (opts: object, ...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: 'なぜなぜ', ...opts}).add(...(bands.flat() as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, verdict, all: laidOut.laidOut};
};
const boxOf = (t: LaidOutCause, label: string) => t.labelBoxes.find(b => b.label === label)!;

test('whyWhyTree(): the tree and two reading lines; nodes are the problem, the whys, the root cause and the measure; arrows run cause -> effect', () => {
  const bands = whyWhyTree('リリースが遅れた', WHYS, {id: 'ww'});
  assert.equal(bands.length, 3);
  assert.deepEqual(bands.map(b => b.type), ['cause', 'caption', 'caption']);
  const t = treeOf(bands);
  assert.equal(t.nodes.length, 6);
  const by = (label: string) => t.nodes.find(n => n.label === label)!;
  assert.equal(by('リリースが遅れた').role, 'effect');
  assert.equal(by('リリースが遅れた').tone, 'danger');
  assert.equal(by('検証が最後に集中していた').role, 'root');
  assert.equal(by('結合テストを毎週回す').role, 'measure');
  assert.equal(by('修正に時間がかかった').role, undefined);
  const link = (from: string, to: string) => t.links.find(l => l.from === by(from).id && l.to === by(to).id);
  assert.ok(link('修正に時間がかかった', 'リリースが遅れた'), 'a why points at what it explains');
  assert.ok(link('影響範囲が広かった', '修正に時間がかかった'));
  assert.equal(link('結合テストを毎週回す', '検証が最後に集中していた')?.kind, 'blocks');
  assert.match((bands[1] as {text: string}).text, /さかのぼって/);
  assert.match((bands[2] as {text: string}).text, /なぜの答えではない/);
  assert.equal(whyWhyTree('x', [{why: 'a'}], {readingNote: false}).length, 1);
  assert.equal(whyWhyTree('x', [{why: 'a'}]).length, 2, 'no measure: no second line');
  assert.equal(t.layerFrom, 'effect');
});

test('whyWhyTree(): mistakes throw', () => {
  assert.throws(() => whyWhyTree('', WHYS), /problem/);
  assert.throws(() => whyWhyTree('x', []), /at least one answer/);
  assert.throws(() => whyWhyTree('x', [{why: ' '}]), /needs a why/);
  assert.throws(() => whyWhyTree('x', [{why: 'a', trueCause: false as never}]), /trueCause is true/);
  assert.throws(() => whyWhyTree('x', [{why: 'a', measure: ''}]), /measure/);
  assert.throws(() => whyWhyTree('x', [{id: 'p', why: 'a'}, {id: 'p', why: 'b'}]), /used twice/);
});

test('layout: the problem is at the top, the answers go down; "why 2" is one layer in every branch; the measure sits below its root cause', async () => {
  const deep = [{why: 'A1', because: [{why: 'A2', because: [{why: 'A3', trueCause: true as const, measure: '対策 A'}]}]}, {why: 'B1', because: [{why: 'B2', trueCause: true as const}]}];
  const {t, verdict} = await laid({}, whyWhyTree('問題', deep, {id: 'ww'}));
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  const y = (l: string) => boxOf(t, l).y;
  assert.ok(y('問題') < y('A1') && y('A1') < y('A2') && y('A2') < y('A3') && y('A3') < y('対策 A'));
  assert.equal(y('A1'), y('B1'), 'why 1 is one layer');
  assert.equal(y('A2'), y('B2'), 'why 2 is one layer, though branch B stops there (not dropped to the bottom)');
});

test('layout: five whys, a measure and two branches fit the default width without an error; a squeeze is only an info', async () => {
  const chain = (n: number, tail: object): object => n === 0 ? tail : {why: `なぜ ${6 - n} の答えを少し長めの文で書く`, because: [chain(n - 1, tail)]};
  const whys = [chain(4, {why: '真因 1 を長めに書く文章', trueCause: true, measure: '対策 1 をやや長めに書く文章'}), chain(2, {why: '真因 2 を長めに書く文章', trueCause: true})];
  const {verdict} = await laid({rcaCheck: 'strict'}, whyWhyTree('問題を少し長めの文で書く', whys as never, {id: 'ww'}));
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  assert.deepEqual(verdict.findings.filter(f => f.severity === 'warn' && f.rule === 'auto-fit-applied'), []);
});

test('ids: two trees without opts.id (or the same node id written twice in different trees) do not collide; with opts.id the nodes are anchors', async () => {
  const a = whyWhyTree('問題 A', WHYS), b = whyWhyTree('問題 B', WHYS);
  const {verdict} = await laid({}, a, b);
  assert.equal(verdict.problems.length, 0, verdict.problems.join('\n'));
  assert.ok(!verdict.findings.some(f => /another anchor/.test(f.message)));
  const c = whyWhyTree('問題 C', WHYS, {id: 'c'}), d = whyWhyTree('問題 D', WHYS, {id: 'd'});
  const both = await laid({}, c, d);
  const ids = both.t.anchors.map(x => x.id);
  assert.ok(ids.includes('c.w1') && ids.includes('c.w1.1.1.m') && !ids.includes('d.w1'));
  const named = treeOf(whyWhyTree('問題 E', [{id: 'mine', why: 'a'}, {why: 'b'}]));
  assert.deepEqual(named.unanchored, ['problem', 'w2'], 'a node with its own id is an anchor even without opts.id; the ones the tree named itself are not');
});

test('rca findings: no root, a measure on a non-root, a single chain, digging below the root', () => {
  assert.deepEqual(rcaOf(treeOf(whyWhyTree('x', WHYS))), ['whywhy-no-root']);
  const all = (w: object[]) => rcaOf(treeOf(whyWhyTree('x', w as never)));
  assert.deepEqual(all([{why: 'a', trueCause: true}, {why: 'b', trueCause: true}]), []);
  assert.deepEqual(all([{why: 'a', measure: '周知'}, {why: 'b', trueCause: true}]), ['whywhy-no-root', 'whywhy-measure-without-root']);
  assert.deepEqual(all([{why: 'a', because: [{why: 'b', trueCause: true}]}]), ['whywhy-single-chain']);
  const dug = all([{why: 'a', trueCause: true, because: [{why: 'b', trueCause: true}]}, {why: 'c', trueCause: true}]);
  assert.deepEqual(dug, ['whywhy-dig-below-root']);
  const single = treeOf(whyWhyTree('x', [{why: 'a', trueCause: true}]));
  assert.equal(single.rca!.findings[0].severity, 'info');
});

test('check: info by default, warn with rcaCheck: strict; the default output is clean (legend: auto included)', async () => {
  const ok = [{why: 'a', because: [{why: 'b', trueCause: true as const, measure: 'm'}]}, {why: 'c', trueCause: true as const}];
  const strict = await laid({rcaCheck: 'strict', legend: 'auto'}, whyWhyTree('問題', ok, {id: 'ww'}));
  assert.equal(strict.verdict.problems.length, 0, strict.verdict.problems.join('\n'));
  assert.deepEqual(strict.verdict.findings.filter(f => f.severity === 'warn'), []);
  const labels = (strict.all.find(b => b.type === 'legend') as unknown as {items: {label: string}[]}).items.map(i => i.label);
  assert.ok(labels.includes('根本原因') && labels.includes('対策') && labels.includes('断つ'));
  const bad = whyWhyTree('x', WHYS);
  const lax = (await laid({}, bad)).verdict.findings.filter(f => f.rule.startsWith('whywhy-'));
  assert.ok(lax.length === 1 && lax[0].severity === 'info');
  const hard = (await laid({rcaCheck: 'strict'}, bad)).verdict.findings.filter(f => f.rule.startsWith('whywhy-'));
  assert.ok(hard.length === 1 && hard[0].severity === 'warn');
});

// ---- review fixes ----
import {box, connect} from '../lib/dsl.ts';

test('without opts.id the tree is still checked: every node is in the laid-out anchors (only the registry skips the unnamed ones)', async () => {
  const {t} = await laid({}, whyWhyTree('問題', WHYS));
  assert.equal(t.anchors.length, t.nodes.length);
});

test('connect() reaches a node of a tree with opts.id (and the types allow it); verify now sees the tree, so a line through its boxes is reported', async () => {
  const d = diagram({theme: 'blue', title: 'x'}).add(box({title: '外', id: 'ext'})).add(...whyWhyTree('問題', WHYS, {id: 'ww'})).add(connect('ext', 'ww.w1.1.1'));
  const {verdict} = await checkDiagram(d);
  assert.ok(!verdict.problems.some(p => /unknown|no anchor|not found/.test(p)), 'the name resolves');
  assert.ok(verdict.problems.some(p => /overlaps "ww\./.test(p)), 'the line crosses boxes of the tree, and verify says so (it saw nothing of an unanchored tree before)');
});

test('a wide tree is not folded (that would put one "why n" on two levels): it fits or it says why not', async () => {
  const wide = Array.from({length: 9}, (_, i) => ({why: `答え ${i} を長めに書いた文`, trueCause: true as const}));
  await assert.rejects(() => laid({}, whyWhyTree('問題', wide, {id: 'ww'})), (e: Error) => /whyWhyTree\(\)/.test(e.message) && !/causeTree|fold is written/.test(e.message));
});

test('the reading lines appear with the tree (reveal)', () => {
  const bands = whyWhyTree('x', WHYS, {id: 'r', reveal: 2});
  assert.ok(bands.every(b => (b as {reveal?: number}).reveal === 2));
});

test('a node id that is one of the tree\'s own names says so', () => {
  assert.throws(() => whyWhyTree('x', [{id: 'w2', why: 'a'}, {why: 'b'}, {why: 'c'}]), /the names the tree gives/);
});

test('a tree with a measure draws a dashed line (the measure cuts the root cause)', async () => {
  const {svg} = await (await import('../lib/dsl.ts')).renderDiagram(diagram({theme: 'blue', title: 'x'}).add(...whyWhyTree('問題', WHYS, {id: 'ww'}) as unknown as never[]), {name: 'x.svg', budget: 'cacheOnly'});
  assert.match(svg, /stroke-dasharray="6,4"/);
});
