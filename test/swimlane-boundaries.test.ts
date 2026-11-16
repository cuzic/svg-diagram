import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import {renderDiagram} from '../lib/dsl.ts';
import {boundaryChipH} from '../lib/layout-util.ts';
import type {SwimlaneOpts, LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());

const lanes = [{id: 'c', label: '顧客の行動'}, {id: 'f', label: '表の業務（接点）'}, {id: 'b', label: '裏の業務'}];
const steps = [{id: 's1', lane: 'c', title: '注文する'}, {id: 's2', lane: 'f', title: '受け付ける'}, {id: 's3', lane: 'b', title: '準備する'}];
const laid2 = async (opts: SwimlaneOpts, st: typeof steps = steps) => {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, st, opts)));
  return {r, f: r.laidOut.laidOut.find((b): b is LaidOutSwimlane => b.type === 'swimlane')!};
};
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
  const {r, f} = await laid({boundaries: [{after: 'c', label: '相互作用線'}]});
  const note = 14, size = 16, by = f.boundaries![0]!.y, half = boundaryChipH(note) / 2, [upper, lower] = [f.lanes[0]!, f.lanes[1]!];
  assert.deepEqual(r.verdict.problems, []);
  assert.equal(upper.y + upper.h, by);
  assert.ok(upper.labelTop + upper.labelLines.length * size * 1.4 <= by - half + 1, 'the upper label stays above the chip');
  assert.ok(lower.labelTop >= by + half - 1, 'the lower label stays below the chip');
});

test('swimlane boundaries: none, [] and an unnamed line leave the rest of the figure as it was (byte for byte without a boundary)', async () => {
  const svg = async (opts: SwimlaneOpts) => (await renderDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, steps, opts)), {name: 's.svg', budget: 'cacheOnly'})).svg;
  const plain = await svg({}), empty = await svg({boundaries: []});
  assert.equal(empty, plain);
  assert.equal((await svg({fit: 'shrink'})).includes('stroke-dasharray="10,6"'), false);
  assert.ok((await svg({boundaries: [{after: 'c'}]})).includes('stroke-dasharray="10,6"'));
});

test("swimlane boundaries: fit: 'shrink' never narrows the label column below the longest line name", async () => {
  const many = Array.from({length: 7}, (_v, i) => ({id: `x${i}`, lane: 'c', title: `手順${i}`}));
  const {r, f} = await laid2({boundaries: [{after: 'c', label: '内部相互作用線'}], fit: 'shrink', labelW: 144}, many);
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(f.labelW >= 134, `labelW ${f.labelW}`);
});

test('swimlane boundaries: `between` must name two lanes that are next to each other; with laneOrder only `between` works', () => {
  const make = (opts: SwimlaneOpts) => () => swimlane(lanes, steps, opts);
  assert.doesNotThrow(make({boundaries: [{between: ['f', 'c']}]}));
  assert.throws(make({boundaries: [{between: ['c', 'b']}]}), /not next to each other/);
  assert.throws(make({boundaries: [{between: ['c', 'zzz']}]}), /not a lane id/);
  assert.throws(make({boundaries: [{after: 'c'}], laneOrder: 'auto'}), /between/);
  assert.doesNotThrow(make({boundaries: [{between: ['c', 'f']}], laneOrder: 'auto'}));
});

test('swimlane boundaries: without labelW the label column grows to the longest name; an explicit labelW that is too small throws', async () => {
  const {r, f} = await laid({boundaries: [{after: 'c', label: '内部相互作用線'}]});
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(f.labelW >= 134, `labelW ${f.labelW}`);
  await assert.rejects(laid({boundaries: [{after: 'c', label: '内部相互作用線'}], labelW: 128}), /needs a label column of 134px/);
  assert.equal((await laid({boundaries: [{after: 'c'}]})).f.labelW, 128);
});

test('swimlane boundaries: malformed entries throw with a clear message', () => {
  const make = (b: unknown) => () => swimlane(lanes, steps, {boundaries: b as never});
  assert.throws(make([null]), /each one is/);
  assert.throws(make([{label: 'x'}]), /either `after` or `between`/);
  assert.throws(make([{after: 'c', between: ['c', 'f']}]), /either `after` or `between`/);
  assert.throws(make([{between: 'cf'}]), /two lane ids/);
  assert.throws(make([{between: ['c', 'c']}]), /same lane twice/);
});

test('swimlane boundaries: mistakes throw', () => {
  const make = (opts: SwimlaneOpts) => () => swimlane(lanes, steps, opts);
  assert.throws(make({boundaries: [{after: 'zzz'}]}), /not a lane id/);
  assert.throws(make({boundaries: [{after: 'b'}]}), /last lane/);
  assert.throws(make({boundaries: [{after: 'c'}, {between: ['c', 'f']}]}), /two lines/);
  assert.throws(make({boundaries: [{after: 'c', label: ' '}]}), /non-empty/);
  assert.throws(make({boundaries: [{after: 'c', label: 3 as never}]}), /non-empty/);
  assert.throws(make({boundaries: {after: 'c'} as never}), /must be a list/);
});

test('swimlane boundaries: a name wider than the label column allows throws, also for a word that cannot be broken', async () => {
  await assert.rejects(laid({boundaries: [{after: 'c', label: '顧客と会社が接する所の線'}], labelW: 128}), /needs a label column/);
  await assert.rejects(laid({boundaries: [{after: 'c', label: 'LineOfVisibilityXX'}], labelW: 100}), /needs a label column/);
  const ok = await laid({boundaries: [{after: 'c', label: '可視線'}], labelW: 100});
  assert.deepEqual(ok.r.verdict.problems, []);
});
