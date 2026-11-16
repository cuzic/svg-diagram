import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_LANES_TO_ORDER, bestLaneOrder, laneDistance, permutations} from '../lib/lane-order.ts';
import {checkDiagram, diagram, swimlane} from '../lib/dsl.ts';

test('permutations: every ordering once, the given order first', () => {
  assert.deepEqual(permutations([1, 2, 3])[0], [1, 2, 3]);
  assert.equal(new Set(permutations([1, 2, 3, 4]).map(String)).size, 24);
  assert.deepEqual(permutations([]), [[]]);
});

test('laneDistance: the sum of |position a - position b| over the pairs, in the order given', () => {
  assert.equal(laneDistance([0, 1, 2], [[0, 2], [1, 2]]), 3);
  assert.equal(laneDistance([0, 2, 1], [[0, 2], [1, 2]]), 2); // lane 2 now sits at position 1
  assert.equal(laneDistance([0, 1], []), 0);
});

test('bestLaneOrder: shortest hand-offs, a fixed lane keeps its place, a tie keeps the given order', () => {
  assert.deepEqual(bestLaneOrder(3, new Set(), [[0, 2], [2, 1]]), [0, 2, 1]);
  assert.deepEqual(bestLaneOrder(4, new Set([3]), [[0, 2], [2, 1], [1, 3]]), [0, 2, 1, 3]);
  assert.deepEqual(bestLaneOrder(3, new Set(), [[0, 1]]), [0, 1, 2]); // already as short as it gets: unchanged
  assert.deepEqual(bestLaneOrder(3, new Set(), []), [0, 1, 2]);
  assert.equal(MAX_LANES_TO_ORDER, 8);
});

const lanes = [{id: 'x', label: 'X'}, {id: 'y', label: 'Y'}, {id: 'z', label: 'Z'}];
const steps = [{id: 's1', lane: 'x', title: 's1'}, {id: 's2', lane: 'z', title: 's2'}, {id: 's3', lane: 'y', title: 's3'}];
const flows = [{from: 's1', to: 's2'}, {from: 's2:right', to: 's3'}];

test("swimlane({laneOrder: 'auto'}) puts the lanes in the order of the shortest hand-offs; without it the order is as given", () => {
  const order = (opts: object) => (swimlane(lanes, steps, {flows, ...opts})[0] as {lanes: {id: string}[]}).lanes.map(l => l.id);
  assert.deepEqual(order({}), ['x', 'y', 'z']);
  assert.deepEqual(order({laneOrder: 'auto'}), ['x', 'z', 'y']);
});

test("swimlane({laneOrder: 'auto'}): a fixed lane stays, and the figure no longer gets swimlane-lane-order", async () => {
  const withEnd = [...lanes, {id: 'end', label: 'END', fixed: true}];
  const st = [...steps, {id: 's4', lane: 'end', title: 's4'}];
  const fl = [...flows, {from: 's3', to: 's4'}];
  const plain = await checkDiagram(diagram({theme: 'blue'}).add(swimlane(withEnd, st, {flows: fl})));
  const auto = await checkDiagram(diagram({theme: 'blue'}).add(swimlane(withEnd, st, {flows: fl, laneOrder: 'auto'})));
  const rules = (r: Awaited<ReturnType<typeof checkDiagram>>) => r.verdict.findings.map(f => f.rule);
  assert.ok(rules(plain).includes('swimlane-lane-order'));
  assert.ok(!rules(auto).includes('swimlane-lane-order'));
  assert.equal(((swimlane(withEnd, st, {flows: fl, laneOrder: 'auto'})[0]) as {lanes: {id: string}[]}).lanes.at(-1)?.id, 'end');
});

test("swimlane({laneOrder}): only 'auto', at most 8 lanes, and an unknown step in a flow is still the error it was", () => {
  assert.throws(() => swimlane(lanes, steps, {laneOrder: 'best' as never}), /laneOrder must be 'auto'/);
  const many = Array.from({length: 9}, (_, i) => ({id: `l${i}`, label: `L${i}`}));
  assert.throws(() => swimlane(many, [{id: 'a', lane: 'l0', title: 'a'}], {laneOrder: 'auto'}), /up to 8 lanes/);
  assert.throws(() => swimlane(lanes, steps, {laneOrder: 'auto', flows: [{from: 's1', to: 'nope'}]}), /unknown step id/);
});
