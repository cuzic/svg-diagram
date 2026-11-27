import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import type {LaidOutConnect} from '../lib/types/containers.ts';
import type {LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';

test.after(() => closeMeasurer());

const lanes = [{id: 'a', label: '担当A'}, {id: 'b', label: '担当B'}];
const steps: {id: string; lane: string; title: string; col: number}[] = [
  {id: 'x1', lane: 'a', title: '受付', col: 1}, {id: 'p', lane: 'b', title: '下書き', col: 2},
  {id: 'q', lane: 'b', title: '点検', col: 3}, {id: 'r', lane: 'b', title: '仕上げ', col: 4},
];

const laid = async (flows: {from: string; to: string; label?: string}[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...swimlane(lanes, steps, {flows} as never)));
  return {
    frame: laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane,
    boxes: laidOut.laidOut.filter(b => b.type === 'box') as LaidOutBox[],
    back: laidOut.connects.at(-1) as LaidOutConnect,
    verdict,
  };
};
const flows = (back: {from: string; to: string; label?: string}) => [{from: 'x1', to: 'p'}, {from: 'p', to: 'q'}, {from: 'q', to: 'r'}, back];

test('swimlane: a labelled flow back along one lane runs under the boxes between and its label overlaps none', async () => {
  const {boxes, back, frame, verdict} = await laid(flows({from: 'r', to: 'p:bottom', label: 'やり直し'}));
  assert.deepEqual(verdict.problems, []);
  const lowest = Math.max(...boxes.filter(b => b.y >= frame.lanes[1]!.y).map(b => b.y + b.h));
  assert.ok(back.points.every(pt => pt.y >= lowest - 0.5 || pt === back.points[0] || pt === back.points.at(-1)), 'the run is under the boxes');
  const lane = frame.lanes[1]!;
  assert.ok(Number.isFinite(lowest), 'the lane has boxes');
  assert.ok(back.labelBox !== undefined && back.labelBox.y + back.labelBox.h <= lane.y + lane.h, 'the label stays inside its lane (the lane grew for it)');
});

test('swimlane: a flow back past a box in the same lane, with no side given, also runs under the boxes', async () => {
  const {verdict, back} = await laid(flows({from: 'r', to: 'p', label: 'やり直し'}));
  assert.deepEqual(verdict.problems, []);
  assert.equal(back.route, 'loop-under');
});

test('swimlane: a way back to the next box (nothing between) keeps its side-to-side route', async () => {
  const {back} = await laid([{from: 'q', to: 'p'}]);
  assert.equal(back.route, 'elbow');
});
