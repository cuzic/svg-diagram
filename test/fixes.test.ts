// Regression tests for layout bugs found while writing the compile-time checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, row, group, sequence, connect, swimlane, screens, wf, checkDiagram, closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const any = (f: unknown) => f as (...a: unknown[]) => unknown;

test('connect() before its boxes resolves after layout and lands where the reordered diagram puts it', async () => {
  const mk = (connectFirst: boolean) => {
    const d = diagram({theme: 'blue'});
    const bs = [box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})];
    d.add(...(connectFirst ? [connect('a:bottom', 'b:top'), ...bs] : [...bs, connect('a:bottom', 'b:top')]) as never[]);
    return d;
  };
  const first = (await checkDiagram(mk(true))).laidOut.connects, last = (await checkDiagram(mk(false))).laidOut.connects;
  assert.equal(first.length, 1);
  assert.deepEqual(first, last);
});

test('connect() to an id that never appears still fails, naming the id', async () => {
  const d = diagram({theme: 'blue'});
  d.add(...[connect('a', 'zzz'), box({id: 'a', title: 'A'})] as never[]);
  await assert.rejects(checkDiagram(d), /unknown anchor id "zzz"/);
});

test('screens(): items without `at` next to items with `at` fall back to row-major placement (no cols given)', async () => {
  const d = diagram({theme: 'blue'});
  d.add(any(screens)([{id: 'a', title: 'A', root: wf.text('a'), at: [0, 1]}, {id: 'b', title: 'B', root: wf.text('b')}]) as never);
  const sc = (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'screens');
  assert.ok(sc && sc.type === 'screens' && sc.anchors.length === 2);
});

test('swimlane(): a step font size below 14 throws, like box()', () => {
  const lanes = [{id: 'dev', label: 'D'}];
  assert.throws(() => any(swimlane)(lanes, [{id: 'a', lane: 'dev', title: 'A', size: 10}]), /font-size 10 is below the 14px floor/);
  assert.doesNotThrow(() => any(swimlane)(lanes, [{id: 'a', lane: 'dev', title: 'A', size: 14}]));
});

test('a connector running through a group title is a layout error', async () => {
  const mk = (align: 'left' | 'center') => {
    const d = diagram({theme: 'blue'});
    d.add(group([row([box({id: 'a', title: 'A'})])], {title: '上のグループ'}), group([row([box({id: 'c', title: 'C'})])], {title: '下のグループ', titleAlign: align}), connect('a:bottom@0.5', 'c:top@0.5'));
    return d;
  };
  assert.ok((await checkDiagram(mk('center'))).verdict.problems.some(p => /group title "下のグループ"/.test(p)));
  assert.ok((await checkDiagram(mk('left'))).verdict.ok);
});

test('a label wider than the gap between its two boxes is an error, not a silent overlap', async () => {
  const d = diagram({theme: 'blue'});
  d.add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true}));
  assert.ok((await checkDiagram(d)).verdict.problems.some(p => /overlaps its own end/.test(p)));
});

test('a self-call on the last actor puts its loop and label on the left, inside the frame', async () => {
  const d = diagram({theme: 'blue'});
  d.add(sequence([{id: 'A', label: 'A'}, {id: 'B', label: 'B'}], [{self: 'B', label: '自己呼び出しのラベルがかなり長いとき'}, {self: 'A', label: '左端'}]));
  const seq = (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'sequence');
  const [last, first] = (seq as {steps: {side: string}[]}).steps;
  assert.equal(last.side, 'left');
  assert.equal(first.side, 'right');
});

test('a widget whose state replaces its content grows to hold the state box (video + loading in a short cell)', async () => {
  const d = diagram({theme: 'blue'});
  d.add(screens([{id: 's', title: 'S', root: wf.col([wf.video({state: 'empty', stateNote: 'ここに説明が入る'})])}]));
  const r = await checkDiagram(d);
  assert.ok(r.verdict.ok, r.verdict.problems.join('\n'));
});

test('row() of groups: side by side, frames stretched to the tallest, nested groups and flex honoured, anchors usable', async () => {
  const d = diagram({theme: 'blue'});
  d.add(row([
    group([box({id: 'p1', title: 'P1'}), box({id: 'p2', title: 'P2'})], {title: 'A', id: 'ga', flex: 3}),
    group([box({id: 'p3', title: 'P3'})], {title: 'B', id: 'gb'}),
  ]), box({id: 'db', title: 'DB'}), connect('p3:bottom@0.9', 'db:top@0.9'));
  const r = await checkDiagram(d);
  assert.ok(r.verdict.ok, r.verdict.problems.join('\n'));
  const frames = r.laidOut.laidOut.filter(b => b.type === 'group') as {x: number; y: number; w: number; h: number}[];
  assert.equal(frames.length, 2);
  assert.equal(frames[0].h, frames[1].h);
  assert.equal(frames[0].y, frames[1].y);
  assert.ok(frames[0].x + frames[0].w < frames[1].x);
  assert.ok(Math.abs(frames[0].w / frames[1].w - 3) < 0.1 || frames[0].w > 2 * frames[1].w);
  const c = r.laidOut.connects[0];
  assert.ok(c.points[0].y <= frames[0].y + frames[0].h);
});
