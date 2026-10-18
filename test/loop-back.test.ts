import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, caption, chevron, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, steps} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const items = ['調べる', '直す', '確かめる', '出す', '振り返る'].map(title => ({title}));
const svgOf = async (d: ReturnType<typeof diagram>) => (await renderDiagram(d, {name: 'a.svg', budget: 'cacheOnly'})).svg;
const paths = (svg: string): string[] => [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);

test('steps({loopBack}) draws the same loop as a hand-written loop-under connect', async () => {
  const mine = diagram({theme: 'blue', title: 't'}).add(steps(items, {loopBack: {from: 4, to: 2, label: '差し戻し'}}));
  const hand = diagram({theme: 'blue', title: 't'}).add(steps(items, {id: 's'}), connect('s#4:bottom', 's#2:bottom', {route: 'loop-under', label: '差し戻し'}));
  assert.deepEqual(paths(await svgOf(mine)), paths(await svgOf(hand)));
  const verdict = (await checkDiagram(mine)).verdict;
  assert.deepEqual(verdict.problems, []);
  assert.ok(!verdict.findings.some(f => f.rule === 'edge-crossings'));
});

test('two loops that nest are stepped apart on their own: no overlap, no crossing', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(steps(items, {loopBack: [{from: 5, to: 1, label: '最初から'}, {from: 4, to: 2, label: '差し戻し'}]}));
  const r = await checkDiagram(d);
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(!r.verdict.findings.some(f => f.rule === 'edge-crossings'), JSON.stringify(r.verdict.findings.map(f => f.message)));
  const hs = r.laidOut.connects.map(c => Math.max(...c.points.map(p => p.y)));
  assert.equal(new Set(hs.map(h => Math.round(h))).size, 2, 'the loops run at two heights');
  assert.ok(hs[0] > hs[1] || hs[1] > hs[0]);
});

test('loopBack is checked where it is written', () => {
  assert.throws(() => steps(items, {loopBack: {from: 2, to: 4}}), /must come after to 2|from 2 must come after to 4/);
  assert.throws(() => steps(items, {loopBack: {from: 3, to: 3}}), /a loop goes back/);
  assert.throws(() => steps(items, {loopBack: {from: 9, to: 2}}), /is not a step \(1\.\.5\)/);
  assert.throws(() => steps(items, {loopBack: {from: 4.5, to: 2}}), /is not a step/);
  assert.throws(() => steps(items, {loopBack: []}), /loopBack is empty/);
  assert.throws(() => steps(items, {loopBack: {from: 4, to: 2, label: ''}}), /label is a non-empty one-line text/);
  assert.throws(() => steps(items, {loopBack: {from: 4, to: 2, line: 'wavy' as never}}), /solid, dashed or dotted/);
  assert.throws(() => steps(items, {loopBack: [{from: 4, to: 2}, {from: 5, to: 3}]}), /cross each other/);
  assert.throws(() => steps(items, {loopBack: {from: 'b' as never, to: 2}}), /is not a step/);
  assert.doesNotThrow(() => steps(items, {loopBack: [{from: 4, to: 2}, {from: 4, to: 3}]}), 'sharing an end is nesting');
  assert.throws(() => row([group([box({title: 'a'})] as never), box({title: 'b'})], {loopBack: {from: 2, to: 1}}), /needs a row of boxes/);
});

test('row({loopBack}) of boxes works like steps', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(row([box({title: 'a'}), box({title: 'b'}), box({title: 'c'})], {arrows: 'between', loopBack: {from: 3, to: 1, label: '戻る'}}));
  const r = await checkDiagram(d);
  assert.deepEqual(r.verdict.problems, []);
  assert.equal(r.laidOut.connects.length, 1);
});

test('chevron({loopBack}): by number or by item id; a vertical chevron is refused', async () => {
  const labels = ['計画', '実装', '検証', '公開'];
  const byId = chevron(labels.map((label, i) => ({label, id: `p${i}`})), {loopBack: {from: 'p2', to: 'p0', label: 'やり直し'}});
  const byNo = chevron(labels.map(label => ({label})), {loopBack: {from: 3, to: 1, label: 'やり直し'}});
  for (const c of [byId, byNo]) {
    const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(c as never));
    assert.deepEqual(r.verdict.problems, []);
    assert.equal(r.laidOut.connects.length, 1);
  }
  assert.throws(() => chevron(labels.map((label, i) => ({label, id: `p${i}`})), {loopBack: {from: 'zz', to: 'p0'}}), /not an item id of this chevron \(p0, p1, p2, p3\)/);
  assert.throws(() => chevron(labels.map(label => ({label})), {direction: 'vertical', loopBack: {from: 3, to: 1}}), /horizontal flows/);
});

test('a steps() inside a group is expanded too, and a diagram without loopBack is untouched', async () => {
  const inGroup = diagram({theme: 'blue', title: 't'}).add(group([caption('流れ'), steps(items, {loopBack: {from: 3, to: 1}})] as never, {title: 'g'}));
  assert.equal((await checkDiagram(inGroup)).laidOut.connects.length, 1);
  const plain = diagram({theme: 'blue', title: 't'}).add(steps(items));
  assert.equal((await checkDiagram(plain)).laidOut.connects.length, 0);
});
