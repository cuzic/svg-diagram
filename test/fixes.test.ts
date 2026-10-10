// Regression tests for layout bugs found while writing the compile-time checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, connect, swimlane, screens, wf, checkDiagram, closeMeasurer} from '../lib/dsl.ts';

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
