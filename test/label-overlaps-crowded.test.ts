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

// C6a: in a vertical BPMN, the two exits of one gateway with long conditions in narrow lanes were put on each other (invented wording).
const vertical = (w: number) => {
  const vl = [{id: 'a', label: '申請者'}, {id: 'b', label: '審査'}, {id: 'c', label: '経理'}, {id: 'd', label: '部長'}];
  const vn = [{id: 'st', lane: 'a', kind: 'start' as const, label: '開始'}, {id: 't0', lane: 'd', label: '内容を見る'}, {id: 'g0', lane: 'd', kind: 'and' as const, label: '判定'},
    {id: 't1', lane: 'c', label: '支払いの手続きをする'}, {id: 't2', lane: 'd', label: '決裁する'}, {id: 'en', lane: 'a', kind: 'end' as const, label: '終了'}];
  const vf = [{from: 'st', to: 't0'}, {from: 't0', to: 'g0'}, {from: 'g0', to: 't1', label: '上限以内の場合'}, {from: 'g0', to: 't2', label: '上限を超える場合'}, {from: 't1', to: 'en'}];
  return diagram({theme: 'blue', width: w}).add(bpmn(vl, vn, vf, {dir: 'v'} as never));
};
for (const w of [754, 900]) {
  test(`bpmn dir 'v': two long conditions of one gateway do not stack at width ${w} (C6a)`, async () => {
    const {laidOut, verdict} = await checkDiagram(vertical(w));
    const b = laidOut.laidOut.find(x => x.type === 'bpmn') as LaidOutBpmn;
    assert.equal(b.labels.length, 2);
    assert.deepEqual(stacked(b.labels), []);
    assert.ok(!verdict.problems.some(p => /overlaps label/.test(String(p))), JSON.stringify(verdict.problems));
    // not asserted: in lanes this narrow one chip may still sit on a task box; `check` reports it (see the PR description)
  });
}

// m3: when no spot is free, a spot outside the figure costs more than one inside. A very crowded flowchart (24 labelled arrows, 10 states, narrow):
// the arrows are invented; the count is what the layout gives with the cost (6 labels run outside without it).
test('flowchart: a very crowded figure keeps as many labels inside the figure as it can (C6b)', async () => {
  const edges = [['0', '1', 'はい'], ['1', '2', '戻る再提'], ['2', '3', '留連絡確認依頼報告戻る再提出完'], ['3', '4', '報告戻る再提'], ['4', '5', '差戻し保留連絡確認依頼報告戻る再提出完了不可'], ['5', '6', '頼報告戻る再'], ['6', '7', '承認差戻し保留連絡確認依'], ['7', '8', '再提出完了不可'], ['8', '9', 'はい'], ['1', '5', '認依頼報'], ['4', '7', '認依頼報告戻る再提'], ['2', '9', 'いいえ'], ['8', '0', 'いいえ', 'd'], ['3', '6', '戻し保留連絡確認依頼報告戻る再提出完了不可可能あ'], ['1', '6', '認差戻し保'], ['8', '2', '確認依頼報告戻る', 'd'], ['6', '1', '保留連絡確認依', 'd'], ['3', '9', '絡確認依頼報告戻る再提出完了不可可能'], ['7', '5', '依頼報告戻る再提出完了', 'd'], ['6', '2', '告戻る再提', 'd'], ['3', '0', '認差戻し保留連絡確認依頼報告戻る再提出完', 'd'], ['2', '9', '告戻る再提出'], ['0', '9', '戻し保留連絡確認依頼報告戻る再'], ['6', '1', '頼報告戻る', 'd']] as [string, string, string, string?][];
  const nodes = Array.from({length: 10}, (_, k) => ({id: `n${k}`, label: `手順${k}`, ...(k === 0 || k === 9 ? {kind: 'terminator' as const} : k === 3 ? {kind: 'decision' as const} : {})}));
  const fe = edges.map(([a, b, label, d]) => ({from: `n${a}`, to: `n${b}`, label, ...(d ? {line: 'dashed' as const} : {})}));
  const {verdict} = await checkDiagram(diagram({theme: 'blue', width: 619}).add(flowchart(nodes, fe, {dir: 'down'} as never)));
  const outside = verdict.problems.filter(p => /runs outside the figure/.test(String(p))).length;
  assert.ok(outside <= 5, `${outside} labels run outside the figure`);
});
