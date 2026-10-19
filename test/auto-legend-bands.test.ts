import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {bpmn, checkDiagram, classDiagram, closeMeasurer, diagram, tree} from '../lib/dsl.ts';
import type {LaidOutLegend} from '../lib/types/containers.ts';

test.after(() => closeMeasurer());

const toneItems = async (...bands: unknown[]) => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', legend: 'auto'}).add(...(bands as never[])));
  const l = laidOut.laidOut.find(b => b.type === 'legend') as LaidOutLegend | undefined;
  return (l?.items ?? []).map(i => i.tone ?? (i.line ? `line:${i.line}` : '?'));
};

test("legend: 'auto' reads the tones of tree() nodes (mindmap uses the same band)", async () => {
  const got = await toneItems(tree({label: 'root', children: [{label: 'a', tone: 'danger'}, {label: 'b', children: [{label: 'c', tone: 'new'}]}]}));
  assert.deepEqual([...got].sort(), ['danger', 'new']);
});

test("legend: 'auto' reads the tones of classDiagram() classes", async () => {
  const got = await toneItems(classDiagram([{id: 'A', tone: 'changed'}, {id: 'B'}], [{from: 'A', to: 'B'}]));
  assert.deepEqual(got, ['changed']);
});

test("legend: 'auto' reads bpmn() node tones and dashed message flows", async () => {
  const got = await toneItems(bpmn([{id: 'l1', label: 'L1'}, {id: 'l2', label: 'L2'}],
    [{id: 'a', lane: 'l1', label: 'A', tone: 'removed'}, {id: 'b', lane: 'l2', label: 'B'}],
    [{from: 'a', to: 'b', line: 'dashed'}]));
  assert.deepEqual([...got].sort(), ['line:dashed', 'line:solid', 'removed']);
});

test("legend: 'auto' with no tones in these bands adds no legend", async () => {
  const got = await toneItems(tree({label: 'root', children: [{label: 'a'}]}));
  assert.deepEqual(got, []);
});
