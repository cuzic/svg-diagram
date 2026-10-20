import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {causalLoop, causeTree, checkDiagram, classDiagram, closeMeasurer, dependencyNetwork, diagram, pdpc, pert, relationDiagram, stateDiagram} from '../lib/dsl.ts';
import type {LaidOutCause, LaidOutClasses, LaidOutStates} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const bendsOf = (pts: {x: number; y: number}[]): number => pts.slice(1, -1).filter((p, i) => !((pts[i]!.x === p.x && p.x === pts[i + 2]!.x) || (pts[i]!.y === p.y && p.y === pts[i + 2]!.y))).length;
const N = (id: string) => ({id, label: id});

test('straighten: a value that is not true or false is refused by every auto-laid-out figure', () => {
  const bad = {straighten: 'yes' as never};
  assert.throws(() => causeTree([N('a'), N('b')], [{from: 'a', to: 'b'}], bad), /straighten must be true or false/);
  assert.throws(() => relationDiagram([N('a'), N('b')], [{from: 'a', to: 'b'}], bad), /straighten must be true or false/);
  assert.throws(() => pdpc([N('a'), N('b')], [{from: 'a', to: 'b'}], bad), /straighten must be true or false/);
  assert.throws(() => stateDiagram([N('a'), N('b')], [{from: 'a', to: 'b'}], bad), /straighten must be true or false/);
  assert.throws(() => classDiagram([N('a'), N('b')], [{from: 'a', to: 'b', kind: 'inherit'} as never], bad), /straighten must be true or false/);
  assert.throws(() => pert([{id: 'a', label: 'a', duration: 1}], bad), /straighten must be true or false/);
  assert.throws(() => dependencyNetwork([N('a'), N('b')], [{from: 'a', to: 'b', type: 't'}], bad), /straighten must be true or false/);
  assert.throws(() => causalLoop([N('a'), N('b')], [{from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'a', polarity: '+'}], bad), /straighten must be true or false/);
});

const relation = (opts: object) => relationDiagram(
  ['late', 'rush', 'multi', 'sw', 'plan', 'est', 'skill', 'over', 'tired'].map(N),
  [['rush', 'multi'], ['multi', 'sw'], ['sw', 'late'], ['est', 'plan'], ['plan', 'rush'], ['est', 'over'], ['est', 'multi'], ['skill', 'sw'], ['skill', 'late'], ['over', 'tired'], ['tired', 'late'], ['tired', 'plan'], ['plan', 'late']].map(([from, to]) => ({from: from!, to: to!})),
  {problem: 'late', maxNodeW: 150, ...opts},
);

test('straighten: false keeps the plain layout, which is never fewer corners than the default (a relations diagram)', async () => {
  const on = await checkDiagram(diagram({theme: 'blue'}).add(relation({}))), off = await checkDiagram(diagram({theme: 'blue'}).add(relation({straighten: false})));
  assert.deepEqual(on.verdict.problems, []);
  assert.deepEqual(off.verdict.problems, []);
  const total = (r: typeof on): number => (r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause).edges.reduce((s, e) => s + bendsOf(e.points), 0);
  assert.ok(total(on) <= total(off), `${total(on)} corners straightened, ${total(off)} plain`);
  assert.ok(total(on) < total(off), 'the relations diagram has corners to save');
  assert.notDeepEqual(on.laidOut.laidOut, off.laidOut.laidOut);
  // a figure the straightening does not improve is the same either way, and straighten: true is the default
  const flow = (opts: object) => stateDiagram([N('a'), N('b'), N('c')], [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}], {initial: 'a', ...opts});
  const f1 = await checkDiagram(diagram({theme: 'blue'}).add(flow({}))), f2 = await checkDiagram(diagram({theme: 'blue'}).add(flow({straighten: false}))), f3 = await checkDiagram(diagram({theme: 'blue'}).add(flow({straighten: true})));
  assert.deepEqual(f1.laidOut.laidOut, f2.laidOut.laidOut);
  assert.deepEqual(f1.laidOut.laidOut, f3.laidOut.laidOut);
});

test('straighten: false is accepted by the state and class diagrams and the networks, and they still verify', async () => {
  for (const straighten of [false, true]) {
    const s = await checkDiagram(diagram({theme: 'blue'}).add(stateDiagram([N('a'), N('b'), N('c'), N('d')], [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'a', to: 'd'}, {from: 'd', to: 'b'}], {initial: 'a', straighten})));
    assert.deepEqual(s.verdict.problems, []);
    assert.ok(s.laidOut.laidOut.some(b => b.type === 'states') && (s.laidOut.laidOut.find(b => b.type === 'states') as LaidOutStates).edges.length >= 5);
    const c = await checkDiagram(diagram({theme: 'blue'}).add(classDiagram([N('A'), N('B'), N('C')], [{from: 'B', to: 'A', kind: 'inherit'}, {from: 'C', to: 'A', kind: 'inherit'}] as never, {straighten})));
    assert.deepEqual(c.verdict.problems, []);
    assert.ok((c.laidOut.laidOut.find(b => b.type === 'classes') as LaidOutClasses).edges.length === 2);
    const p = await checkDiagram(diagram({theme: 'blue'}).add(pert([{id: 'a', label: 'A', duration: 2}, {id: 'b', label: 'B', duration: 3, predecessors: ['a']}], {straighten})));
    assert.deepEqual(p.verdict.problems, []);
  }
});
