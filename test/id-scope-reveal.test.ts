import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, checkDiagram, chevron, closeMeasurer, connect, diagram, gantt} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// ADR 0012 C. The old reveal table was keyed by the bare id and the later band overwrote the earlier: with two bands that both have
// a `p0`, the stage of the first was lost. Now it is keyed by the full name.
const plan = (opts: object) => chevron([{id: 'p0', label: '準備'}, {id: 'p1', label: '実施'}], {scope: 'plan', ...opts});
const sched = (opts: object) => gantt([{id: 'p0', label: '準備', start: '2026-10-05', end: '2026-10-16'}], {scope: 'sched', ...opts});

test('two bands with the same bare id keep their own stages', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 3}), sched({reveal: 2}), connect('plan.p0:bottom', 'sched.p0:top'), connect('sched.p0:right', 'plan.p1:left')));
  assert.deepEqual(laidOut.connects.map(c => c.reveal), [3, 3]); // the arrow comes with the later of its ends, not with whichever band was written last
  const {laidOut: swapped} = await checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 2}), sched({reveal: 3}), connect('plan.p0:bottom', 'sched.p0:top')));
  assert.equal(swapped.connects[0].reveal, 3);
});

test('a bare id that only one scoped item has is found in the reveal table', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 3}), sched({reveal: 2}), connect('p1:bottom', 'sched.p0:top')));
  assert.equal(laidOut.connects[0].reveal, 3);
});

test('until goes with the scoped end that vanishes', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 1, until: 4}), sched({reveal: 2}), connect('plan.p0:bottom', 'sched.p0:top')));
  assert.equal(laidOut.connects[0].until, 4);
  const {laidOut: other} = await checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 1}), sched({reveal: 2, until: 5}), connect('plan.p0:bottom', 'sched.p0:top')));
  assert.equal(other.connects[0].until, 5);
});

test('a bare id that two scoped bands have is an error in reveal too', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plan({reveal: 2}), sched({reveal: 3}), connect('p0', 'p1'))), /ambiguous anchor id "p0": plan\.p0, sched\.p0/);
});

// a gantt task is a connect() end but not a spotlight target (the figure is lit whole), so the spotlight tests use a second chevron
const two = (opts: object) => chevron([{id: 'p0', label: '準備'}], {scope: 'sched', ...opts});

test('bars: the bars of two scoped bands keep their own stages', async () => {
  const mk = (scope: string, reveal: number) => bars([{label: 'a', value: 1, id: 'k', reveal}], {scope});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(mk('b1', 4), mk('b2', 2), connect('b1.k', 'b2.k')));
  assert.equal(laidOut.connects[0].reveal, 4);
});

test('spotlight: a qualified name lights its own item, a unique bare name too, an ambiguous one is an error', async () => {
  const mk = (spotlight: string) => diagram({theme: 'blue', spotlight}).add(plan({}), two({}), connect('plan.p0:bottom', 'sched.p0:top'));
  const lit = async (spot: string) => {
    const {laidOut} = await checkDiagram(mk(spot));
    return [laidOut.laidOut.find(b => b.type === 'chevron'), laidOut.laidOut.find(b => b.type === 'chevron' && b !== laidOut.laidOut.find(x => x.type === 'chevron'))].map(b => !(b as {dim?: boolean}).dim);
  };
  assert.deepEqual(await lit('plan.p0'), [true, false]);
  assert.deepEqual(await lit('sched.p0'), [false, true]);
  assert.deepEqual(await lit('p1'), [true, false]); // only plan has a p1
  await assert.rejects(checkDiagram(mk('p0')), /ambiguous anchor id "p0": plan\.p0, sched\.p0/);
  await assert.rejects(checkDiagram(mk('plan.zzz')), /unknown anchor id "plan\.zzz"/);
});

test('spotlight: the connector between a lit scoped item and a dim one follows the edges option', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: 'plan.p0'}).add(plan({}), two({}), connect('plan.p0:bottom', 'sched.p0:top')));
  assert.notEqual(laidOut.connects[0].dim, true); // 'touching' (the default): one lit end is enough
  const {laidOut: between} = await checkDiagram(diagram({theme: 'blue', spotlight: {ids: 'plan.p0', edges: 'between'}}).add(plan({}), two({}), connect('plan.p0:bottom', 'sched.p0:top')));
  assert.equal(between.connects[0].dim, true);
});
