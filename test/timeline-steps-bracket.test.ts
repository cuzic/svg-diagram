import test from 'node:test';
import assert from 'node:assert/strict';
import {box, bracket, callout, checkDiagram, closeMeasurer, diagram, renderDiagram, row, steps, timeline} from '../lib/dsl.ts';
import {numericTicks} from '../lib/timeline.ts';
import type {LaidOutTimeline, NumericTimelineOpts} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// ---- #93 numeric timeline ----------------------------------------------------------------------------------------------------------
const MS = {unit: 'ms', from: 0, to: 700, lanes: ['UI', '通信'], events: [{at: 44, label: '再初期化', lane: 'UI', tone: 'danger' as const}, {at: 388, label: '再初期化', lane: 'UI'}], spans: [{from: 44, to: 388, dim: true, lane: 'UI'}, {from: 120, to: 560, label: '応答待ち', lane: '通信'}]};
const laidMs = async (opts: NumericTimelineOpts) => {
  const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(timeline(opts)));
  return {t: r.laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!, verdict: r.verdict};
};

test('numericTicks: 1/2/5 steps, at most max ticks, no float noise', () => {
  assert.deepEqual(numericTicks(0, 700, undefined, 8), [0, 100, 200, 300, 400, 500, 600, 700]);
  assert.deepEqual(numericTicks(0, 1, undefined, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(numericTicks(10, 50, 20, 8), [20, 40]);
});

test('timeline({unit: "ms"}): lanes, events, a dimension line that reads its own length, ticks with the unit', async () => {
  const {t, verdict} = await laidMs(MS);
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  const texts = t.texts.map(x => x.text);
  for (const s of ['UI', '通信', '44ms', '388ms', '344ms', '応答待ち', '0ms', '700ms']) assert.ok(texts.includes(s), `${s} in ${texts.join(',')}`);
  assert.equal(t.dims!.length, 1);
  assert.equal(t.bars!.length, 1);
  assert.equal(t.dots.length, 2);
  // x is proportional to the value
  const [a, b] = t.dots.map(d => d.x);
  assert.ok(Math.abs((b - a) / (t.axis.x2 - t.axis.x1) - 344 / 700) < 1e-6);
  const r = await renderDiagram(diagram({theme: 'blue', title: 't'}).add(timeline(MS)), {name: 't', budget: 'measure'});
  assert.deepEqual(r.xml, []);
  assert.match(r.svg, /344ms/);
});

test('timeline numeric: one unnamed lane when lanes is left out; events that crowd stack on levels without overlapping', async () => {
  const {t, verdict} = await laidMs({unit: 's', from: 0, to: 10, events: [{at: 1, label: '開始'}, {at: 1.2, label: '準備完了'}, {at: 1.4, label: '最初の応答'}]});
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  assert.equal(t.dots.length, 3);
  assert.ok(t.texts.some(x => x.text === '1.2s'));
});

test('timeline numeric: bad input stops with a message', () => {
  const bad = (o: object, re: RegExp) => assert.throws(() => timeline({unit: 'ms', from: 0, to: 100, ...o} as never), re);
  bad({from: 100}, /from \(100\) must be less than to/);
  bad({events: [{at: 200, label: 'x'}]}, /outside the axis/);
  bad({events: [{at: 5, label: 'x', lane: 'Q'}], lanes: ['A']}, /not one of lanes/);
  bad({spans: [{from: 50, to: 10}]}, /must be less than to/);
  bad({lanes: ['A', 'A']}, /distinct/);
  assert.throws(() => timeline({from: 0, to: 100} as never), /unit is required/);
});

test('timeline: the date form is untouched by the numeric one', () => {
  const t = timeline({from: '2026', to: '2029', now: {at: '2026-10'}, deadline: {at: '2028-03', label: '期限'}});
  assert.equal('unit' in t, false);
});

// ---- #94 steps ---------------------------------------------------------------------------------------------------------------------
test('steps(): numbered badges, one highlighted step, arrows between, an ordinary row', () => {
  const s = steps([{title: 'a'}, {title: 'b', body: 'x', icon: 'shield', tag: 't'}, {title: 'c'}], {numbered: true, highlight: 3, id: 'st'});
  assert.equal(s.type, 'row');
  assert.equal(s.arrows, 'between');
  assert.deepEqual(s.children.map(c => c.step), [1, 2, 3]);
  assert.deepEqual(s.children.map(c => c.tone), [undefined, undefined, 'danger']);
  assert.equal(s.children[1].tag, 't');
  assert.ok(s.children[1].iconGlyph);
  assert.equal(s.col(2).id, 'st#2');
  const plain = steps([{title: 'a'}, {title: 'b'}], {arrows: false});
  assert.equal(plain.arrows, 'none');
  assert.equal(plain.children[0].step, undefined);
});

test('steps(): bad input stops', () => {
  assert.throws(() => steps([{title: 'a'}]), /at least 2/);
  assert.throws(() => steps([{title: 'a'}, {title: 'b'}], {highlight: 3}), /highlight/);
  assert.throws(() => steps([{title: 'a'}, {title: ''}]), /needs a title/);
});

test('steps() lays out clean and joins with connect/bracket by column', async () => {
  const s = steps([{title: 'a'}, {title: 'b'}, {title: 'c'}], {numbered: true, id: 's'});
  const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(s, bracket(s.col(1).left, s.col(2).right, {label: '対象'})));
  assert.ok(r.verdict.ok, r.verdict.problems.join('\n'));
});

// ---- #99 bracket / callout ---------------------------------------------------------------------------------------------------------
const two = () => row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'})], {gap: 40});
test('bracket(): runs under the two boxes from the left of one to the right of the other, label below it, space reserved', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(two(), bracket('a:left', 'b:right', {label: 'この区間だけ'}), box({id: 'next', title: '次'}));
  const r = await checkDiagram(d);
  assert.ok(r.verdict.ok, r.verdict.problems.join('\n'));
  const c = r.laidOut.connects.find(x => x.annot)!;
  assert.equal(c.annot!.kind, 'bracket');
  assert.equal(c.points.length, 4);
  const rowBox = r.laidOut.laidOut.find(x => x.type === 'row')!;
  assert.ok(c.points[1].y > rowBox.y + rowBox.h, 'the bar is under the boxes');
  assert.equal(c.points[0].x, c.points[1].x);
  const next = r.laidOut.laidOut.find(x => x.type === 'box')!;
  assert.ok(next.y >= c.labelBox!.y + c.labelBox!.h, 'the next band starts under the label');
  assert.match((await renderDiagram(d, {name: 't', budget: 'measure'})).svg, /この区間だけ/);
});

test('bracket(side: above): over the boxes; a bad side or an empty label stops', async () => {
  const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(two(), bracket('b:left', 'c:right', {side: 'above', label: 'x'})));
  const c = r.laidOut.connects.find(x => x.annot)!;
  assert.ok(c.points[1].y < r.laidOut.laidOut.find(x => x.type === 'row')!.y);
  assert.throws(() => bracket('a:left', 'b:right', {side: 'left' as never}), /side/);
  assert.throws(() => bracket('a:left', 'b:right', {label: ' '}), /label/);
});

test('callout(): a bubble with a leader to the target, on each side', async () => {
  for (const side of ['above', 'below', 'left', 'right'] as const) {
    const d = diagram({theme: 'blue', title: 't', gap: 40}).add(row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'})], {gap: 120, justify: 'center', width: 100}), callout('b', {text: '344ms かかる', side}));
    const r = await checkDiagram(d);
    const c = r.laidOut.connects.find(x => x.annot)!;
    assert.equal(c.points.length, 2, side);
    const b = r.laidOut.laidOut.find(x => x.type === 'row')!.children[1];
    const end = c.points[1];
    assert.ok(end.x >= b.x - 6 && end.x <= b.x + b.w + 6 && end.y >= b.y - 6 && end.y <= b.y + b.h + 6, `${side}: the leader ends at the target`);
    assert.ok(c.chipBox, side);
    assert.match((await renderDiagram(d, {name: 't', budget: 'measure'})).svg, /344ms かかる/);
  }
  assert.throws(() => callout('b', {text: ''}), /text is required/);
  assert.throws(() => callout('b', {text: 'x', side: 'up' as never}), /side/);
});

test('bracket(): an unknown id names the box', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue', title: 't'}).add(two(), bracket('zzz:left', 'b:right') as never)), /unknown anchor id "zzz"/);
});
