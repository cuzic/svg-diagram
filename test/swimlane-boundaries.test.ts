import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import type {SwimlaneOpts, LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());

const lanes = [{id: 'c', label: '顧客の行動'}, {id: 'f', label: '表の業務（接点）'}, {id: 'b', label: '裏の業務'}];
const steps = [{id: 's1', lane: 'c', title: '注文する'}, {id: 's2', lane: 'f', title: '受け付ける'}, {id: 's3', lane: 'b', title: '準備する'}];
const laid = async (opts: SwimlaneOpts) => {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, steps, opts)));
  return {r, f: r.laidOut.laidOut.find((b): b is LaidOutSwimlane => b.type === 'swimlane')!};
};

test('swimlane boundaries: a line sits on the border after the named lane, with its chip text', async () => {
  const {r, f} = await laid({boundaries: [{after: 'c', label: '相互作用線'}, {after: 'f', label: '可視線'}]});
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(f.boundaries!.map(b => b.label), ['相互作用線', '可視線']);
  assert.deepEqual(f.boundaries!.map(b => b.y), [f.lanes[1]!.y, f.lanes[2]!.y]);
});

test('swimlane boundaries: a lane next to a named boundary is tall enough that the chip does not touch its label', async () => {
  const {f} = await laid({boundaries: [{after: 'c', label: '相互作用線'}]});
  const by = f.boundaries![0]!.y, chipTop = by - 12;
  const upper = f.lanes[0]!, lower = f.lanes[1]!;
  assert.ok(upper.labelTop + upper.labelLines.length * 14 * 1.4 * 1.2 <= by, 'label stays above the line');
  assert.ok(upper.y + upper.h === by && lower.labelTop >= by + 10, 'label below stays clear of the chip');
  assert.ok(chipTop < by);
});

test('swimlane boundaries: an unnamed boundary is just a line, and none leaves the output unchanged', async () => {
  const a = await laid({boundaries: [{after: 'c'}]});
  assert.equal(a.f.boundaries![0]!.label, undefined);
  const plain = await laid({}), none = await laid({boundaries: []});
  assert.equal(plain.f.boundaries, undefined);
  assert.equal(none.f.h, plain.f.h);
});

test('swimlane boundaries: mistakes throw', () => {
  const make = (opts: SwimlaneOpts) => () => swimlane(lanes, steps, opts);
  assert.throws(make({boundaries: [{after: 'zzz'}]}), /not a lane id/);
  assert.throws(make({boundaries: [{after: 'b'}]}), /last lane/);
  assert.throws(make({boundaries: [{after: 'c'}, {after: 'c'}]}), /two lines/);
  assert.throws(make({boundaries: [{after: 'c', label: ' '}]}), /empty/);
  assert.throws(make({boundaries: [{after: 'c'}], laneOrder: 'auto'}), /laneOrder/);
});

test('swimlane boundaries: a label too long for the label column on one line throws', async () => {
  await assert.rejects(laid({boundaries: [{after: 'c', label: '顧客と会社が接する所の線'}]}), /does not fit/);
});
