import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {bpmn, checkDiagram, closeMeasurer, diagram, flowchart} from '../lib/dsl.ts';
import type {LaidOutBpmn, LaidOutStates} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

type R = {x: number; y: number; w: number; h: number; text: string};
const hit = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const stacked = (labels: R[]): string[] => labels.flatMap((a, i) => labels.slice(i + 1).filter(b => hit(a, b)).map(b => `${a.text} / ${b.text}`));

// A crowded decision flow: a three-way decision, a few labelled arrows and three dashed ways back (invented wording).
const crowdedFlow = () => {
  const kinds: Record<number, 'decision' | 'terminator'> = {0: 'terminator', 1: 'decision', 5: 'decision', 9: 'decision', 10: 'terminator'};
  const nodes = Array.from({length: 11}, (_, i) => ({id: `n${i}`, label: `手順${i}の内容`, ...(kinds[i] ? {kind: kinds[i]} : {})}));
  const e = (from: number, to: number, label?: string, line?: 'dashed') => ({from: `n${from}`, to: `n${to}`, ...(label ? {label} : {}), ...(line ? {line} : {})});
  const edges = [e(0, 1), e(1, 2, 'はい'), e(1, 3, 'いいえ'), e(2, 3), e(3, 4), e(4, 5, '連絡4'), e(5, 6, '承認'), e(5, 8, '差戻し'), e(5, 7, '保留'), e(6, 7, '連絡6'), e(7, 8), e(8, 9, '連絡8'), e(9, 10, 'はい'),
    e(7, 6, '戻り0', 'dashed'), e(4, 2, '戻り1', 'dashed'), e(7, 0, '戻り2', 'dashed')];
  return diagram({theme: 'blue', width: 1600}).add(flowchart(nodes as never, edges));
};

test('flowchart: in a crowded figure no arrow label is put on another label (C6b)', async () => {
  const {laidOut, verdict} = await checkDiagram(crowdedFlow());
  const b = laidOut.laidOut.find(x => x.type === 'states') as LaidOutStates;
  assert.deepEqual(stacked(b.labels), []);
  assert.ok(!verdict.problems.some(p => /overlaps label/.test(String(p))), JSON.stringify(verdict.problems));
});

// BPMN: a gateway with two or three labelled ways out, to nodes in other lanes and columns (invented wording).
const lanes = [{id: 'a', label: '申請者'}, {id: 'b', label: '審査'}, {id: 'c', label: '経理'}];
const gate = (labels: string[]) => {
  const nodes = [{id: 'st', lane: 'a', kind: 'start' as const, label: '申請'}, {id: 'g', lane: 'b', kind: 'xor' as const, label: '内容確認'}, {id: 't1', lane: 'b', label: '承認処理'}, {id: 't2', lane: 'a', label: '修正する'}, {id: 't3', lane: 'c', label: '支払う'}, {id: 'en', lane: 'c', kind: 'end' as const, label: '完了'}];
  const flows = [{from: 'st', to: 'g'}, {from: 'g', to: 't1', label: labels[0]}, {from: 'g', to: 't2', label: labels[1]}, ...(labels[2] ? [{from: 'g', to: 't3', label: labels[2]}] : []), {from: 't1', to: 'en'}, {from: 't3', to: 'en'}];
  return diagram({theme: 'blue', width: 1400}).add(bpmn(lanes, nodes, flows));
};
for (const labels of [['はい', 'いいえ'], ['承認', '差戻し'], ['承認', '差戻し', '保留']]) {
  test(`bpmn: a gateway's ${labels.length} labelled ways out do not stack (${labels.join('/')}) (C6a)`, async () => {
    const {laidOut, verdict} = await checkDiagram(gate(labels));
    const b = laidOut.laidOut.find(x => x.type === 'bpmn') as LaidOutBpmn;
    assert.equal(b.labels.length, labels.length);
    assert.deepEqual(stacked(b.labels), []);
    assert.deepEqual(verdict.problems, []);
  });
}

test('bpmn: ten labelled arrows in a dense flow keep their labels apart (C6b)', async () => {
  const ns = Array.from({length: 8}, (_, i) => ({id: `n${i}`, lane: i % 2 ? 'b' : 'a', label: `工程${i}`}));
  const flows = ns.slice(0, -1).map((n, i) => ({from: n.id, to: `n${i + 1}`, label: `連絡${i}`}));
  flows.push({from: 'n1', to: 'n4', label: '確認'}, {from: 'n2', to: 'n6', label: '依頼'}, {from: 'n5', to: 'n7', label: '報告'});
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', width: 1800}).add(bpmn(lanes.slice(0, 2), ns, flows)));
  const b = laidOut.laidOut.find(x => x.type === 'bpmn') as LaidOutBpmn;
  assert.equal(b.labels.length, flows.length);
  assert.deepEqual(stacked(b.labels), []);
  assert.deepEqual(verdict.problems, []);
});
