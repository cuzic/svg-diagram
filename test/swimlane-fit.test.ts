import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import type {LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';

test.after(() => closeMeasurer());

const lanes = [{id: 'a', label: '申請者'}, {id: 'm', label: '上長'}, {id: 'f', label: '経理'}];
const steps = [
  {id: 's1', lane: 'a', title: '精算書を作成', body: '領収書を添付'}, {id: 's2', lane: 'm', title: '内容を承認'}, {id: 's3', lane: 'f', title: '領収書を照合'},
  {id: 's4', lane: 'f', title: '振込を手配', body: '月末締め'}, {id: 's5', lane: 'a', title: '入金を確認'}, {id: 's6', lane: 'm', title: '月次で確認'},
  {id: 's7', lane: 'a', title: '控えを保管'}, {id: 's8', lane: 'f', title: '仕訳を計上'},
];

const laid = async (opts: {fit?: 'shrink'; labelW?: number; colGap?: number}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, steps, opts)));
  return {frame: laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane, boxes: laidOut.laidOut.filter(b => b.type === 'box') as LaidOutBox[], verdict};
};

test("swimlane({fit: 'shrink'}) narrows the label column and gaps so the columns get wider", async () => {
  const [plain, shrunk] = await Promise.all([laid({}), laid({fit: 'shrink'})]);
  assert.equal(plain.frame.labelW, 128);
  assert.ok(shrunk.frame.labelW < 128);
  assert.ok(shrunk.boxes[0]!.w > plain.boxes[0]!.w, 'a step is wider');
  assert.deepEqual(shrunk.verdict.problems, []);
});

test("swimlane({fit: 'shrink'}) leaves sizes alone while the columns are comfortable; an explicit labelW is only ever reduced", async () => {
  const fewSteps = steps.slice(0, 3);
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, fewSteps, {fit: 'shrink', labelW: 100})));
  assert.equal((laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane).labelW, 100);
  const small = await laid({fit: 'shrink', labelW: 80});
  assert.ok(small.frame.labelW <= 80);
});

test('swimlane(): fit other than shrink throws', () => {
  assert.throws(() => swimlane(lanes, steps, {fit: 'auto' as never}), /fit must be 'shrink'/);
});
